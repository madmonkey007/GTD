"""Regression tests for the idempotent local-to-cloud data reconciliation."""

from sqlalchemy import create_engine, text

from scripts.migrate_local_to_neon import migrate

SCHEMA = """
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE todos (id INTEGER PRIMARY KEY, uid TEXT NOT NULL, user_id INTEGER NOT NULL, is_inbox BOOLEAN NOT NULL);
CREATE TABLE journals (id INTEGER PRIMARY KEY, uid TEXT NOT NULL, user_id INTEGER NOT NULL);
CREATE TABLE projects (id INTEGER PRIMARY KEY, uid TEXT NOT NULL, user_id INTEGER NOT NULL, project_type TEXT NOT NULL);
CREATE TABLE tags (id INTEGER PRIMARY KEY, tag_name TEXT NOT NULL UNIQUE, created_at DATETIME, deleted_at DATETIME);
CREATE TABLE todo_tag_relations (id INTEGER PRIMARY KEY, todo_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME);
CREATE TABLE journal_tag_relations (id INTEGER PRIMARY KEY, journal_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME);
CREATE TABLE project_todo_relations (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, todo_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME);
CREATE TABLE project_note_relations (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, journal_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME);
CREATE TABLE journal_todo_relations (id INTEGER PRIMARY KEY, journal_id INTEGER NOT NULL, todo_id INTEGER NOT NULL, created_at DATETIME, deleted_at DATETIME, role TEXT);
"""


def _engine(path):
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as connection:
        for statement in SCHEMA.split(";"):
            if statement.strip():
                connection.execute(text(statement))
    return engine


def test_migration_reconciles_new_fields_and_tags_without_duplicates(tmp_path):
    source = _engine(tmp_path / "source.db")
    target = _engine(tmp_path / "target.db")
    with source.begin() as connection:
        connection.execute(text("INSERT INTO users VALUES (2, 'user@example.com')"))
        connection.execute(text("INSERT INTO todos VALUES (10, 'todo-1', 2, 1)"))
        connection.execute(text("INSERT INTO journals VALUES (20, 'journal-1', 2)"))
        connection.execute(text("INSERT INTO projects VALUES (30, 'project-1', 2, 'checklist')"))
        connection.execute(text("INSERT INTO tags VALUES (40, '重要', NULL, NULL)"))
        connection.execute(
            text("INSERT INTO tags VALUES (41, :name, NULL, NULL)"),
            {"name": "误识别为标签的长文本" * 10},
        )
        connection.execute(text("INSERT INTO todo_tag_relations VALUES (50, 10, 40, NULL, NULL)"))
        connection.execute(text("INSERT INTO todo_tag_relations VALUES (51, 10, 41, NULL, NULL)"))
        connection.execute(text("INSERT INTO journal_tag_relations VALUES (60, 20, 40, NULL, NULL)"))
    with target.begin() as connection:
        connection.execute(text("INSERT INTO users VALUES (7, 'user@example.com')"))
        connection.execute(text("INSERT INTO todos VALUES (110, 'todo-1', 7, 0)"))
        connection.execute(text("INSERT INTO journals VALUES (120, 'journal-1', 7)"))
        connection.execute(text("INSERT INTO projects VALUES (130, 'project-1', 7, 'project')"))

    migrate(source, target, "user@example.com", apply=True)
    migrate(source, target, "user@example.com", apply=True)

    with target.connect() as connection:
        assert connection.execute(text("SELECT is_inbox FROM todos")).scalar_one() == 1
        assert connection.execute(text("SELECT project_type FROM projects")).scalar_one() == "checklist"
        assert connection.execute(text("SELECT count(*) FROM tags")).scalar_one() == 1
        assert connection.execute(text("SELECT count(*) FROM todo_tag_relations")).scalar_one() == 1
        assert connection.execute(text("SELECT count(*) FROM journal_tag_relations")).scalar_one() == 1
