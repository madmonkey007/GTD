"""Copy one local user's core data into Neon without exposing credentials.

Usage:
  PYTHONPATH=. uv run python scripts/migrate_local_to_neon.py --email user@example.com
  PYTHONPATH=. uv run python scripts/migrate_local_to_neon.py --email user@example.com --apply
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from sqlalchemy import MetaData, create_engine, select, text

CORE = ("journals", "todos", "projects")
RELATIONS = ("project_todo_relations", "project_note_relations", "journal_todo_relations")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--source", default="lifetrace/data/lifetrace.db")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL 未设置")

    source = create_engine(f"sqlite:///{Path(args.source).resolve()}")
    target = create_engine(database_url)
    src_meta, dst_meta = MetaData(), MetaData()
    src_meta.reflect(bind=source, only=("users", *CORE, *RELATIONS))
    dst_meta.reflect(bind=target, only=("users", *CORE, *RELATIONS))
    with source.connect() as src, target.connect() as dst:
        local_user = src.execute(select(src_meta.tables["users"]).where(src_meta.tables["users"].c.email == args.email)).mappings().first()
        if not local_user:
            raise SystemExit(f"本地没有用户: {args.email}")
        cloud_user = dst.execute(select(dst_meta.tables["users"].c.id).where(dst_meta.tables["users"].c.email == args.email)).scalar_one_or_none()
        if cloud_user is None:
            raise SystemExit(f"Neon 没有用户: {args.email}，请先注册登录")
        rows = {name: src.execute(select(src_meta.tables[name]).where(src_meta.tables[name].c.user_id == local_user["id"])).mappings().all() for name in CORE}
        print("迁移预览:", ", ".join(f"{name}={len(items)}" for name, items in rows.items()))
        if not args.apply:
            print("预览模式：加 --apply 才会写入 Neon")
            return
        ids: dict[str, dict[int, int]] = {name: {} for name in CORE}
        with target.begin() as tx:
            for name in CORE:
                table = dst_meta.tables[name]
                for row in rows[name]:
                    values = {k: v for k, v in row.items() if k not in {"id", "user_id"}}
                    values["user_id"] = cloud_user
                    uid = row.get("uid")
                    existing = tx.execute(select(table.c.id).where(table.c.uid == uid)).scalar_one_or_none()
                    if existing is None:
                        existing = tx.execute(table.insert().values(**values).returning(table.c.id)).scalar_one()
                    ids[name][row["id"]] = existing
            for name in RELATIONS:
                table = dst_meta.tables[name]
                for row in src.execute(select(src_meta.tables[name])).mappings():
                    values = {k: v for k, v in row.items() if k != "id"}
                    if "project_id" in values:
                        values["project_id"] = ids["projects"].get(values["project_id"])
                    if "todo_id" in values:
                        values["todo_id"] = ids["todos"].get(values["todo_id"])
                    if "journal_id" in values:
                        values["journal_id"] = ids["journals"].get(values["journal_id"])
                    if any(values.get(key) is None for key in ("project_id", "todo_id", "journal_id") if key in values):
                        continue
                    tx.execute(table.insert().values(**values))
        print("Neon 迁移完成")


if __name__ == "__main__":
    main()
