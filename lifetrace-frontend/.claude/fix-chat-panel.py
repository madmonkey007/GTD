#!/usr/bin/env python3
"""Remove hasSelection/onClearSelection from ChatPanel props."""

import os

BASE = "D:\\manus\\FreeTodo\\lifetrace-frontend"
path = os.path.join(BASE, "apps/chat/ChatPanel.tsx")

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changes = 0

# Remove clearTodoSelection from useTodoStore destructuring
old_dest = '\tconst { selectedTodoIds, clearTodoSelection, toggleTodoSelection } ='
new_dest = '\tconst { selectedTodoIds, toggleTodoSelection } ='

if old_dest in c:
    c = c.replace(old_dest, new_dest)
    changes += 1
    print("OK: removed clearTodoSelection from store destructuring")
else:
    print("FAIL: clearTodoSelection destructuring not matched")

# Remove hasSelection prop (4 tabs)
old_has = '\t\t\t\thasSelection={chatController.hasSelection}\n\t\t\t\tshowTodosExpanded={showTodosExpanded}'
new_has = '\t\t\t\tshowTodosExpanded={showTodosExpanded}'

if old_has in c:
    c = c.replace(old_has, new_has)
    changes += 1
    print("OK: removed hasSelection prop")
else:
    print("FAIL: hasSelection prop not matched")
    idx = c.find('hasSelection={')
    if idx >= 0:
        print(f"  Context: {repr(c[idx-30:idx+60])}")

# Remove onClearSelection prop (4 tabs)
old_clear = '\t\t\t\tonClearSelection={clearTodoSelection}\n\t\t\t\tonToggleTodo={toggleTodoSelection}'
new_clear = '\t\t\t\tonToggleTodo={toggleTodoSelection}'

if old_clear in c:
    c = c.replace(old_clear, new_clear)
    changes += 1
    print("OK: removed onClearSelection prop")
else:
    print("FAIL: onClearSelection prop not matched")
    idx = c.find('onClearSelection={')
    if idx >= 0:
        print(f"  Context: {repr(c[idx-30:idx+60])}")

if changes > 0:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"OK ChatPanel.tsx saved ({changes} changes)")
else:
    print("FAIL: No changes")

print("=== Done ===")
