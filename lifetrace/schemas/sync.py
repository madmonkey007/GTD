"""Schemas for the offline-first batch synchronization protocol."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class SyncModel(BaseModel):
    """Protocol model that accepts Python and browser field names."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


SyncOpKind = Literal[
    "todo.create",
    "todo.update",
    "todo.delete",
    "journal.create",
    "journal.update",
    "journal.delete",
    "habit.create",
    "habit.update",
    "habit.delete",
    "habit.record_set",
]
SyncBaseEntityType = Literal["todo", "journal", "habit"]
SyncEntityType = Literal["todo", "journal", "habit", "habit_record"]
SyncResultStatus = Literal["applied", "duplicate", "conflict", "error"]


class SyncOp(SyncModel):
    op_id: str = Field(min_length=1, max_length=128)
    kind: SyncOpKind
    uid: str = Field(min_length=1, max_length=128)
    depends_on: list[str] = Field(default_factory=list)
    base_updated_at: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    queued_at: datetime


class SyncPushRequest(SyncModel):
    client_id: str = Field(min_length=1, max_length=128)
    ops: list[SyncOp] = Field(default_factory=list, max_length=1000)


class SyncOpResult(SyncModel):
    op_id: str
    status: SyncResultStatus
    entity_type: SyncEntityType
    uid: str
    server_id: int | None = None
    entity: dict[str, Any] | None = None
    error: str | None = None
    conflict: dict[str, Any] | None = None


class SyncPushResponse(SyncModel):
    results: list[SyncOpResult] = Field(default_factory=list)
    server_time: datetime


class SyncTombstoneResponse(SyncModel):
    entity_type: SyncEntityType
    uid: str
    deleted_at: datetime


class SyncPullResponse(SyncModel):
    todos: list[dict[str, Any]] = Field(default_factory=list)
    journals: list[dict[str, Any]] = Field(default_factory=list)
    habits: list[dict[str, Any]] = Field(default_factory=list)
    habit_records: list[dict[str, Any]] = Field(default_factory=list)
    tombstones: list[SyncTombstoneResponse] = Field(default_factory=list)
    server_time: datetime
