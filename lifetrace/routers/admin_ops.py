"""Admin 后台运维 API：调度任务、日志查看、数据库维护与备份

所有路由挂 get_current_admin 依赖，非管理员 403。
"""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from lifetrace.core.dependencies import get_current_admin
from lifetrace.jobs.scheduler import get_scheduler_manager
from lifetrace.util.base_paths import get_user_logs_dir
from lifetrace.util.logging_config import get_logger
from lifetrace.util.path_utils import get_database_path

logger = get_logger()

router = APIRouter(
    prefix="/api/admin/ops",
    tags=["admin-ops"],
    dependencies=[Depends(get_current_admin)],
)

MAX_LOG_LINES = 1000
MAX_BACKUP_FILES = 50


# ========== 调度任务 ==========


class JobInfo(BaseModel):
    id: str
    name: str | None = None
    func: str
    trigger: str
    next_run_time: str | None = None
    paused: bool = False


class JobListResponse(BaseModel):
    total: int
    jobs: list[JobInfo]


class JobOperationResponse(BaseModel):
    success: bool
    message: str


@router.get("/scheduler/jobs", response_model=JobListResponse)
def scheduler_jobs() -> JobListResponse:
    manager = get_scheduler_manager()
    jobs = []
    for job in manager.get_all_jobs():
        jobs.append(
            JobInfo(
                id=job.id,
                name=job.name,
                func=str(job.func_ref),
                trigger=str(job.trigger),
                next_run_time=(
                    job.next_run_time.isoformat() if job.next_run_time else None
                ),
                paused=job.next_run_time is None,
            )
        )
    return JobListResponse(total=len(jobs), jobs=jobs)


@router.post("/scheduler/jobs/{job_id}/pause", response_model=JobOperationResponse)
def scheduler_pause(job_id: str) -> JobOperationResponse:
    manager = get_scheduler_manager()
    if not manager.pause_job(job_id):
        raise HTTPException(status_code=400, detail="暂停任务失败")
    logger.info("[Admin] 调度任务已暂停: %s", job_id)
    return JobOperationResponse(success=True, message=f"任务 {job_id} 已暂停")


@router.post("/scheduler/jobs/{job_id}/resume", response_model=JobOperationResponse)
def scheduler_resume(job_id: str) -> JobOperationResponse:
    manager = get_scheduler_manager()
    if not manager.resume_job(job_id):
        raise HTTPException(status_code=400, detail="恢复任务失败")
    logger.info("[Admin] 调度任务已恢复: %s", job_id)
    return JobOperationResponse(success=True, message=f"任务 {job_id} 已恢复")


# ========== 日志查看 ==========


@router.get("/logs/files")
def log_files() -> list[dict[str, str]]:
    logs_dir = get_user_logs_dir()
    if not logs_dir.exists():
        return []
    result: list[dict[str, str]] = []
    for file_path in logs_dir.rglob("*.log"):
        result.append(
            {
                "name": str(file_path.relative_to(logs_dir)),
                "size_kb": str(file_path.stat().st_size // 1024),
                "modified": datetime.fromtimestamp(
                    file_path.stat().st_mtime, tz=timezone.utc
                ).isoformat(),
            }
        )
    return sorted(result, key=lambda x: x["modified"], reverse=True)


@router.get("/logs/content", response_class=PlainTextResponse)
def log_content(
    file: str = Query(..., description="相对 logs 目录的路径"),
    lines: int = Query(200, ge=1, le=MAX_LOG_LINES),
) -> str:
    logs_dir = get_user_logs_dir().resolve()
    target = (logs_dir / file).resolve()
    if not str(target).startswith(str(logs_dir)):
        raise HTTPException(status_code=400, detail="无效的文件路径")
    if not target.exists() or target.suffix != ".log":
        raise HTTPException(status_code=404, detail="日志文件不存在")
    with open(target, encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()
    return "".join(all_lines[-lines:])


# ========== 数据库维护与备份 ==========


@router.get("/db/info")
def db_info() -> dict[str, object]:
    db_path = get_database_path()
    size_bytes = db_path.stat().st_size if db_path.exists() else 0
    with sqlite3.connect(db_path) as conn:
        page_count = conn.execute("PRAGMA page_count").fetchone()[0]
        freelist = conn.execute("PRAGMA freelist_count").fetchone()[0]
        page_size = conn.execute("PRAGMA page_size").fetchone()[0]
    return {
        "path": str(db_path),
        "size_mb": round(size_bytes / 1024 / 1024, 2),
        "page_count": page_count,
        "freelist_pages": freelist,
        "page_size": page_size,
    }


@router.post("/db/vacuum", response_model=JobOperationResponse)
def db_vacuum() -> JobOperationResponse:
    db_path = get_database_path()
    before = db_path.stat().st_size
    with sqlite3.connect(db_path) as conn:
        conn.execute("VACUUM")
    after = db_path.stat().st_size
    logger.info(
        "[Admin] VACUUM 完成: %.1fMB -> %.1fMB", before / 1048576, after / 1048576
    )
    return JobOperationResponse(
        success=True,
        message=f"VACUUM 完成：{before // 1024}KB → {after // 1024}KB",
    )


def _backup_dir() -> Path:
    return get_database_path().parent / "backups"


@router.get("/backup/list")
def backup_list() -> list[dict[str, object]]:
    bdir = _backup_dir()
    if not bdir.exists():
        return []
    result: list[dict[str, object]] = []
    for p in sorted(bdir.glob("*.db"), reverse=True):
        stat = p.stat()
        result.append(
            {
                "name": p.name,
                "size_mb": round(stat.st_size / 1024 / 1024, 2),
                "created_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            }
        )
    return result


@router.post("/backup/create", response_model=JobOperationResponse)
def backup_create() -> JobOperationResponse:
    """用 SQLite backup API 在线备份（安全，不阻塞业务写入）。"""
    db_path = get_database_path()
    bdir = _backup_dir()
    bdir.mkdir(parents=True, exist_ok=True)
    name = f"lifetrace_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    dest_path = bdir / name
    src = sqlite3.connect(db_path)
    try:
        dest = sqlite3.connect(dest_path)
        try:
            with dest:
                src.backup(dest)
        finally:
            dest.close()
    finally:
        src.close()

    # 保留最近 MAX_BACKUP_FILES 个备份，超出删除最旧的
    backups = sorted(bdir.glob("*.db"))
    for old in backups[:-MAX_BACKUP_FILES]:
        old.unlink()

    logger.info("[Admin] 已创建数据库备份: %s", name)
    return JobOperationResponse(success=True, message=f"备份已创建：{name}")
