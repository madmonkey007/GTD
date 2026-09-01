"""登录失败限流测试。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException, Request

from lifetrace.util import login_rate_limit as rl


def _make_request(ip: str = "1.2.3.4") -> Request:
    scope = {
        "type": "http",
        "client": (ip, 12345),
        "headers": [],
        "method": "POST",
        "path": "/api/auth/login",
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _clear() -> None:
    rl._failures.clear()


def test_locks_after_max_failures() -> None:
    req = _make_request()
    for _ in range(rl.MAX_FAILURES):
        rl.record_failure(req, "user@test.local")
    with pytest.raises(HTTPException) as exc_info:
        rl.check_locked(req, "user@test.local")
    assert exc_info.value.status_code == 429


def test_resets_after_success() -> None:
    req = _make_request()
    for _ in range(rl.MAX_FAILURES - 1):
        rl.record_failure(req, "user@test.local")
    rl.reset_failures(req, "user@test.local")
    rl.check_locked(req, "user@test.local")  # 不应抛异常


def test_lock_expires() -> None:
    req = _make_request()
    for _ in range(rl.MAX_FAILURES):
        rl.record_failure(req, "user@test.local")
    # 把锁定截止时间拨到过去
    expired = datetime.now(UTC) - timedelta(seconds=1)
    for key in ("email:user@test.local", "ip:1.2.3.4"):
        count, window_start, _ = rl._failures[key]
        rl._failures[key] = rl._State(count, window_start, expired)
    rl.check_locked(req, "user@test.local")  # 锁已过期，不抛异常


def test_window_expiry_clears_count() -> None:
    req = _make_request()
    for _ in range(rl.MAX_FAILURES - 1):
        rl.record_failure(req, "user@test.local")
    key = "email:user@test.local"
    count, _, locked = rl._failures[key]
    rl._failures[key] = rl._State(count, datetime.now(UTC) - timedelta(hours=1), locked)
    rl.record_failure(req, "user@test.local")  # 新窗口重新计数
    assert rl._failures[key].count == 1
