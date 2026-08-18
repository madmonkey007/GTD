"""Reconcile one local user's core LifeTrace data into the cloud database.

Run without ``--apply`` for a preview. Re-running with ``--apply`` is safe:
entities are matched by user and UID, while relations are matched by their
foreign-key pair.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy import MetaData, create_engine, select

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

CORE = ("journals", "todos", "projects")
CORE_RELATIONS = (
    "project_todo_relations",
    "project_note_relations",
    "journal_todo_relations",
)
TAG_RELATIONS = ("todo_tag_relations", "journal_tag_relations")
TABLES = ("users", *CORE, "tags", *CORE_RELATIONS, *TAG_RELATIONS)
RECONCILE_FIELDS = {"todos": ("is_inbox",), "projects": ("project_type",)}


def _values_for_target(row: dict, table, excluded: set[str]) -> dict:
    return {key: value for key, value in row.items() if key in table.c and key not in excluded}


def _insert_relation_once(connection, table, values: dict, identity: tuple[str, ...]) -> None:
    conditions = [table.c[key] == values[key] for key in identity]
    existing = connection.execute(select(table.c.id).where(*conditions)).scalar_one_or_none()
    if existing is None:
        connection.execute(table.insert().values(**values))


def migrate(  # noqa: C901, PLR0912, PLR0915
    source: Engine, target: Engine, email: str, *, apply: bool
) -> None:
    src_meta, dst_meta = MetaData(), MetaData()
    src_meta.reflect(bind=source, only=TABLES)
    dst_meta.reflect(bind=target, only=TABLES)

    with source.connect() as src, target.connect() as dst:
        src_users = src_meta.tables["users"]
        dst_users = dst_meta.tables["users"]
        local_user = src.execute(
            select(src_users).where(src_users.c.email == email)
        ).mappings().first()
        if not local_user:
            raise SystemExit(f"本地没有用户: {email}")
        cloud_user = dst.execute(
            select(dst_users.c.id).where(dst_users.c.email == email)
        ).scalar_one_or_none()
        if cloud_user is None:
            raise SystemExit(f"云端没有用户: {email}，请先注册登录")
        rows = {
            name: src.execute(
                select(src_meta.tables[name]).where(
                    src_meta.tables[name].c.user_id == local_user["id"]
                )
            ).mappings().all()
            for name in CORE
        }

    print("迁移预览:", ", ".join(f"{name}={len(items)}" for name, items in rows.items()))
    if not apply:
        print("预览模式：加 --apply 才会写入云端")
        return

    ids: dict[str, dict[int, int]] = {name: {} for name in CORE}
    with source.connect() as src, target.begin() as dst:
        for name in CORE:
            table = dst_meta.tables[name]
            for source_row in rows[name]:
                row = dict(source_row)
                existing = dst.execute(
                    select(table.c.id).where(
                        table.c.uid == row["uid"], table.c.user_id == cloud_user
                    )
                ).scalar_one_or_none()
                if existing is None:
                    values = _values_for_target(row, table, {"id", "user_id"})
                    values["user_id"] = cloud_user
                    if name == "todos" and "parent_todo_id" in values:
                        values["parent_todo_id"] = None
                    existing = dst.execute(
                        table.insert().values(**values).returning(table.c.id)
                    ).scalar_one()
                else:
                    updates = {
                        field: row[field]
                        for field in RECONCILE_FIELDS.get(name, ())
                        if field in row and field in table.c
                    }
                    if updates:
                        dst.execute(table.update().where(table.c.id == existing).values(**updates))
                ids[name][row["id"]] = existing

        todo_table = dst_meta.tables["todos"]
        if "parent_todo_id" in todo_table.c:
            for row in rows["todos"]:
                parent_id = ids["todos"].get(row.get("parent_todo_id"))
                dst.execute(
                    todo_table.update()
                    .where(todo_table.c.id == ids["todos"][row["id"]])
                    .values(parent_todo_id=parent_id)
                )

        entity_id_columns = {
            "project_id": "projects",
            "todo_id": "todos",
            "journal_id": "journals",
        }
        for name in CORE_RELATIONS:
            src_table, dst_table = src_meta.tables[name], dst_meta.tables[name]
            identity = tuple(key for key in entity_id_columns if key in dst_table.c)
            for source_row in src.execute(select(src_table)).mappings():
                values = _values_for_target(dict(source_row), dst_table, {"id"})
                for key in identity:
                    values[key] = ids[entity_id_columns[key]].get(values[key])
                if any(values[key] is None for key in identity):
                    continue
                _insert_relation_once(dst, dst_table, values, identity)

        tag_ids: dict[int, int] = {}
        source_entity_ids = {name: set(mapping) for name, mapping in ids.items()}
        relevant_tag_relations: dict[str, list[dict]] = {}
        for name, entity_name, id_column in (
            ("todo_tag_relations", "todos", "todo_id"),
            ("journal_tag_relations", "journals", "journal_id"),
        ):
            rel_rows = [
                dict(row)
                for row in src.execute(select(src_meta.tables[name])).mappings()
                if row[id_column] in source_entity_ids[entity_name]
            ]
            relevant_tag_relations[name] = rel_rows
            for row in rel_rows:
                source_tag_id = row["tag_id"]
                if source_tag_id in tag_ids:
                    continue
                src_tag = src.execute(
                    select(src_meta.tables["tags"]).where(
                        src_meta.tables["tags"].c.id == source_tag_id
                    )
                ).mappings().one()
                dst_tags = dst_meta.tables["tags"]
                target_tag_id = dst.execute(
                    select(dst_tags.c.id).where(dst_tags.c.tag_name == src_tag["tag_name"])
                ).scalar_one_or_none()
                if target_tag_id is None:
                    values = _values_for_target(dict(src_tag), dst_tags, {"id"})
                    target_tag_id = dst.execute(
                        dst_tags.insert().values(**values).returning(dst_tags.c.id)
                    ).scalar_one()
                tag_ids[source_tag_id] = target_tag_id

        for name, entity_name, id_column in (
            ("todo_tag_relations", "todos", "todo_id"),
            ("journal_tag_relations", "journals", "journal_id"),
        ):
            dst_table = dst_meta.tables[name]
            for row in relevant_tag_relations[name]:
                values = _values_for_target(row, dst_table, {"id"})
                values[id_column] = ids[entity_name][row[id_column]]
                values["tag_id"] = tag_ids[row["tag_id"]]
                _insert_relation_once(dst, dst_table, values, (id_column, "tag_id"))

    print("云端数据校准完成（含收集箱状态、项目类型和标签）")


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
    target = create_engine(database_url, pool_pre_ping=True)
    try:
        migrate(source, target, args.email, apply=args.apply)
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    main()
