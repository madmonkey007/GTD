const fs = require("node:fs");
const path = require("node:path");

function parseArgs() {
	const args = process.argv.slice(2);
	const result = {};
	for (let i = 0; i < args.length; i += 1) {
		const key = args[i];
		const value = args[i + 1];
		if (key?.startsWith("--") && value && !value.startsWith("--")) {
			result[key.slice(2)] = value;
			i += 0;
		}
	}
	return result;
}

function copyDir(src, dest) {
	if (!fs.existsSync(src)) {
		console.warn(`Source not found, skipping: ${src}`);
		return;
	}
	fs.mkdirSync(dest, { recursive: true });
	fs.cpSync(src, dest, { recursive: true, force: true });
	console.log(`Copied ${src} -> ${dest}`);
}

function findLatestReleaseDir(targetRoot) {
	if (!fs.existsSync(targetRoot)) {
		return null;
	}

	const entries = fs.readdirSync(targetRoot, { withFileTypes: true });
	const candidates = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const releaseDir = path.join(targetRoot, entry.name, "release");
		if (fs.existsSync(releaseDir)) {
			const stat = fs.statSync(releaseDir);
			candidates.push({ dir: releaseDir, mtimeMs: stat.mtimeMs });
		}
	}

	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return candidates[0]?.dir ?? null;
}

const args = parseArgs();
const rootDir = path.resolve(__dirname, "..");
const tauriTargetDir = path.join(rootDir, "src-tauri", "target");

let releaseDir = null;
if (args.target) {
	releaseDir = path.join(tauriTargetDir, args.target, "release");
} else {
	const defaultRelease = path.join(tauriTargetDir, "release");
	if (fs.existsSync(defaultRelease)) {
		releaseDir = defaultRelease;
	} else {
		releaseDir = findLatestReleaseDir(tauriTargetDir);
	}
}

if (!releaseDir || !fs.existsSync(releaseDir)) {
	console.error("Release directory not found. Did tauri build finish?");
	process.exit(1);
}

// On Windows, Tauri's resource_dir() resolves to the directory that CONTAINS the
// executable (the release dir itself), NOT a "resources" subdir. The previous
// target "<release>/resources" placed files where the Rust side never looks
// (get_backend_path/get_server_path join directly onto resource_dir()). Target the
// executable directory instead so running the raw (un-installed) binary resolves
// resources too. The shipped installer is populated authoritatively by
// bundle.resources (map form) at build time; this post-build copy is only a
// safety net for the raw-binary workflow.
const resourcesDir = releaseDir;
fs.mkdirSync(resourcesDir, { recursive: true });

const standaloneSrc = path.join(rootDir, ".next", "standalone");
const standaloneDest = path.join(resourcesDir, "standalone");
copyDir(standaloneSrc, standaloneDest);

const backendSrc = path.join(rootDir, "..", "dist-backend");
const backendDest = path.join(resourcesDir, "dist-backend");
copyDir(backendSrc, backendDest);
