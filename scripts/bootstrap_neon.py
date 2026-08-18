"""Create LifeTrace's SQLModel tables and pgvector journal index in a fresh Neon database."""

from __future__ import annotations

import importlib
import os

from sqlalchemy import text

importlib.import_module("lifetrace.storage.models")

from lifetrace.storage.database_base import DatabaseBase  # noqa: E402


def main() -> None:
    database = DatabaseBase()
    if database.engine is None:
        raise RuntimeError("Database engine is not initialized")
    if database.engine.dialect.name != "postgresql":
        raise RuntimeError("bootstrap_neon.py requires a PostgreSQL DATABASE_URL")
    with database.engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS journal_vectors (
                    user_id INTEGER NOT NULL,
                    journal_id INTEGER NOT NULL,
                    content_hash VARCHAR(64) NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector NOT NULL,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, journal_id)
                )
                """
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_journal_vectors_user_id "
                "ON journal_vectors (user_id)"
            )
        )
    print("Neon bootstrap completed")


if __name__ == "__main__":
    main()
