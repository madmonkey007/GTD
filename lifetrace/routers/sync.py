"""Offline-first batch synchronization endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query

from lifetrace.core.dependencies import get_sync_service
from lifetrace.schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from lifetrace.services.sync_service import SyncService

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
async def push_changes(
    request: SyncPushRequest,
    service: SyncService = Depends(get_sync_service),
) -> SyncPushResponse:
    return service.push(request)


@router.get("/pull", response_model=SyncPullResponse)
async def pull_changes(
    since: datetime = Query(
        datetime(1970, 1, 1, tzinfo=UTC),
        description="Return changes strictly newer than this synchronization cursor",
    ),
    service: SyncService = Depends(get_sync_service),
) -> SyncPullResponse:
    return service.pull(since)
