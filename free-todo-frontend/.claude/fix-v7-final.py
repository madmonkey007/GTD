# Fix journalQuery indentation - correct tab levels
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

# Current broken block (lines 144-154)
old = '\t\t}\n\t} else if (heatmapFilterDate) {\n\t\tconst start = new Date(heatmapFilterDate);\n\t\tstart.setHours(0, 0, 0, 0);\n\t\tconst end = new Date(heatmapFilterDate);\n\t\tend.setHours(23, 59, 59, 999);\n\t\tparams.startDate = start.toISOString();\n\t\tparams.endDate = end.toISOString();\n\t}\n\t\treturn params;\n\t}, [filterMode, heatmapFilterDate]);'

# Correct block
new = '\t\t} else if (heatmapFilterDate) {\n\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\tparams.startDate = start.toISOString();\n\t\t\tparams.endDate = end.toISOString();\n\t\t}\n\t\treturn params;\n\t}, [filterMode, heatmapFilterDate]);'

if old in editor:
    editor = editor.replace(old, new)
    with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(editor)
    print('OK journalQuery indentation fixed')
else:
    print('FAIL: pattern not found')
    print(f'  old first 60: {repr(old[:60])}')
    print(f'  old last 60: {repr(old[-60:])}')
