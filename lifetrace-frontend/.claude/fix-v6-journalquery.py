# Fix journalQuery indentation in DiaryEditor.tsx
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

# Current broken block (lines 144-152)
old = '\t\t\t}\n\t\t} else if (heatmapFilterDate) {\n\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\tparams.startDate = start.toISOString();\n\t\t\tparams.endDate = end.toISOString();\n\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'

# Correct block (else-if at same indent as if, body +1, closing brace at same indent)
new = '\t\t\t} else if (heatmapFilterDate) {\n\t\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'

if old in editor:
    editor = editor.replace(old, new)
    with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(editor)
    print('OK journalQuery indentation fixed')
else:
    print('FAIL: pattern not found')
    # Show what's around lines 144-154
    lines = editor.split('\n')
    for i in range(143, min(156, len(lines))):
        if i >= 0:
            print(f'  Line {i+1}: tabs={lines[i].count(chr(9))} |{lines[i][:80]}|')
