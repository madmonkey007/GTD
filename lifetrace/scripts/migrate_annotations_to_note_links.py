"""迁移批注（journal_note_relations）到笔记链接（note_links）

- 读取所有 journal_note_relations（未删除的）
- 写入 note_links：relation_type='SUPPORTS'
- 跳过已存在的组合避免重复
"""

import sys
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "lifetrace" / "data" / "lifetrace.db"

if not DB_PATH.exists():
    print(f"Database not found: {DB_PATH}")
    sys.exit(1)

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Read all active annotations
cur.execute(
    "SELECT journal_id, note_id, created_at FROM journal_note_relations WHERE deleted_at IS NULL"
)
rows = cur.fetchall()
print(f"Found {len(rows)} annotations to migrate")

# Build existing NoteLinks set to avoid duplicates
cur.execute(
    "SELECT source_note_id, target_note_id FROM note_links WHERE deleted_at IS NULL"
)
existing = {(r["source_note_id"], r["target_note_id"]) for r in cur.fetchall()}

inserted = 0
skipped = 0
for row in rows:
    sid, tid, created_at = row["journal_id"], row["note_id"], row["created_at"]
    if (sid, tid) in existing:
        print(f"  SKIP  (already exists): journal #{sid} -> note #{tid}")
        skipped += 1
        continue
    cur.execute(
        "INSERT INTO note_links (source_note_id, target_note_id, relation_type, user_note, created_at) VALUES (?, ?, 'SUPPORTS', NULL, ?)",
        (sid, tid, created_at),
    )
    inserted += 1
    print(f"  OK    journal #{sid} -> note #{tid} (SUPPORTS)")

cur.execute("SELECT COUNT(*) FROM note_links WHERE deleted_at IS NULL")
total = cur.fetchone()[0]

conn.commit()
conn.close()

print(f"\nDone! Inserted: {inserted}, Skipped (duplicate): {skipped}")
print(f"Active note_links now: {total}")
