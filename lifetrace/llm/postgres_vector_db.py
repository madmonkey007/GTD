"""Neon pgvector-backed journal search for the serverless cloud runtime."""

from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import text

from lifetrace.llm.cloud_embeddings import CloudEmbeddingClient
from lifetrace.util.logging_config import get_logger

logger = get_logger()


class PostgresVectorDatabase:
    """Store only journal embeddings in PostgreSQL, scoped by LifeTrace user."""

    # 云端向量索引是同步链路的一环：失败必须向调用者传播，
    # 由上层决定是否报告为可重试错误（桌面 ChromaDB 路径为 False，只记日志）。
    propagate_index_errors = True

    def __init__(self, database: Any, embedding_client: CloudEmbeddingClient | None = None) -> None:
        self.database = database
        self.embedding_client = embedding_client or CloudEmbeddingClient()

    @staticmethod
    def _build_journal_text(name: str, user_notes: str, tags: list[Any] | None) -> str:
        parts: list[str] = []
        if name and name.strip():
            parts.append(name.strip())
        tag_names: list[str] = []
        for tag in tags or []:
            if isinstance(tag, str):
                tag_names.append(tag)
            elif isinstance(tag, dict):
                value = tag.get("tag_name") or tag.get("name")
                if value:
                    tag_names.append(str(value))
            else:
                value = getattr(tag, "tag_name", None) or getattr(tag, "name", None)
                if value:
                    tag_names.append(str(value))
        if tag_names:
            parts.append(" ".join(f"#{tag}" for tag in tag_names))
        if user_notes and user_notes.strip():
            parts.append(user_notes.strip())
        return "\n".join(parts)

    @staticmethod
    def _vector_literal(embedding: list[float]) -> str:
        return "[" + ",".join(str(value) for value in embedding) + "]"

    def upsert_journal(
        self,
        user_id: int,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[Any] | None = None,
    ) -> bool:
        content = self._build_journal_text(name, user_notes, tags)
        if not content.strip() or not self.embedding_client.is_available():
            return False
        embedding = self.embedding_client.embed_text(content)
        if not embedding:
            return False
        try:
            with self.database.get_session() as session:
                session.execute(
                    text(
                        """
                        INSERT INTO journal_vectors (user_id, journal_id, content_hash, content, embedding)
                        VALUES (:user_id, :journal_id, :content_hash, :content,
                                CAST(:embedding AS vector))
                        ON CONFLICT (user_id, journal_id) DO UPDATE SET
                            content_hash = EXCLUDED.content_hash,
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            updated_at = CURRENT_TIMESTAMP
                        """
                    ),
                    {
                        "user_id": user_id,
                        "journal_id": journal_id,
                        "content_hash": hashlib.sha256(content.encode()).hexdigest(),
                        "content": content,
                        "embedding": self._vector_literal(embedding),
                    },
                )
            return True
        except Exception as exc:
            raise RuntimeError(f"Failed to index journal {journal_id} in pgvector: {exc}") from exc

    def delete_journal(self, user_id: int, journal_id: int) -> bool:
        try:
            with self.database.get_session() as session:
                session.execute(
                    text("DELETE FROM journal_vectors WHERE user_id = :user_id AND journal_id = :journal_id"),
                    {"user_id": user_id, "journal_id": journal_id},
                )
            return True
        except Exception as exc:
            raise RuntimeError(
                f"Failed to delete journal {journal_id} from pgvector: {exc}"
            ) from exc

    def search_similar_journals(
        self,
        user_id: int,
        query_text: str,
        top_k: int = 20,
        exclude_journal_id: int | None = None,
    ) -> list[dict[str, Any]]:
        if not query_text.strip() or not self.embedding_client.is_available():
            return []
        embedding = self.embedding_client.embed_text(query_text)
        if not embedding:
            return []
        try:
            with self.database.get_session() as session:
                rows = session.execute(
                    text(
                        """
                        SELECT journal_id, content AS document,
                               1 - (embedding <=> CAST(:embedding AS vector)) AS score
                        FROM journal_vectors
                        WHERE user_id = :user_id
                          AND (:exclude_journal_id IS NULL OR journal_id != :exclude_journal_id)
                        ORDER BY embedding <=> CAST(:embedding AS vector)
                        LIMIT :top_k
                        """
                    ),
                    {
                        "user_id": user_id,
                        "embedding": self._vector_literal(embedding),
                        "exclude_journal_id": exclude_journal_id,
                        "top_k": top_k,
                    },
                ).mappings().all()
            return [
                {
                    "journal_id": int(row["journal_id"]),
                    "document": row["document"],
                    "distance": None,
                    "score": float(row["score"]),
                }
                for row in rows
            ]
        except Exception as exc:
            logger.warning(f"Failed to search pgvector journals: {exc}")
            return []
