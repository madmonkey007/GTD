#!/usr/bin/env python3
"""Remove hasSelection/onClearSelection from ChatInputSection destructuring."""

import os

BASE = "D:\\manus\\FreeTodo\\lifetrace-frontend"
path = os.path.join(BASE, "apps/chat/components/input/ChatInputSection.tsx")

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

# Remove hasSelection from destructuring params (single tab)
old_dest = '\thasSelection,\n\tshowTodosExpanded,'
new_dest = '\tshowTodosExpanded,'

if old_dest in c:
    c = c.replace(old_dest, new_dest)
    changes += 1
    print("OK: removed hasSelection from destructuring")
else:
    print("FAIL: hasSelection in destructuring not matched")

# Remove onClearSelection from destructuring (single tab)
old_dest2 = '\tonClearSelection,\n\tonToggleTodo,'
new_dest2 = '\tonToggleTodo,'

if old_dest2 in c:
    c = c.replace(old_dest2, new_dest2)
    changes += 1
    print("OK: removed onClearSelection from destructuring")
else:
    print("FAIL: onClearSelection in destructuring not matched")

if changes > 0:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"OK ChatInputSection.tsx saved ({changes} changes)")
else:
    print("FAIL: No changes to ChatInputSection.tsx")

print("=== Done ===")
