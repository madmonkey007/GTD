import re

# ============ 1. DiaryPanel.tsx - remove duplicate props ============
with open('apps/diary/DiaryPanel.tsx', 'r', encoding='utf-8') as f:
    panel = f.read()

# Find DiaryEditor usage and fix duplicates
idx = panel.find('<DiaryEditor')
end_idx = panel.find('/>', idx) + 2
editor_section = panel[idx:end_idx]

# Fix duplicates by rebuilding the section cleanly
old_dup = '''\t\t\t\t\t\t<DiaryEditor
\t\t\t\t\t\t\tdraft={draft}
\t\t\t\t\t\t\t\tfilterMode={filterMode}
\t\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}
\t\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}

\t\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}

\t\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}
\t\t\t\t\t\t\t\tpinnedIds={pinnedIds}
\t\t\t\t\t\t\t\tonDelete={handleDeleteJournal}
\t\t\t\t\t\t\t\tonTogglePin={handleTogglePin}
\t\t\t\t\t\t\t\tonSaveCardEdit={handleSaveCardEdit}
\t\t\t\t\t\t\tonTitleChange={(value) =>
\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, name: value }))
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonUserNotesChange={(value) =>
\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, userNotes: value }))
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonUserNotesBlur={(value) =>
\t\t\t\t\t\t\t\thandleAutoSave({ draftOverride: { userNotes: value } })
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonSubmit={handleSubmitNotes}
\t\t\t\t\t\t\tonInlineTag={handleInlineTag}
\t\t\t\t\t\t/>'''

new_clean = '''\t\t\t\t\t\t<DiaryEditor
\t\t\t\t\t\t\tdraft={draft}
\t\t\t\t\t\t\t\tfilterMode={filterMode}
\t\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}
\t\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}
\t\t\t\t\t\t\t\tpinnedIds={pinnedIds}
\t\t\t\t\t\t\t\tonDelete={handleDeleteJournal}
\t\t\t\t\t\t\t\tonTogglePin={handleTogglePin}
\t\t\t\t\t\t\t\tonSaveCardEdit={handleSaveCardEdit}
\t\t\t\t\t\t\tonTitleChange={(value) =>
\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, name: value }))
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonUserNotesChange={(value) =>
\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, userNotes: value }))
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonUserNotesBlur={(value) =>
\t\t\t\t\t\t\t\thandleAutoSave({ draftOverride: { userNotes: value } })
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonSubmit={handleSubmitNotes}
\t\t\t\t\t\t\tonInlineTag={handleInlineTag}
\t\t\t\t\t\t/>'''

if old_dup in panel:
    panel = panel.replace(old_dup, new_clean)
    with open('apps/diary/DiaryPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(panel)
    print("OK DiaryPanel.tsx: fixed duplicate props")
else:
    print("FAIL: DiaryPanel duplicate pattern not found")
    print("Current DiaryEditor section:")
    print(repr(editor_section[:300]))


# ============ 2. DiaryEditor.tsx - comprehensive fix ============
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    editor = f.read()

# 2a. Fix interface - add heatmapFilterDate and onClearHeatmapFilter
old_interface = '''\tonTitleChange: (value: string) => void;
\t\tonUserNotesChange: (value: string) => void;
\t\tonUserNotesBlur: (value: string) => void;
\t\tpinnedIds: number[];
\t\tonDelete: (journalId: number) => void;
\t\tonTogglePin: (journalId: number) => void;
\t\tonSubmit: () => void;
\t\tonSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;
\t\tonInlineTag?: (tagName: string) => void;'''

new_interface = '''\tonTitleChange: (value: string) => void;
\t\tonUserNotesChange: (value: string) => void;
\t\tonUserNotesBlur: (value: string) => void;
\t\theatmapFilterDate?: Date | null;
\t\tonClearHeatmapFilter?: () => void;
\t\tpinnedIds: number[];
\t\tonDelete: (journalId: number) => void;
\t\tonTogglePin: (journalId: number) => void;
\t\tonSubmit: () => void;
\t\tonSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;
\t\tonInlineTag?: (tagName: string) => void;'''

if old_interface in editor:
    editor = editor.replace(old_interface, new_interface)
    print("OK DiaryEditor.tsx: interface updated")
else:
    print("FAIL DiaryEditor: interface pattern not found")

# 2b. Fix signature - add heatmapFilterDate and onClearHeatmapFilter
old_sig = '''\texport function DiaryEditor({
\t\tdraft,
\t\tfilterMode,
\t\tonTitleChange,
\t\tonUserNotesChange,
\t\tonUserNotesBlur,
\t\tpinnedIds,
\t\tonDelete,
\t\tonTogglePin,
\t\tonSubmit,
\t\tonSaveCardEdit,
\t\tonInlineTag,
\t}: DiaryEditorProps) {'''

new_sig = '''\texport function DiaryEditor({
\t\tdraft,
\t\tfilterMode,
\t\theatmapFilterDate,
\t\tonClearHeatmapFilter,
\t\tonTitleChange,
\t\tonUserNotesChange,
\t\tonUserNotesBlur,
\t\tpinnedIds,
\t\tonDelete,
\t\tonTogglePin,
\t\tonSubmit,
\t\tonSaveCardEdit,
\t\tonInlineTag,
\t}: DiaryEditorProps) {'''

if old_sig in editor:
    editor = editor.replace(old_sig, new_sig)
    print("OK DiaryEditor.tsx: signature updated")
else:
    print("FAIL DiaryEditor: signature pattern not found")
    # Debug
    idx = editor.find('export function DiaryEditor')
    if idx >= 0:
        sig_end = editor.find('}: DiaryEditorProps) {', idx) + 25
        print(f"  Actual signature: {repr(editor[idx:sig_end])}")

# 2c. Fix journalQuery - replace the broken else-if block
old_query_block = '''\t\t} else if (heatmapFilterDate) {
\t\t\tconst start = new Date(heatmapFilterDate);
\t\t\tstart.setHours(0, 0, 0, 0);
\t\t\tconst end = new Date(heatmapFilterDate);
\t\t\tend.setHours(23, 59, 59, 999);
\t\t\tparams.startDate = start.toISOString();
\t\t\tparams.endDate = end.toISOString();
\t\t}
\t\t\treturn params;
\t\t}, [filterMode, heatmapFilterDate]);'''

new_query_block = '''\t\t\treturn params;
\t\t}, [filterMode, heatmapFilterDate]);'''

# First restore to original, then re-add with correct indentation
old_original = '''\t\t\treturn params;
\t\t}, [filterMode, heatmapFilterDate]);'''

new_complete = '''\t\t} else if (heatmapFilterDate) {
\t\t\t\tconst start = new Date(heatmapFilterDate);
\t\t\t\tstart.setHours(0, 0, 0, 0);
\t\t\t\tconst end = new Date(heatmapFilterDate);
\t\t\t\tend.setHours(23, 59, 59, 999);
\t\t\t\tparams.startDate = start.toISOString();
\t\t\t\tparams.endDate = end.toISOString();
\t\t\t}
\t\t\treturn params;
\t\t}, [filterMode, heatmapFilterDate]);'''

# Check if the broken block exists
if old_query_block in editor:
    print("Found broken query block, replacing...")
    # Just fix the indentation
    fixed_block = '''\t\t} else if (heatmapFilterDate) {
\t\t\t\tconst start = new Date(heatmapFilterDate);
\t\t\t\tstart.setHours(0, 0, 0, 0);
\t\t\t\tconst end = new Date(heatmapFilterDate);
\t\t\t\tend.setHours(23, 59, 59, 999);
\t\t\t\tparams.startDate = start.toISOString();
\t\t\t\tparams.endDate = end.toISOString();
\t\t\t}
\t\t\treturn params;
\t\t}, [filterMode, heatmapFilterDate]);'''
    editor = editor.replace(old_query_block, fixed_block)
    print("OK DiaryEditor.tsx: journalQuery indentation fixed")
elif old_original in editor:
    # Need to add the else-if block before return params
    old = '\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'
    new_with_else = '\t\t} else if (heatmapFilterDate) {\n\t\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);'
    editor = editor.replace(old, new_with_else)
    print("OK DiaryEditor.tsx: journalQuery else-if added")
else:
    print("FAIL DiaryEditor: journalQuery pattern not found")
    idx = editor.find('return params;')
    if idx >= 0:
        print(f"  'return params;' at {idx}: {repr(editor[idx-30:idx+30])}")
    idx2 = editor.find('[filterMode, heatmapFilterDate]')
    if idx2 >= 0:
        print(f"  'filterMode, heatmapFilterDate' found at {idx2}")

with open('apps/diary/DiaryEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(editor)

print("\nOK Done")
