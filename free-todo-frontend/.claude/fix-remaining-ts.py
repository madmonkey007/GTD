#!/usr/bin/env python3
"""Fix remaining TS errors from chat input optimization."""

import os

BASE = "D:\\manus\\FreeTodo\\free-todo-frontend"

# ============================================================
# 1. ChatInputSection.tsx - Remove duplicate props
# ============================================================
path1 = os.path.join(BASE, "apps/chat/components/input/ChatInputSection.tsx")
with open(path1, 'r', encoding='utf-8') as f:
    c = f.read()

# The duplicate showSuggestions/onSelectPrompt are right before };
# Use single-tab \t for indentation
old_dup = '\tshowSuggestions: boolean;\n\tonSelectPrompt: (prompt: string) => void;\n};'
new_dup = '};'

if old_dup in c:
    c = c.replace(old_dup, new_dup)
    print("OK ChatInputSection: removed duplicate showSuggestions/onSelectPrompt")
else:
    print("FAIL ChatInputSection: duplicate pattern not matched")
    idx = c.find('showSuggestions: boolean;')
    if idx >= 0:
        print(f"  First at {idx}, looking around next occurrence...")
        idx2 = c.find('showSuggestions: boolean;', idx + 5)
        if idx2 >= 0:
            print(f"  Second at {idx2}: {repr(c[idx2:idx2+100])}")

with open(path1, 'w', encoding='utf-8') as f:
    f.write(c)

# ============================================================
# 2. LinkedTodos.tsx - Remove unused hasSelection/onClearSelection
# ============================================================
path2 = os.path.join(BASE, "apps/chat/components/input/LinkedTodos.tsx")
with open(path2, 'r', encoding='utf-8') as f:
    l = f.read()

changes2 = 0

# 2a. Remove hasSelection from interface
old_iface_has = '\thasSelection: boolean;\n\tlocale: string;'
new_iface_has = '\tlocale: string;'

if old_iface_has in l:
    l = l.replace(old_iface_has, new_iface_has)
    changes2 += 1
    print("OK LinkedTodos: removed hasSelection from interface")
else:
    print("FAIL LinkedTodos: hasSelection in interface not matched")

# 2b. Remove onClearSelection from interface
old_iface_clear = '\tonClearSelection: () => void;\n\tonToggleTodo: (id: number) => void;'
new_iface_clear = '\tonToggleTodo: (id: number) => void;'

if old_iface_clear in l:
    l = l.replace(old_iface_clear, new_iface_clear)
    changes2 += 1
    print("OK LinkedTodos: removed onClearSelection from interface")
else:
    print("FAIL LinkedTodos: onClearSelection in interface not matched")

# 2c. Remove hasSelection from destructuring
old_dest_has = '\thasSelection,\n\tshowTodosExpanded,'
new_dest_has = '\tshowTodosExpanded,'

if old_dest_has in l:
    l = l.replace(old_dest_has, new_dest_has)
    changes2 += 1
    print("OK LinkedTodos: removed hasSelection from destructuring")
else:
    print("FAIL LinkedTodos: hasSelection in destructuring not matched")

# 2d. Remove onClearSelection from destructuring
old_dest_clear = '\tonClearSelection,\n\tonToggleTodo,'
new_dest_clear = '\tonToggleTodo,'

if old_dest_clear in l:
    l = l.replace(old_dest_clear, new_dest_clear)
    changes2 += 1
    print("OK LinkedTodos: removed onClearSelection from destructuring")
else:
    print("FAIL LinkedTodos: onClearSelection in destructuring not matched")

if changes2 > 0:
    with open(path2, 'w', encoding='utf-8') as f:
        f.write(l)
    print(f"OK LinkedTodos.tsx saved ({changes2} changes)")
else:
    print("FAIL: No changes to LinkedTodos.tsx")

print("=== Done ===")
