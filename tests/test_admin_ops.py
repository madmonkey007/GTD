"""Admin ops API tests: scheduler proxy, logs, db info/vacuum/backup."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lifetrace.core.dependencies import get_current_admin
from lifetrace.routers.admin_ops import router as ops_router
from lifetrace.util.base_paths import get_user_logs_dir

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_FORBIDDEN = 403
HTTP_BAD_REQUEST = 400
HTTP_NOT_FOUND = 404

_admin_user = SimpleNamespace(id=1, email="admin@test.local", role="admin")


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Generator[TestClient]:
    # 重定向日志目录与数据库路径到 tmp
    monkeypatch.setattr(
        "lifetrace.routers.admin_ops.get_user_logs_dir", lambda: tmp_path / "logs"
    )
    db_file = tmp_path / "data" / "test.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE IF NOT EXISTS t (x INTEGER)")
    conn.commit()
    conn.close()
    monkeypatch.setattr(
        "lifetrace.routers.admin_ops.get_database_path", lambda: db_file
    )
    # 调度器 stub
    jobs = [
        SimpleNamespace(
            id="job1",
            name="任务1",
            func_ref="f",
            trigger="interval",
            next_run_time=None,
        ),
        SimpleNamespace(
            id="job2",
            name="任务2",
            func_ref="f",
            trigger="cron",
            next_run_time=SimpleNamespace(isoformat=lambda: "2026-01-01T00:00:00"),
        ),
    ]

    class _ManagerStub:
        def get_all_jobs(self):
            return jobs

        def pause_job(self, job_id: str) -> bool:
            job = next((j for j in jobs if j.id == job_id), None)
            if job is None or job.next_run_time is None:
                return False
            job.next_run_time = None
            return True

        def resume_job(self, job_id: str) -> bool:
            job = next((j for j in jobs if j.id == job_id), None)
            if job is None or job.next_run_time is not None:
                return False
            job.next_run_time = SimpleNamespace(
                isoformat=lambda: "2026-01-01T00:00:00"
            )
            return True

    monkeypatch.setattr(
        "lifetrace.routers.admin_ops.get_scheduler_manager", lambda: _ManagerStub()
    )

    app = FastAPI()
    app.include_router(ops_router)
    app.dependency_overrides[get_current_admin] = lambda: _admin_user
    with TestClient(app) as c:
        yield c


def test_ops_requires_admin() -> None:
    app = FastAPI()
    app.include_router(ops_router)
    client = TestClient(app)
    assert client.get("/api/admin/ops/scheduler/jobs").status_code in (401, 403)


def test_scheduler_jobs_list(client: TestClient) -> None:
    resp = client.get("/api/admin/ops/scheduler/jobs")
    assert resp.status_code == HTTP_OK
    body = resp.json()
    assert body["total"] == 2
    assert {j["paused"] for j in body["jobs"]} == {True, False}


def test_scheduler_pause_resume(client: TestClient) -> None:
    assert client.post("/api/admin/ops/scheduler/jobs/job2/pause").status_code == HTTP_OK
    assert (
        client.post("/api/admin/ops/scheduler/jobs/job2/pause").status_code
        == HTTP_BAD_REQUEST
    )
    assert (
        client.post("/api/admin/ops/scheduler/jobs/job1/resume").status_code == HTTP_OK
    )


def test_log_files_and_content(client: TestClient, tmp_path: Path) -> None:
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir()
    (logs_dir / "2026-01-01-1.log").write_text("line1\nline2\n", encoding="utf-8")

    resp = client.get("/api/admin/ops/logs/files")
    assert resp.status_code == HTTP_OK
    files = resp.json()
    assert len(files) == 1
    assert files[0]["name"] == "2026-01-01-1.log"

    resp = client.get("/api/admin/ops/logs/content", params={"file": "2026-01-01-1.log"})
    assert resp.status_code == HTTP_OK
    assert "line2" in resp.text

    # 路径穿越被拒
    resp = client.get(
        "/api/admin/ops/logs/content", params={"file": "../../secret.txt"}
    )
    assert resp.status_code == HTTP_BAD_REQUEST

    # 不存在
    resp = client.get(
        "/api/admin/ops/logs/content", params={"file": "nope.log"}
    )
    assert resp.status_code == HTTP_NOT_FOUND


def test_db_info_and_vacuum(client: TestClient) -> None:
    resp = client.get("/api/admin/ops/db/info")
    assert resp.status_code == HTTP_OK
    info = resp.json()
    assert info["page_count"] >= 1

    resp = client.post("/api/admin/ops/db/vacuum")
    assert resp.status_code == HTTP_OK
    assert resp.json()["success"] is True


def test_backup_create_and_list(client: TestClient) -> None:
    resp = client.post("/api/admin/ops/backup/create")
    assert resp.status_code == HTTP_OK
    name = resp.json()["message"].split("：", 1)[1]

    resp = client.get("/api/admin/ops/backup/list")
    assert resp.status_code == HTTP_OK
    backups = resp.json()
    assert len(backups) == 1
    assert backups[0]["name"] == name
