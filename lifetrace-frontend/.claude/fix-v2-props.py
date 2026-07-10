import re, sys

# ============ 1. DiaryPanel.tsx - add heatmapFilterDate + onClearHeatmapFilter to DiaryEditor ============
with open('apps/diary/DiaryPanel.tsx', 'r', encoding='utf-8') as f:
    panel = f.read()

idx = panel.find('<DiaryEditor')
if idx >= 0:
    fm_idx = panel.find('filterMode={filterMode}', idx)
    if fm_idx >= 0:
        # Find the indentation used for filterMode
        line_start = panel.rfind('\n', 0, fm_idx) + 1
        indent = panel[line_start:fm_idx]
        old = indent + 'filterMode={filterMode}'
        new = indent + 'filterMode={filterMode}\n' + indent + 'heatmapFilterDate={heatmapFilterDate}\n' + indent + 'onClearHeatmapFilter={() => setHeatmapFilterDate(null)}'

        panel_start = idx
        panel_end = panel.find('/>', panel_start) + 2
        editor_section = panel[panel_start:panel_end]

        if old in editor_section:
            new_section = editor_section.replace(old, new, 1)
            panel = panel[:panel_start] + new_section + panel[panel_end:]
            with open('apps/diary/DiaryPanel.tsx', 'w', encoding='utf-8') as f:
                f.write(panel)
            print("OK DiaryPanel.tsx: added heatmapFilterDate props")
        else:
            print("FAIL DiaryPanel: pattern not found in editor section")
            print("  old:", repr(old))
    else:
        print("FAIL DiaryPanel: filterMode not found after <DiaryEditor")
else:
    print("FAIL DiaryPanel: <DiaryEditor not found")


# ============ 2. DiaryEditor.tsx - add props to interface and signature ============
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

changed_editor = False

# 2a. Add to DiaryEditorProps interface
old_props = '\tonSubmit: () => void;'
new_props = '\theatmapFilterDate?: Date | null;\n\tonClearHeatmapFilter?: () => void;\n\tonSubmit: () => void;'

if old_props in editor and 'heatmapFilterDate' not in editor:
    editor = editor.replace(old_props, new_props, 1)
    changed_editor = True
    print("OK DiaryEditor.tsx: added props to interface")
elif 'heatmapFilterDate' in editor:
    print("WARN DiaryEditor.tsx: heatmapFilterDate already in interface")
else:
    print("FAIL DiaryEditor: interface pattern not found")

# 2b. Add destructuring in function signature
old_sig = '\t\tonSubmit,'
new_sig = '\t\theatmapFilterDate,\n\t\tonClearHeatmapFilter,\n\t\tonSubmit,'

if old_sig in editor and 'heatmapFilterDate' not in editor.split('function DiaryEditor')[1].split('{')[0] if 'function DiaryEditor' in editor else '':
    editor = editor.replace(old_sig, new_sig, 1)
    changed_editor = True
    print("OK DiaryEditor.tsx: added destructuring to signature")
elif 'heatmapFilterDate' in editor.split('function DiaryEditor')[1].split('{')[0] if 'function DiaryEditor' in editor else '':
    print("WARN DiaryEditor.tsx: heatmapFilterDate already in signature")
else:
    print("FAIL DiaryEditor: signature pattern not found")

# 2c. Add to journalQuery
old_query = '\t\treturn params;\n\t}, [filterMode]);'
new_query = '\t} else if (heatmapFilterDate) {\n\t\tconst start = new Date(heatmapFilterDate);\n\t\tstart.setHours(0, 0, 0, 0);\n\t\tconst end = new Date(heatmapFilterDate);\n\t\tend.setHours(23, 59, 59, 999);\n\t\tparams.startDate = start.toISOString();\n\t\tparams.endDate = end.toISOString();\n\t}\n\t\treturn params;\n\t}, [filterMode, heatmapFilterDate]);'

if old_query in editor and 'heatmapFilterDate' not in editor.split('journalQuery')[1].split('notesData')[0] if 'journalQuery' in editor else '':
    editor = editor.replace(old_query, new_query, 1)
    changed_editor = True
    print("OK DiaryEditor.tsx: added heatmapFilterDate to journalQuery")
elif 'heatmapFilterDate' in editor.split('journalQuery')[1].split('notesData')[0] if 'journalQuery' in editor else '':
    print("WARN DiaryEditor.tsx: heatmapFilterDate already in journalQuery")
else:
    print("FAIL DiaryEditor: journalQuery pattern not found")
    # Debug
    idx = editor.find('return params;')
    if idx >= 0:
        print(f"  'return params;' at {idx}, context: {repr(editor[idx-30:idx+30])}")
    idx2 = editor.find('[filterMode]')
    if idx2 >= 0:
        print(f"  '[filterMode]' at {idx2}, context: {repr(editor[idx2-5:idx2+30])}")

if changed_editor:
    with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(editor)
    print("OK DiaryEditor.tsx saved")

print("OK Done")
