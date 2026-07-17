#!/usr/bin/env python3
"""一次性脚本：把所有历史笔记批量索引到向量库

用法：
    cd lifetrace
    python scripts/index_journals.py

会把数据库里所有未删除的笔记 embed 后写入 ChromaDB 的 lifetrace_journal 集合。
已存在的笔记会先删后加（幂等，可重复运行）。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# 让脚本能直接 import lifetrace
# 脚本在 lifetrace/scripts/ 下，上级目录（项目根）需要加入 sys.path
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_REPO_ROOT))

from lifetrace.llm.vector_db import create_vector_db  # noqa: E402
from lifetrace.storage import get_session  # noqa: E402
from lifetrace.storage.models import Journal  # noqa: E402
from lifetrace.storage.sql_utils import col  # noqa: E402
from lifetrace.storage.journal_manager import JournalManager  # noqa: E402
from lifetrace.storage.database import db_base  # noqa: E402


def main() -> None:
    vector_db = create_vector_db()
    if vector_db is None:
        print("向量库不可用（chromadb 未安装或 vector_db.enabled=false）")
        sys.exit(1)

    # 取所有未删除笔记
    with get_session() as session:
        journals = (
            session.query(Journal)
            .filter(col(Journal.deleted_at).is_(None))
            .order_by(col(Journal.id).asc())
            .all()
        )
        total = len(journals)
        print(f"共 {total} 条笔记待索引")

        # 用 JournalManager 取 tags（复用现有逻辑）
        mgr = JournalManager(db_base)

        ok = 0
        fail = 0
        skip = 0
        t0 = time.time()
        for i, j in enumerate(journals, 1):
            notes = j.user_notes or ""
            name = j.name or ""
            if not notes.strip() and not name.strip():
                skip += 1
                continue
            try:
                tags = mgr._get_tags_for_journal(session, j.id)
                success = vector_db.upsert_journal(j.id, name, notes, tags)
                if success:
                    ok += 1
                else:
                    fail += 1
            except Exception as e:  # noqa: BLE001
                print(f"  笔记 {j.id} 失败: {e}")
                fail += 1

            # 进度
            if i % 10 == 0 or i == total:
                elapsed = time.time() - t0
                print(f"  进度 {i}/{total}  成功 {ok}  失败 {fail}  跳过 {skip}  用时 {elapsed:.1f}s")

    print(f"\n完成：成功 {ok}，失败 {fail}，跳过 {skip}（空内容）")


if __name__ == "__main__":
    main()
