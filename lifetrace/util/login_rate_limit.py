"""登录/注册失败限流（进程内内存实现）

同一 IP 短时间内多次认证失败后临时锁定，防撞库爆破。
无需外部依赖；多进程部署时每个 worker 独立计数（本项目单进程部署，够用）。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from fastapi import HTTPException, Request

from lifetrace.util.logging_config import get_logger

logger = get_logger()

MAX_FAILURES = 5
WINDOW = timedelta(minutes=15)
LOCK_DURATION = timedelta(minutes=15)

# key -> (失败次数, 窗口起点, 锁定截止时间或 None)
_failures: dict[str, tuple[int, datetime, datetime | None]] = {}
MAX_TRACKED_KEYS = 10000


class _State(NamedTuple):
    count: int
    window_start: datetime
    locked_until: datetime | None


def _now() -> datetime:
    return datetime.now(UTC)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get(key: str) -> _State | None:
    state = _failures.get(key)
    if state is None:
        return None
    if state.locked_until and _now() >= state.locked_until:
        del _failures[key]
        return None
    if not state.locked_until and _now() - state.window_start > WINDOW:
        del _failures[key]
        return None
    return state


def check_locked(request: Request, identifier: str) -> None:
    """请求前调用：若已被锁定则抛 429。"""
    ip = _client_ip(request)
    for key in (f"ip:{ip}", f"email:{identifier.lower()}"):
        state = _get(key)
        if state and state.locked_until:
            remaining = int((state.locked_until - _now()).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=429,
                detail=f"尝试次数过多，请 {remaining} 分钟后再试",
            )


def record_failure(request: Request, identifier: str) -> None:
    """认证失败后调用；达到阈值则锁定。"""
    ip = _client_ip(request)
    now = _now()
    for key in (f"ip:{ip}", f"email:{identifier.lower()}"):
        state = _get(key)
        if state is None:
            count, window_start, locked_until = 1, now, None
        else:
            count, window_start, locked_until = state.count + 1, state.window_start, None
        if count >= MAX_FAILURES:
            locked_until = now + LOCK_DURATION
            count = 0
            window_start = now
            logger.warning("[Auth] 触发限流锁定: %s", key)
        _failures[key] = _State(count, window_start, locked_until)
    if len(_failures) > MAX_TRACKED_KEYS:
        _failures.clear()


def reset_failures(request: Request, identifier: str) -> None:
    """认证成功后调用，清除计数。"""
    ip = _client_ip(request)
    _failures.pop(f"ip:{ip}", None)
    _failures.pop(f"email:{identifier.lower()}", None)
