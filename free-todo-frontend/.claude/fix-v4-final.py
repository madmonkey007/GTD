import sys

# ============ 1. DiaryPanel.tsx - remove duplicate props ============
with open('apps/diary/DiaryPanel.tsx', 'r', encoding='utf-8') as f:
    panel = f.read()

# Remove the duplicate heatmapFilterDate and onClearHeatmapFilter lines
# Pattern: blank line + heatmapFilterDate + blank line + onClearHeatmapFilter
dup = "\n\n\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}\n\n\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}"

if dup in panel:
    panel = panel.replace(dup, "")
    with open('apps/diary/DiaryPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(panel)
    print("OK DiaryPanel.tsx: duplicate props removed")
else:
    print("FAIL DiaryPanel: duplicate pattern not found")
    # Debug - find the area
    idx = panel.find('<DiaryEditor')
    if idx >= 0:
        section = panel[idx:idx+350]
        print(f"  Section around DiaryEditor: {repr(section)}")


# ============ 2. DiaryEditor.tsx - comprehensive fix ============
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

changes = 0

# 2a. Add to interface (after onUserNotesBlur line)
old_iface = "\t\tonUserNotesBlur: (value: string) => void;\n\t\tpinnedIds: number[];"
new_iface = "\t\tonUserNotesBlur: (value: string) => void;\n\t\theatmapFilterDate?: Date | null;\n\t\tonClearHeatmapFilter?: () => void;\n\t\tpinnedIds: number[];"

if old_iface in editor:
    editor = editor.replace(old_iface, new_iface)
    changes += 1
    print("OK DiaryEditor.tsx: interface updated")
else:
    print("FAIL DiaryEditor: interface pattern not found")
    iface_idx = editor.find("onUserNotesBlur:")
    if iface_idx >= 0:
        print(f"  onUserNotesBlur context: {repr(editor[iface_idx:iface_idx+100])}")

# 2b. Add to destructuring (after filterMode,)
old_sig = "\t\tfilterMode,\n\t\tonTitleChange,"
new_sig = "\t\tfilterMode,\n\t\theatmapFilterDate,\n\t\tonClearHeatmapFilter,\n\t\tonTitleChange,"

if old_sig in editor:
    editor = editor.replace(old_sig, new_sig)
    changes += 1
    print("OK DiaryEditor.tsx: signature updated")
else:
    print("FAIL DiaryEditor: signature pattern not found")
    sig_idx = editor.find("filterMode,")
    if sig_idx >= 0:
        print(f"  filterMode context: {repr(editor[sig_idx:sig_idx+80])}")

# 2c. Fix journalQuery indentation (else-if block at wrong level)
old_jq = "\t\t} else if (heatmapFilterDate) {\n\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\tparams.startDate = start.toISOString();\n\t\t\tparams.endDate = end.toISOString();\n\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);"

new_jq = "\t\t} else if (heatmapFilterDate) {\n\t\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);"

if old_jq in editor:
    editor = editor.replace(old_jq, new_jq)
    changes += 1
    print("OK DiaryEditor.tsx: journalQuery indentation fixed")
else:
    print("FAIL DiaryEditor: journalQuery pattern not found")
    jq_idx = editor.find("else if (heatmapFilterDate)")
    if jq_idx >= 0:
        print(f"  else-if context: {repr(editor[jq_idx:jq_idx+150])}")
    else:
        rp_idx = editor.find("return params;")
        if rp_idx >= 0:
            print(f"  return params context: {repr(editor[rp_idx-30:rp_idx+30])}")

if changes > 0:
    with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(editor)

print(f"OK Done ({changes} changes)")
