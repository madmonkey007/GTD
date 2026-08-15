"""Offline-first push/pull synchronization service."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from lifetrace.repositories.sql_habit_repository import SqlHabitRepository
from lifetrace.repositories.sql_journal_repository import SqlJournalRepository
from lifetrace.repositories.sql_todo_repository import SqlTodoRepository
from lifetrace.schemas.habit import HabitCreate, HabitUpdate
from lifetrace.schemas.journal import JournalCreate, JournalUpdate
from lifetrace.schemas.sync import (
    SyncBaseEntityType,
    SyncEntityType,
    SyncOp,
    SyncOpResult,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncResultStatus,
    SyncTombstoneResponse,
)
from lifetrace.schemas.todo import TodoCreate, TodoUpdate
from lifetrace.services.habit_service import HabitService, _normalize_record_date
from lifetrace.services.journal_service import JournalService
from lifetrace.services.todo_service import TodoService
from lifetrace.storage.models import (
    Habit,
    HabitRecord,
    Journal,
    SyncOpLog,
    SyncTombstone,
    Todo,
)
from lifetrace.storage.sql_utils import col
from lifetrace.util.time_utils import get_utc_now

_CAMEL_BOUNDARY = re.compile(r"(?<!^)(?=[A-Z])")
_ENTITY_MODELS = {"todo": Todo, "journal": Journal, "habit": Habit}


def _snake_key(value: str) -> str:
    return _CAMEL_BOUNDARY.sub("_", value).lower()


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {_snake_key(key): value for key, value in payload.items()}


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class SyncService:
    """Apply idempotent client operations and expose incremental changes."""

    def __init__(self, db_base: Any, user_id: int = 1):
        self.db_base = db_base
        self.user_id = user_id
        self.todo_repository = SqlTodoRepository(db_base, user_id=user_id)
        self.journal_repository = SqlJournalRepository(db_base, user_id=user_id)
        self.habit_repository = SqlHabitRepository(db_base, user_id=user_id)
        self.todo_service = TodoService(self.todo_repository, db_base=db_base)
        self.journal_service = JournalService(
            self.journal_repository,
            db_base,
            todo_repository=self.todo_repository,
        )
        self.habit_service = HabitService(self.habit_repository, db_base)

    def push(self, request: SyncPushRequest) -> SyncPushResponse:
        self.prune_old_sync_state()
        results = [self._push_one(request.client_id, op) for op in request.ops]
        return SyncPushResponse(results=results, server_time=get_utc_now())

    def _push_one(self, client_id: str, op: SyncOp) -> SyncOpResult:
        duplicate = self._load_duplicate(client_id, op.op_id)
        if duplicate:
            return duplicate.model_copy(update={"status": "duplicate"})

        try:
            result = self._apply(op)
        except Exception as exc:  # one invalid op must not reject the whole batch
            return SyncOpResult(
                op_id=op.op_id,
                status="error",
                entity_type=self._result_entity_type(op),
                uid=op.uid,
                error=str(exc),
            )

        self._remember_result(client_id, result)
        return result

    def _apply(self, op: SyncOp) -> SyncOpResult:
        raw_entity_type, action = op.kind.split(".", maxsplit=1)
        entity_type = cast("SyncBaseEntityType", raw_entity_type)
        if op.kind == "habit.record_set":
            return self._set_habit_record(op)
        if action == "create":
            return self._create(entity_type, op)
        if action == "update":
            return self._update(entity_type, op)
        if action == "delete":
            return self._delete(entity_type, op)
        raise ValueError(f"unsupported sync operation: {op.kind}")

    def _create(self, entity_type: SyncBaseEntityType, op: SyncOp) -> SyncOpResult:
        existing = self._find(entity_type, op.uid)
        if existing:
            # 创建已落库、但云端索引失败时，客户端重试同一操作应补建索引。
            if entity_type == "journal":
                self.journal_service.ensure_journal_index(existing.id)
            self._delete_tombstone(entity_type, op.uid)
            return self._result(op, entity_type, "applied", existing.id, existing)

        payload = _normalize_payload(op.payload)
        payload["uid"] = op.uid
        if entity_type == "todo":
            self._resolve_todo_parent(payload, op.depends_on)
            entity = self.todo_service.create_todo(TodoCreate.model_validate(payload))
        elif entity_type == "journal":
            entity = self.journal_service.create_journal(JournalCreate.model_validate(payload))
        elif entity_type == "habit":
            entity = self.habit_service.create_habit(HabitCreate.model_validate(payload))
        else:
            raise ValueError(f"unsupported entity type: {entity_type}")
        self._delete_tombstone(entity_type, op.uid)
        return SyncOpResult(
            op_id=op.op_id,
            status="applied",
            entity_type=entity_type,
            uid=op.uid,
            server_id=entity.id,
            entity=entity.model_dump(mode="json"),
        )

    def _update(self, entity_type: SyncBaseEntityType, op: SyncOp) -> SyncOpResult:
        existing = self._find(entity_type, op.uid)
        if not existing:
            raise ValueError(f"{entity_type} uid not found: {op.uid}")

        payload = _normalize_payload(op.payload)
        conflicted = bool(
            op.base_updated_at
            and _aware(existing.updated_at) > _aware(op.base_updated_at)
        )
        # Metadata uses timestamp LWW. A later queued client change wins;
        # otherwise return the newer server version untouched.
        if (
            conflicted
            and entity_type != "journal"
            and _aware(op.queued_at) <= _aware(existing.updated_at)
        ):
            return self._result(
                op,
                entity_type,
                "conflict",
                existing.id,
                existing,
                {"winner": "server"},
            )

        if entity_type == "todo":
            self._resolve_todo_parent(payload, op.depends_on)
            entity = self.todo_service.update_todo(existing.id, TodoUpdate.model_validate(payload))
        elif entity_type == "journal":
            if conflicted and "user_notes" in payload:
                client_text = payload.get("user_notes") or ""
                server_text = existing.user_notes or ""
                if server_text and server_text != client_text:
                    stamp = _aware(existing.updated_at).isoformat()
                    payload["user_notes"] = (
                        f"{client_text}\n\n---\n【同步冲突备份 {stamp}】\n{server_text}"
                    )
            entity = self.journal_service.update_journal(
                existing.id, JournalUpdate.model_validate(payload)
            )
        elif entity_type == "habit":
            entity = self.habit_service.update_habit(
                existing.id, HabitUpdate.model_validate(payload)
            )
        else:
            raise ValueError(f"unsupported entity type: {entity_type}")

        self._delete_tombstone(entity_type, op.uid)
        return SyncOpResult(
            op_id=op.op_id,
            status="conflict" if conflicted else "applied",
            entity_type=entity_type,
            uid=op.uid,
            server_id=entity.id,
            entity=entity.model_dump(mode="json"),
            conflict={"winner": "client"} if conflicted else None,
        )

    def _delete(self, entity_type: SyncBaseEntityType, op: SyncOp) -> SyncOpResult:
        existing = self._find(entity_type, op.uid)
        server_id = existing.id if existing else None
        if existing:
            if entity_type == "todo":
                self.todo_service.delete_todo(existing.id)
            elif entity_type == "journal":
                self.journal_service.delete_journal(existing.id)
            elif entity_type == "habit":
                self.habit_service.delete_habit(existing.id)
            else:
                raise ValueError(f"unsupported entity type: {entity_type}")
        self._upsert_tombstone(entity_type, op.uid)
        return SyncOpResult(
            op_id=op.op_id,
            status="applied",
            entity_type=entity_type,
            uid=op.uid,
            server_id=server_id,
        )

    def _set_habit_record(self, op: SyncOp) -> SyncOpResult:
        habit = self._find("habit", op.uid)
        if not habit:
            raise ValueError(f"habit uid not found: {op.uid}")
        if "date" not in op.payload or "recorded" not in op.payload:
            raise ValueError("habit.record_set requires date and recorded")
        record_date = _normalize_record_date(_parse_datetime(op.payload["date"]))
        recorded = bool(op.payload["recorded"])
        existing = self.habit_repository.get_record(habit.id, record_date)
        record_uid = f"{op.uid}:{record_date.date().isoformat()}"
        if recorded and not existing:
            existing = self.habit_repository.add_record(habit.id, record_date)
            self._delete_tombstone("habit_record", record_uid)
        elif not recorded and existing:
            self.habit_repository.remove_record(habit.id, record_date)
            existing = None
            self._upsert_tombstone("habit_record", record_uid)
        elif not recorded:
            self._upsert_tombstone("habit_record", record_uid)
        return SyncOpResult(
            op_id=op.op_id,
            status="applied",
            entity_type="habit_record",
            uid=op.uid,
            server_id=habit.id,
            entity={
                "habit_uid": op.uid,
                "habit_id": habit.id,
                "date": record_date.isoformat(),
                "recorded": recorded,
                "record": existing,
            },
        )

    def pull(self, since: datetime) -> SyncPullResponse:
        self.prune_old_sync_state()
        with self.db_base.get_session() as session:
            todos = (
                session.query(Todo)
                .filter(
                    col(Todo.user_id) == self.user_id,
                    col(Todo.deleted_at).is_(None),
                    col(Todo.updated_at) > since,
                )
                .order_by(col(Todo.updated_at).asc())
                .all()
            )
            journals = (
                session.query(Journal)
                .filter(
                    col(Journal.user_id) == self.user_id,
                    col(Journal.deleted_at).is_(None),
                    col(Journal.updated_at) > since,
                )
                .order_by(col(Journal.updated_at).asc())
                .all()
            )
            habits = (
                session.query(Habit)
                .filter(
                    col(Habit.user_id) == self.user_id,
                    col(Habit.deleted_at).is_(None),
                    col(Habit.updated_at) > since,
                )
                .order_by(col(Habit.updated_at).asc())
                .all()
            )
            records = (
                session.query(HabitRecord)
                .filter(
                    col(HabitRecord.deleted_at).is_(None),
                    col(HabitRecord.user_id) == self.user_id,
                    col(HabitRecord.created_at) > since,
                )
                .order_by(col(HabitRecord.created_at).asc())
                .all()
            )
            tombstones = (
                session.query(SyncTombstone)
                .filter(
                    col(SyncTombstone.user_id) == self.user_id,
                    col(SyncTombstone.deleted_at) > since,
                )
                .order_by(col(SyncTombstone.deleted_at).asc())
                .all()
            )
            habit_uids = {
                habit.id: habit.uid
                for habit in session.query(Habit)
                .filter(
                    col(Habit.user_id) == self.user_id,
                    col(Habit.id).in_([r.habit_id for r in records]),
                )
                .all()
            } if records else {}

            return SyncPullResponse(
                todos=[self._dump_model(row) for row in todos],
                journals=[self._dump_model(row) for row in journals],
                habits=[self._dump_model(row) for row in habits],
                habit_records=[
                    {
                        **self._dump_model(row),
                        "habit_uid": habit_uids.get(row.habit_id),
                    }
                    for row in records
                ],
                tombstones=[
                    SyncTombstoneResponse(
                        entity_type=row.entity_type,
                        uid=row.uid,
                        deleted_at=row.deleted_at,
                    )
                    for row in tombstones
                ],
                server_time=get_utc_now(),
            )

    def prune_old_sync_state(self, retention_days: int = 30) -> None:
        cutoff = get_utc_now() - timedelta(days=retention_days)
        with self.db_base.get_session() as session:
            session.query(SyncOpLog).filter(
                SyncOpLog.user_id == self.user_id,
                SyncOpLog.created_at < cutoff,
            ).delete(
                synchronize_session=False
            )
            session.query(SyncTombstone).filter(
                SyncTombstone.user_id == self.user_id,
                SyncTombstone.deleted_at < cutoff,
            ).delete(
                synchronize_session=False
            )

    def _find(self, entity_type: SyncBaseEntityType, uid: str) -> Any | None:
        model = _ENTITY_MODELS.get(entity_type)
        if model is None:
            raise ValueError(f"unsupported entity type: {entity_type}")
        with self.db_base.get_session() as session:
            row = session.query(model).filter_by(
                uid=uid,
                user_id=self.user_id,
                deleted_at=None,
            ).first()
            if row is not None:
                # DatabaseBase commits when the context exits. Detach first so
                # the already-loaded scalar values remain usable afterwards.
                session.expunge(row)
            return row

    def _resolve_todo_parent(self, payload: dict[str, Any], depends_on: list[str]) -> None:
        if not depends_on:
            return
        parent = self._find("todo", depends_on[0])
        if not parent:
            raise ValueError(f"unresolved todo dependency: {depends_on[0]}")
        payload["parent_todo_id"] = parent.id

    def _upsert_tombstone(self, entity_type: SyncEntityType, uid: str) -> None:
        now = get_utc_now()
        with self.db_base.get_session() as session:
            row = session.query(SyncTombstone).filter_by(
                user_id=self.user_id, entity_type=entity_type, uid=uid
            ).first()
            if row:
                row.deleted_at = now
            else:
                session.add(
                    SyncTombstone(
                        user_id=self.user_id,
                        entity_type=entity_type,
                        uid=uid,
                        deleted_at=now,
                    )
                )

    def _delete_tombstone(self, entity_type: SyncEntityType, uid: str) -> None:
        with self.db_base.get_session() as session:
            session.query(SyncTombstone).filter_by(
                user_id=self.user_id, entity_type=entity_type, uid=uid
            ).delete(synchronize_session=False)

    def _load_duplicate(self, client_id: str, op_id: str) -> SyncOpResult | None:
        with self.db_base.get_session() as session:
            row = session.query(SyncOpLog).filter_by(
                user_id=self.user_id,
                client_id=client_id,
                op_id=op_id,
            ).first()
            return SyncOpResult.model_validate_json(row.result_json) if row else None

    def _remember_result(self, client_id: str, result: SyncOpResult) -> None:
        with self.db_base.get_session() as session:
            session.add(
                SyncOpLog(
                    user_id=self.user_id,
                    client_id=client_id,
                    op_id=result.op_id,
                    result_json=result.model_dump_json(by_alias=True),
                )
            )

    @staticmethod
    def _dump_model(row: Any) -> dict[str, Any]:
        return row.model_dump(mode="json")

    @staticmethod
    def _result_entity_type(op: SyncOp) -> SyncEntityType:
        if op.kind == "habit.record_set":
            return "habit_record"
        return cast("SyncEntityType", op.kind.split(".", 1)[0])

    @classmethod
    def _result(
        cls,
        op: SyncOp,
        entity_type: SyncEntityType,
        status: SyncResultStatus,
        server_id: int,
        entity: Any,
        conflict: dict[str, Any] | None = None,
    ) -> SyncOpResult:
        return SyncOpResult(
            op_id=op.op_id,
            status=status,
            entity_type=entity_type,
            uid=op.uid,
            server_id=server_id,
            entity=cls._dump_model(entity),
            conflict=conflict,
        )
