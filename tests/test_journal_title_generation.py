from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest

from lifetrace.schemas.journal import JournalCreate, JournalUpdate
from lifetrace.services.journal_service import JournalService


class FakeJournalRepository:
    def __init__(self, *, name: str = "2026-09-05 10:30", notes: str = "正文"):
        self.user_id = 1
        self.row = {
            "id": 1,
            "uid": "journal-1",
            "name": name,
            "user_notes": notes,
            "date": datetime(2026, 9, 5, 10, 30),
            "content_format": "markdown",
            "content_objective": None,
            "content_ai": None,
            "mood": None,
            "energy": None,
            "day_bucket_start": None,
            "created_at": datetime(2026, 9, 5, 10, 30),
            "updated_at": datetime(2026, 9, 5, 10, 30),
            "deleted_at": None,
            "origin": "manual",
            "tags": [],
            "related_todo_ids": [],
            "related_activity_ids": [],
            "related_note_ids": [],
            "related_todos": [],
        }

    def get_by_id(self, journal_id: int):
        return dict(self.row) if journal_id == self.row["id"] else None

    def get_by_uid(self, uid: str):
        return None

    def create(self, payload):
        self.row.update(
            name=payload.name,
            user_notes=payload.user_notes,
            date=payload.date,
        )
        return self.row["id"]

    def update(self, journal_id: int, payload):
        if journal_id != self.row["id"]:
            return False
        for key in ("name", "user_notes", "date"):
            value = getattr(payload, key)
            if value.__class__ is not object:
                self.row[key] = value
        return True

    def update_title_if_unchanged(
        self, journal_id: int, expected_name: str, generated_name: str
    ) -> bool:
        if journal_id != self.row["id"] or self.row["name"] != expected_name:
            return False
        self.row["name"] = generated_name
        return True


def make_service(repository: FakeJournalRepository) -> JournalService:
    service = object.__new__(JournalService)
    service.repository = repository
    service.db_base = SimpleNamespace()
    service.user_id = 1
    service.journal_manager = SimpleNamespace()
    service._vector_db = None
    service._sync_service = None
    service._index_journal_async = lambda *args, **kwargs: None
    return service


def test_create_and_update_do_not_start_title_generation(monkeypatch: pytest.MonkeyPatch):
    repository = FakeJournalRepository(name="Untitled")
    service = make_service(repository)

    def unexpected_generation(*args, **kwargs):
        raise AssertionError("journal persistence must not call the title model")

    monkeypatch.setattr(
        service, "_maybe_generate_ai_title", unexpected_generation, raising=False
    )

    created = service.create_journal(
        JournalCreate(user_notes="新正文", date=datetime(2026, 9, 5, 10, 30))
    )
    updated = service.update_journal(
        created.id,
        JournalUpdate(user_notes="修改后的正文"),
    )

    assert created.id == 1
    assert updated.user_notes == "修改后的正文"


@pytest.mark.parametrize("name", ["Untitled", "2026-09-05 10:30", ""])
def test_generate_title_replaces_only_pseudo_titles(
    name: str, monkeypatch: pytest.MonkeyPatch
):
    repository = FakeJournalRepository(name=name)
    service = make_service(repository)
    monkeypatch.setattr(service, "_request_ai_title", lambda content: "完整标题")

    result = service.generate_ai_title(1)

    assert result.name == "完整标题"


def test_generate_title_leaves_real_title_unchanged(monkeypatch: pytest.MonkeyPatch):
    repository = FakeJournalRepository(name="用户标题")
    service = make_service(repository)
    monkeypatch.setattr(
        service,
        "_request_ai_title",
        lambda content: pytest.fail("real titles must not call the model"),
    )

    result = service.generate_ai_title(1)

    assert result.name == "用户标题"


def test_generate_title_does_not_overwrite_manual_title_added_during_request(
    monkeypatch: pytest.MonkeyPatch,
):
    repository = FakeJournalRepository()
    service = make_service(repository)

    def generate(_content: str) -> str:
        repository.row["name"] = "用户刚写的标题"
        return "AI 标题"

    monkeypatch.setattr(service, "_request_ai_title", generate)

    result = service.generate_ai_title(1)

    assert result.name == "用户刚写的标题"


def test_cloud_title_channel_reuses_dashscope_key(monkeypatch: pytest.MonkeyPatch):
    repository = FakeJournalRepository()
    service = make_service(repository)
    monkeypatch.setenv("DASHSCOPE_API_KEY", "dashscope-secret")

    channels = service._get_title_channels()

    assert channels[0] == {
        "api_key": "dashscope-secret",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-turbo",
    }
