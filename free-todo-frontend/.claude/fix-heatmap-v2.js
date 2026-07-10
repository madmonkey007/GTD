const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readFile(relPath) {
  const p = path.resolve(root, relPath);
  return { p, content: fs.readFileSync(p, "utf8") };
}
function saveFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}
function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}
function denormalize(text, hasCRLF) {
  return hasCRLF ? text.replace(/\n/g, "\r\n") : text;
}

// ============ 1. DiaryPanel.tsx - separate heatmap filter from selectedDate ============
{
  const { p, content } = readFile("apps/diary/DiaryPanel.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // 1. Add heatmapFilterDate state after selectedDate state
  const oldState = "const [selectedDate, setSelectedDate] = useState(() =>\n\t\tnormalizeDateOnly(new Date()),\n\t);";
  const newState = "const [selectedDate, setSelectedDate] = useState(() =>\n\t\tnormalizeDateOnly(new Date()),\n\t);\n\tconst [heatmapFilterDate, setHeatmapFilterDate] = useState<Date | null>(null);";

  if (n.includes(oldState)) {
    n = n.replace(oldState, newState);
    changed = true;
    console.log("  ✓ heatmapFilterDate state added");
  } else {
    console.log("  ✗ heatmapFilterDate state not found");
  }

  // 2. Change onSelectDate for DiarySidebar - set heatmapFilterDate instead of calling handleDateChange
  const oldSidebar = '<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={setFilterMode} onSelectDate={handleDateChange} />';
  const newSidebar = '<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={setFilterMode} onSelectDate={(date) => { setHeatmapFilterDate(date); setFilterMode("all"); }} />';

  if (n.includes(oldSidebar)) {
    n = n.replace(oldSidebar, newSidebar);
    changed = true;
    console.log("  ✓ DiarySidebar onSelectDate updated");
  } else {
    console.log("  ✗ DiarySidebar usage not found");
    const idx = n.indexOf("DiarySidebar");
    if (idx >= 0) console.log("  Found:", JSON.stringify(n.substring(idx, idx + 250)));
  }

  // 3. Pass heatmapFilterDate to DiaryEditor
  const oldEditor = '<DiaryEditor\n\t\t\t\t\t\t\tdraft={draft}\n\t\t\t\t\t\t\t\tfilterMode={filterMode}\n\t\t\t\t\t\t\t\tpinnedIds={pinnedIds}\n\t\t\t\t\t\t\t\tonDelete={handleDeleteJournal}\n\t\t\t\t\t\t\t\tonTogglePin={handleTogglePin}\n\t\t\t\t\t\t\t\tonSaveCardEdit={handleSaveCardEdit}\n\t\t\t\t\t\t\tonTitleChange={(value) =>\n\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, name: value }))\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonUserNotesChange={(value) =>\n\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, userNotes: value }))\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonUserNotesBlur={(value) =>\n\t\t\t\t\t\t\t\thandleAutoSave({ draftOverride: { userNotes: value } })\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonSubmit={handleSubmitNotes}\n\t\t\t\t\t\t\tonInlineTag={handleInlineTag}\n\t\t\t\t\t\t/>';
  const newEditor = '<DiaryEditor\n\t\t\t\t\t\t\tdraft={draft}\n\t\t\t\t\t\t\t\tfilterMode={filterMode}\n\t\t\t\t\t\t\t\theatmapFilterDate={heatmapFilterDate}\n\t\t\t\t\t\t\t\tonClearHeatmapFilter={() => setHeatmapFilterDate(null)}\n\t\t\t\t\t\t\t\tpinnedIds={pinnedIds}\n\t\t\t\t\t\t\t\tonDelete={handleDeleteJournal}\n\t\t\t\t\t\t\t\tonTogglePin={handleTogglePin}\n\t\t\t\t\t\t\t\tonSaveCardEdit={handleSaveCardEdit}\n\t\t\t\t\t\t\tonTitleChange={(value) =>\n\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, name: value }))\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonUserNotesChange={(value) =>\n\t\t\t\t\t\t\t\tsetDraft((prev) => ({ ...prev, userNotes: value }))\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonUserNotesBlur={(value) =>\n\t\t\t\t\t\t\t\thandleAutoSave({ draftOverride: { userNotes: value } })\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonSubmit={handleSubmitNotes}\n\t\t\t\t\t\t\tonInlineTag={handleInlineTag}\n\t\t\t\t\t\t/>';

  if (n.includes(oldEditor)) {
    n = n.replace(oldEditor, newEditor);
    changed = true;
    console.log("  ✓ DiaryEditor heatmapFilterDate added");
  } else {
    console.log("  ✗ DiaryEditor usage not found");
    const idx = n.indexOf("DiaryEditor");
    if (idx >= 0) console.log("  Found:", JSON.stringify(n.substring(idx, idx + 300)));
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryPanel.tsx");
  }
}

// ============ 2. DiaryEditor.tsx - accept heatmapFilterDate + onClearHeatmapFilter ============
{
  const { p, content } = readFile("apps/diary/DiaryEditor.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // 1. Update DiaryEditorProps
  const oldProps = "interface DiaryEditorProps {\n\t\tdraft: JournalDraft;\n\t\tfilterMode: DiaryFilterMode;\n\t\tonTitleChange: (value: string) => void;\n\t\tonUserNotesChange: (value: string) => void;\n\t\tonUserNotesBlur: (value: string) => void;\n\t\tpinnedIds: number[];\n\t\tonDelete: (journalId: number) => void;\n\t\tonTogglePin: (journalId: number) => void;\n\t\tonSubmit: () => void;\n\t\tonSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;\n\t\tonInlineTag?: (tagName: string) => void;\n\t}";
  const newProps = "interface DiaryEditorProps {\n\t\tdraft: JournalDraft;\n\t\tfilterMode: DiaryFilterMode;\n\t\theatmapFilterDate?: Date | null;\n\t\tonClearHeatmapFilter?: () => void;\n\t\tonTitleChange: (value: string) => void;\n\t\tonUserNotesChange: (value: string) => void;\n\t\tonUserNotesBlur: (value: string) => void;\n\t\tpinnedIds: number[];\n\t\tonDelete: (journalId: number) => void;\n\t\tonTogglePin: (journalId: number) => void;\n\t\tonSubmit: () => void;\n\t\tonSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;\n\t\tonInlineTag?: (tagName: string) => void;\n\t}";

  if (n.includes(oldProps)) {
    n = n.replace(oldProps, newProps);
    changed = true;
    console.log("  ✓ DiaryEditorProps updated");
  } else {
    console.log("  ✗ DiaryEditorProps not found");
  }

  // 2. Update function signature
  const oldFn = 'export function DiaryEditor({\n\t\tdraft,\n\t\tfilterMode,\n\t\tonTitleChange,\n\t\tonUserNotesChange,\n\t\tonUserNotesBlur,\n\t\tpinnedIds,\n\t\tonDelete,\n\t\tonTogglePin,\n\t\tonSubmit,\n\t\tonSaveCardEdit,\n\t\tonInlineTag,\n\t}: DiaryEditorProps) {';
  const newFn = 'export function DiaryEditor({\n\t\tdraft,\n\t\tfilterMode,\n\t\theatmapFilterDate,\n\t\tonClearHeatmapFilter,\n\t\tonTitleChange,\n\t\tonUserNotesChange,\n\t\tonUserNotesBlur,\n\t\tpinnedIds,\n\t\tonDelete,\n\t\tonTogglePin,\n\t\tonSubmit,\n\t\tonSaveCardEdit,\n\t\tonInlineTag,\n\t}: DiaryEditorProps) {';

  if (n.includes(oldFn)) {
    n = n.replace(oldFn, newFn);
    changed = true;
    console.log("  ✓ DiaryEditor signature updated");
  } else {
    console.log("  ✗ DiaryEditor signature not found");
  }

  // 3. Update journalQuery to include heatmapFilterDate
  const oldQuery = "const journalQuery = useMemo(() => {\n\t\t\tconst params: Record<string, unknown> = { limit: 50, offset: 0 };\n\t\t\tif (filterMode === \"last7\") {\n\t\t\t\tconst now = new Date();\n\t\t\t\tconst start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);\n\t\t\t\tconst end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode]);";
  const newQuery = "const journalQuery = useMemo(() => {\n\t\t\tconst params: Record<string, unknown> = { limit: 50, offset: 0 };\n\t\t\tif (filterMode === \"last7\") {\n\t\t\t\tconst now = new Date();\n\t\t\t\tconst start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);\n\t\t\t\tconst end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t} else if (heatmapFilterDate) {\n\t\t\t\tconst start = new Date(heatmapFilterDate);\n\t\t\t\tstart.setHours(0, 0, 0, 0);\n\t\t\t\tconst end = new Date(heatmapFilterDate);\n\t\t\t\tend.setHours(23, 59, 59, 999);\n\t\t\t\tparams.startDate = start.toISOString();\n\t\t\t\tparams.endDate = end.toISOString();\n\t\t\t}\n\t\t\treturn params;\n\t\t}, [filterMode, heatmapFilterDate]);";

  if (n.includes(oldQuery)) {
    n = n.replace(oldQuery, newQuery);
    changed = true;
    console.log("  ✓ journalQuery updated");
  } else {
    console.log("  ✗ journalQuery not found");
  }

  // 4. Add filter chip between input area and notes list
  const oldNotesDiv = '<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">\n\t\t\t\t\t{filterMode === "random" && (';
  const newNotesDiv = '<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">\n\t\t\t\t\t{heatmapFilterDate && (\n\t\t\t\t\t\t<div className="flex items-center gap-2 mb-3 px-2">\n\t\t\t\t\t\t\t<span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">\n\t\t\t\t\t\t\t\t{heatmapFilterDate.getFullYear()}-{String(heatmapFilterDate.getMonth() + 1).padStart(2, "0")}-{String(heatmapFilterDate.getDate()).padStart(2, "0")}\n\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={onClearHeatmapFilter}\n\t\t\t\t\t\t\t\tclassName="text-xs text-muted-foreground hover:text-foreground underline transition-colors"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{t("sidebarFilterAll")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t)}\n\t\t\t\t\t{filterMode === "random" && (';

  if (n.includes(oldNotesDiv)) {
    n = n.replace(oldNotesDiv, newNotesDiv);
    changed = true;
    console.log("  ✓ filter chip added");
  } else {
    console.log("  ✗ notes div header not found");
    const idx = n.indexOf("flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2");
    if (idx >= 0) console.log("  Found:", JSON.stringify(n.substring(idx, idx + 250)));
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryEditor.tsx");
  }
}

console.log("\n✅ Done");
