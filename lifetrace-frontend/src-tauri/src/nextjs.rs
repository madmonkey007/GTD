//! Next.js Server Management
//!
//! This module handles the lifecycle of the Next.js standalone server,
//! including starting, health checking, and stopping the process.

use crate::backend;
use crate::config::{self, timeouts};
use log::{error, info, warn};
use reqwest::Client;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// `CREATE_NO_WINDOW` process-creation flag (Windows).
///
/// `node.exe` (the standalone server) and `where.exe` (PATH probing) use the
/// console subsystem. When spawned by this GUI-subsystem parent (which has no
/// console), Windows would otherwise allocate a new console window that stays
/// visible for the child's lifetime. This flag suppresses it.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Apply `CREATE_NO_WINDOW` on Windows so console-subsystem children do not
/// attach/flash a console window. No-op on other platforms.
#[cfg(windows)]
fn hide_console(cmd: &mut Command) {
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_cmd: &mut Command) {}

/// Strip the Windows verbatim (`\\?\`) prefix that `fs::canonicalize` and
/// Tauri's `resource_dir()` may return.
///
/// Node.js's CommonJS loader (`resolveMainPath` -> `realpathSync`) mis-parses
/// `\\?\D:\...\server.js`: it attempts `lstat("D:")` and aborts with `EISDIR`
/// before the script ever runs, so the spawned server exits immediately and
/// `wait_for_server` times out. External console tools expect plain Win32
/// paths, so normalize here before handing the path to `node`.
fn deverbatim(path: &std::path::Path) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{}", rest));
    }
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        return PathBuf::from(rest);
    }
    path.to_path_buf()
}

/// Forward a child process's piped stream into the log, line by line.
///
/// This both surfaces the child's output (crucial for diagnosing startup
/// failures such as the `EISDIR` crash above) and keeps the pipe drained so
/// node never blocks once the ~4 KiB OS pipe buffer fills.
fn spawn_pipe_logger<R>(stream: R, label: &'static str)
where
    R: std::io::Read + Send + 'static,
{
    std::thread::spawn(move || {
        use std::io::BufRead;
        let mut reader = std::io::BufReader::new(stream);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let trimmed = line.trim_end();
                    if !trimmed.is_empty() {
                        info!("[nextjs {}] {}", label, trimmed);
                    }
                }
                Err(_) => break,
            }
        }
    });
}

/// Global Next.js process reference
static NEXTJS_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Current frontend port
static FRONTEND_PORT: AtomicU16 = AtomicU16::new(3001);

/// Flag indicating if server is stopping
static IS_STOPPING: AtomicBool = AtomicBool::new(false);

/// Get the frontend URL
pub fn get_frontend_url() -> String {
    let port = FRONTEND_PORT.load(Ordering::Relaxed);
    format!("http://localhost:{}", port)
}

/// Set the frontend port
pub fn set_frontend_port(port: u16) {
    FRONTEND_PORT.store(port, Ordering::Relaxed);
}

/// Get current frontend port
pub fn get_frontend_port() -> u16 {
    FRONTEND_PORT.load(Ordering::Relaxed)
}

/// Check if server is healthy
async fn check_server_health(port: u16) -> bool {
    let url = format!("http://localhost:{}", port);
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    match client.get(&url).send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            status == 200 || status == 304
        }
        Err(_) => false,
    }
}

/// Wait for server to be ready
async fn wait_for_server(url: &str, timeout_ms: u64) -> Result<(), String> {
    let start = std::time::Instant::now();
    let timeout = Duration::from_millis(timeout_ms);
    let retry_interval = Duration::from_millis(500);

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    while start.elapsed() < timeout {
        if let Ok(response) = client.get(url).send().await {
            let status = response.status().as_u16();
            if status == 200 || status == 304 {
                return Ok(());
            }
        }
        tokio::time::sleep(retry_interval).await;
    }

    Err(format!("Server did not start within {}ms", timeout_ms))
}

/// Find available port starting from default
async fn find_available_port(start_port: u16, max_attempts: u16) -> Result<u16, String> {
    for i in 0..max_attempts {
        let port = start_port + i;
        if !check_server_health(port).await {
            // Port is likely available (not responding)
            return Ok(port);
        }
    }
    Err(format!(
        "Could not find available port after {} attempts",
        max_attempts
    ))
}

/// Get standalone server path
fn get_server_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let server_path = resource_path.join("standalone").join("server.js");

    if server_path.exists() {
        // Normalize away any `\\?\` verbatim prefix so node.exe can load it.
        Ok(deverbatim(&server_path))
    } else {
        Err(format!("Server file not found at {:?}", server_path))
    }
}

/// Start the Next.js server
pub async fn start_nextjs(app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // In development mode, expect external dev server
    if cfg!(debug_assertions) {
        let port = config::get_frontend_port();
        set_frontend_port(port);
        info!(
            "Development mode: expecting Next.js dev server at http://localhost:{}",
            port
        );

        // Check if dev server is already running
        if check_server_health(port).await {
            info!("Next.js dev server is already running");
            return Ok(());
        }

        // Wait for external dev server
        info!("Waiting for Next.js dev server...");
        match wait_for_server(&format!("http://localhost:{}", port), 30000).await {
            Ok(_) => {
                info!("Next.js dev server is ready");
                return Ok(());
            }
            Err(e) => {
                warn!("Dev server not available: {}", e);
                return Err(e.into());
            }
        }
    }

    // Production mode: start standalone server
    info!("Starting Next.js production server...");

    // Get server path
    let server_path = get_server_path(app)?;
    let server_dir = server_path
        .parent()
        .ok_or("Failed to get server directory")?;

    info!("Server path: {:?}", server_path);
    info!("Server directory: {:?}", server_dir);

    // Find available port
    let port = find_available_port(config::get_frontend_port(), 50).await?;
    set_frontend_port(port);
    info!("Frontend will use port: {}", port);

    // Get backend URL for environment variable
    let backend_url = backend::get_backend_url();

    // Check for Node.js
    let node_path = which_node()?;
    info!("Node.js path: {:?}", node_path);

    // Spawn Next.js server process
    let mut cmd = Command::new(&node_path);
    cmd.arg(&server_path)
        .current_dir(server_dir)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "localhost")
        .env("NODE_ENV", "production")
        .env("NEXT_PUBLIC_API_URL", &backend_url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Prevent node.exe (console subsystem) from opening a visible console window.
    hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start Next.js server: {}", e))?;

    info!("Spawned Next.js process with PID: {:?}", child.id());

    // Drain the child's piped stdout/stderr into our logger. Without this the
    // OS pipe buffers fill and node blocks, and any startup crash is silently
    // lost (which is exactly why the `\\?\` path failure was invisible before).
    if let Some(stdout) = child.stdout.take() {
        spawn_pipe_logger(stdout, "stdout");
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_pipe_logger(stderr, "stderr");
    }

    // Store process reference
    {
        let mut guard = NEXTJS_PROCESS.lock().unwrap();
        *guard = Some(child);
    }

    // Wait for server to be ready
    let server_url = format!("http://localhost:{}", port);
    info!(
        "Waiting for Next.js server at {} to be ready...",
        server_url
    );

    wait_for_server(&server_url, timeouts::FRONTEND_READY).await?;
    info!("Next.js server is ready at {}", server_url);

    // Start health check loop
    start_health_check_loop(port);

    Ok(())
}

/// Find Node.js executable
fn which_node() -> Result<PathBuf, String> {
    // Try common Node.js locations
    let candidates = if cfg!(windows) {
        vec![
            "node.exe",
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files (x86)\\nodejs\\node.exe",
        ]
    } else {
        vec![
            "node",
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",
        ]
    };

    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Ok(path);
        }

        // Try to find in PATH
        let mut probe = Command::new(if cfg!(windows) { "where" } else { "which" });
        probe.arg(candidate);
        hide_console(&mut probe);
        if let Ok(output) = probe.output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                if !path_str.is_empty() {
                    return Ok(PathBuf::from(path_str));
                }
            }
        }
    }

    Err("Node.js not found. Please install Node.js.".to_string())
}

/// Start health check loop
fn start_health_check_loop(port: u16) {
    tokio::spawn(async move {
        let interval = Duration::from_millis(config::health_check::FRONTEND_INTERVAL);

        loop {
            tokio::time::sleep(interval).await;

            if IS_STOPPING.load(Ordering::Relaxed) {
                break;
            }

            if !check_server_health(port).await {
                warn!("Next.js health check failed");
            }
        }
    });
}

/// Stop the Next.js server
pub fn stop_nextjs() {
    IS_STOPPING.store(true, Ordering::Relaxed);

    let mut guard = NEXTJS_PROCESS.lock().unwrap();
    if let Some(mut child) = guard.take() {
        info!("Stopping Next.js server...");

        // Try graceful shutdown first
        #[cfg(unix)]
        {
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }
        }

        #[cfg(windows)]
        {
            let _ = child.kill();
        }

        // Wait a bit for graceful shutdown
        std::thread::sleep(Duration::from_secs(2));

        // Force kill if still running
        match child.try_wait() {
            Ok(Some(_)) => {
                info!("Next.js server stopped gracefully");
            }
            Ok(None) => {
                warn!("Next.js server did not stop gracefully, forcing kill");
                let _ = child.kill();
            }
            Err(e) => {
                error!("Error checking Next.js status: {}", e);
                let _ = child.kill();
            }
        }
    }
}

/// Cleanup on application exit
pub fn cleanup() {
    stop_nextjs();
}
