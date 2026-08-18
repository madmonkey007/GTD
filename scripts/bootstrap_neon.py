"""Create LifeTrace's SQLModel tables and pgvector journal index in a fresh Neon database."""

from __future__ import annotations

import importlib
import os

from sqlalchemy import create_engine, text

importlib.import_module("lifetrace.storage.models")

from lifetrace.storage.database_base import DatabaseBase  # noqa: E402


def _prepare_alembic_version_table() -> None:
    """Allow repository revision identifiers longer than Alembic's default 32 chars."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    engine = create_engine(database_url, pool_pre_ping=True)
    if engine.dialect.name != "postgresql":
        engine.dispose()
        raise RuntimeError("bootstrap_neon.py requires a PostgreSQL DATABASE_URL")
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS alembic_version "
                    "(version_num VARCHAR(128) NOT NULL)"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE alembic_version "
                    "ALTER COLUMN version_num TYPE VARCHAR(128)"
                )
            )
    finally:
        engine.dispose()


def main() -> None:
    _prepare_alembic_version_table()
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
