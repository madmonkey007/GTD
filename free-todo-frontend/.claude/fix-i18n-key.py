#!/usr/bin/env python3
"""Add removeLinkedTodo i18n key to both zh.json and en.json."""

import os

BASE = "D:\\manus\\FreeTodo\\free-todo-frontend\\lib\\i18n\\messages"

for lang, val in [("zh.json", "移除"), ("en.json", "Remove")]:
    path = os.path.join(BASE, lang)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old = f'"expand": "{("展开" if lang == "zh.json" else "Expand")}",'
    new = old + f'\n\t\t"removeLinkedTodo": "{val}",'

    if old in content:
        content = content.replace(old, new)
        print(f"OK {lang}: added removeLinkedTodo key")
    else:
        print(f"FAIL {lang}: pattern not matched")
        idx = content.find('"expand"')
        if idx >= 0:
            print(f"  Found at {idx}: {repr(content[idx:idx+40])}")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("=== Done ===")
