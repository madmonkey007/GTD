import sys

# ============ 1. DiaryPanel.tsx - remove duplicate props ============
with open('apps/diary/DiaryPanel.tsx', 'r', encoding='utf-8') as f:
    panel = f.read()

dup = '\n\n\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}\n\n\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}'

if dup in panel:
    panel = panel.replace(dup, '')
    with open('apps/diary/DiaryPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(panel)
    print('OK DiaryPanel.tsx: duplicate props removed')
else:
    print('FAIL DiaryPanel: duplicate pattern not found')
    idx = panel.find('<DiaryEditor')
    if idx >= 0:
        section = panel[idx:idx+350]
        print(f'  Section: {repr(section)}')


# ============ 2. DiaryEditor.tsx - fix interface, signature, journalQuery ============
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

changes = 0

# 2a. Interface: add after onUserNotesBlur
# Use single-tab indentation (actual file uses \t not \t\t)
old_i = '\tonUserNotesBlur: (value: string) => void;\n\tpinnedIds: number[];'
new_i = '\tonUserNotesBlur: (value: string) => void;\n\theatmapFilterDate?: Date | null;\n\tonClearHeatmapFilter?: () => void;\n\tpinnedIds: number[];'

if old_i in editor:
    editor = editor.replace(old_i, new_i)
    changes += 1
    print('OK DiaryEditor.tsx: interface updated')
else:
    print(f'FAIL DiaryEditor: interface pattern not matched')
    # Debug
    idx = editor.find('onUserNotesBlur:')
    if idx >= 0:
        print(f'  Context: {repr(editor[idx:idx+80])}')

# 2b. Signature: add after filterMode
old_s = '\tfilterMode,\n\tonTitleChange,'
new_s = '\tfilterMode,\n\theatmapFilterDate,\n\tonClearHeatmapFilter,\n\tonTitleChange,'

if old_s in editor:
    editor = editor.replace(old_s, new_s)
    changes += 1
    print('OK DiaryEditor.tsx: signature updated')
else:
    print(f'FAIL DiaryEditor: signature pattern not matched')
    idx = editor.find('\tfilterMode,')
    if idx >= 0:
        print(f'  Context: {repr(editor[idx:idx+80])}')

# 2c. journalQuery: fix indentation
# Current broken content (lines 141-150)
old_j = '\t\t} else if (heatmapFilterDate) {\n\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\tparams.startDate = start.toISOString();\n\t\t\tparams.endDate = end.toISOString();\n\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'

# Correct indentation matching the if block (3 tabs for } else if, 4 tabs for body, 3 tabs for closing })
new_j = '\t\t} else if (heatmapFilterDate) {\n\t\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'

if old_j in editor:
    editor = editor.replace(old_j, new_j)
    changes += 1
    print('OK DiaryEditor.tsx: journalQuery fixed')
else:
    print(f'FAIL DiaryEditor: journalQuery pattern not matched')
    # Try without the close-return-close part
    idx = editor.find('} else if (heatmapFilterDate)')
    if idx >= 0:
        print(f'  Found `else if` at {idx}: {repr(editor[idx-5:idx+120])}')
    print(f'  old_j first 50 chars: {repr(old_j[:80])}')
    print(f'  old_j last 50 chars: {repr(old_j[-80:])}')

if changes > 0:
    with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(editor)
    print(f'OK DiaryEditor.tsx saved ({changes} changes)')
else:
    print('No changes made to DiaryEditor.tsx')

print('OK Done')
