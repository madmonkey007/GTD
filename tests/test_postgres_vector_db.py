from __future__ import annotations

from contextlib import contextmanager

import pytest

from lifetrace.llm.postgres_vector_db import PostgresVectorDatabase


class _EmbeddingClient:
    def is_available(self) -> bool:
        return True

    def embed_text(self, _text: str) -> list[float]:
        return [0.25, 0.75]


class _Result:
    def mappings(self):
        return self

    def all(self):
        return [{"journal_id": 9, "document": "匹配笔记", "score": 0.8}]


class _Session:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def execute(self, statement, params):
        self.calls.append((str(statement), params))
        if "SELECT" in str(statement):
            return _Result()
        return None


class _Database:
    def __init__(self) -> None:
        self.session = _Session()

    @contextmanager
    def get_session(self):
        yield self.session


def test_postgres_journal_vectors_are_scoped_to_one_user() -> None:
    user_id = 7
    database = _Database()
    vector_db = PostgresVectorDatabase(database, embedding_client=_EmbeddingClient())

    assert vector_db.upsert_journal(user_id, 42, "标题", "正文", ["标签"])
    hits = vector_db.search_similar_journals(user_id, "查询", exclude_journal_id=42)

    assert hits == [{"journal_id": 9, "document": "匹配笔记", "distance": None, "score": 0.8}]
    assert all(params["user_id"] == user_id for _, params in database.session.calls)
    assert "ON CONFLICT (user_id, journal_id)" in database.session.calls[0][0]
    assert "embedding <=> CAST(:embedding AS vector)" in database.session.calls[1][0]


class _BrokenDatabase(_Database):
    @contextmanager
    def get_session(self):
        raise RuntimeError("neon connection refused")
        yield  # pragma: no cover


def test_postgres_index_errors_propagate_for_retryable_sync() -> None:
    vector_db = PostgresVectorDatabase(_BrokenDatabase(), embedding_client=_EmbeddingClient())

    assert vector_db.propagate_index_errors is True
    with pytest.raises(RuntimeError, match="neon connection refused"):
        vector_db.upsert_journal(7, 42, "标题", "正文", ["标签"])
    with pytest.raises(RuntimeError, match="neon connection refused"):
        vector_db.delete_journal(7, 42)
