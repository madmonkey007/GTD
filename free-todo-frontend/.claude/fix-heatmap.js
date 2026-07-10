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

// ============ 1. DiaryHeatmap.tsx - add onSelectDate prop and onClick handler ============
{
  const { p, content } = readFile("apps/diary/components/DiaryHeatmap.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // Update interface
  const oldInterface = 'interface DiaryHeatmapProps {\n\tdates: Date[];\n\tdailyCounts: Map<string, number>;\n\tmaxDailyCount: number;\n}';
  const newInterface = 'interface DiaryHeatmapProps {\n\tdates: Date[];\n\tdailyCounts: Map<string, number>;\n\tmaxDailyCount: number;\n\tonSelectDate?: (date: Date) => void;\n}';

  if (n.includes(oldInterface)) {
    n = n.replace(oldInterface, newInterface);
    changed = true;
    console.log("  ✓ interface updated");
  } else {
    console.log("  ✗ interface pattern not found");
  }

  // Update function signature
  const oldFn = 'export function DiaryHeatmap({ dates, dailyCounts, maxDailyCount }: DiaryHeatmapProps) {';
  const newFn = 'export function DiaryHeatmap({ dates, dailyCounts, maxDailyCount, onSelectDate }: DiaryHeatmapProps) {';

  if (n.includes(oldFn)) {
    n = n.replace(oldFn, newFn);
    changed = true;
    console.log("  ✓ function signature updated");
  } else {
    console.log("  ✗ function signature not found");
  }

  // Update the dot div to a clickable button
  const oldDot = '<div\n\t\t\t\t\t\t\t\t\tkey={rowIdx}\n\t\t\t\t\t\t\t\t\ttitle={cell.tooltip}\n\t\t\t\t\t\t\t\t\tclassName={`w-3 h-3 rounded-full ${DOT_COLORS[cell.level]} cursor-default transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}\n\t\t\t\t\t\t\t\t/>';
  const newDot = '<button\n\t\t\t\t\t\t\t\t\tkey={rowIdx}\n\t\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\t\ttitle={cell.tooltip}\n\t\t\t\t\t\t\t\t\tonClick={onSelectDate ? () => onSelectDate(cell.date) : undefined}\n\t\t\t\t\t\t\t\t\tclassName={`w-3 h-3 rounded-full ${DOT_COLORS[cell.level]} ${onSelectDate ? \'cursor-pointer\' : \'cursor-default\'} transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}\n\t\t\t\t\t\t\t\t/>';

  if (n.includes(oldDot)) {
    n = n.replace(oldDot, newDot);
    changed = true;
    console.log("  ✓ dot button updated");
  } else {
    console.log("  ✗ dot pattern not found");
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryHeatmap.tsx");
  }
}

// ============ 2. DiarySidebar.tsx - pass onSelectDate through ============
{
  const { p, content } = readFile("apps/diary/components/DiarySidebar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // Update interface
  const oldIface = 'interface DiarySidebarProps {\n\tstats: DiaryStatsData;\n\tfilterMode: DiaryFilterMode;\n\tonFilterModeChange: (mode: DiaryFilterMode) => void;\n}';
  const newIface = 'interface DiarySidebarProps {\n\tstats: DiaryStatsData;\n\tfilterMode: DiaryFilterMode;\n\tonFilterModeChange: (mode: DiaryFilterMode) => void;\n\tonSelectDate?: (date: Date) => void;\n}';

  if (n.includes(oldIface)) {
    n = n.replace(oldIface, newIface);
    changed = true;
    console.log("  ✓ interface updated");
  } else {
    console.log("  ✗ interface pattern not found");
  }

  // Update function signature
  const oldFn = 'export function DiarySidebar({\n\tstats,\n\tfilterMode,\n\tonFilterModeChange,\n}: DiarySidebarProps) {';
  const newFn = 'export function DiarySidebar({\n\tstats,\n\tfilterMode,\n\tonFilterModeChange,\n\tonSelectDate,\n}: DiarySidebarProps) {';

  if (n.includes(oldFn)) {
    n = n.replace(oldFn, newFn);
    changed = true;
    console.log("  ✓ function signature updated");
  } else {
    console.log("  ✗ function signature not found");
  }

  // Update DiaryHeatmap usage to pass onSelectDate
  const oldHeatmap = '<DiaryHeatmap\n\t\t\t\t\t\tdates={stats.dates}\n\t\t\t\t\t\tdailyCounts={stats.dailyCounts}\n\t\t\t\t\t\tmaxDailyCount={stats.maxDailyCount}\n\t\t\t\t\t/>';
  const newHeatmap = '<DiaryHeatmap\n\t\t\t\t\t\tdates={stats.dates}\n\t\t\t\t\t\tdailyCounts={stats.dailyCounts}\n\t\t\t\t\t\tmaxDailyCount={stats.maxDailyCount}\n\t\t\t\t\t\tonSelectDate={onSelectDate}\n\t\t\t\t\t/>';

  if (n.includes(oldHeatmap)) {
    n = n.replace(oldHeatmap, newHeatmap);
    changed = true;
    console.log("  ✓ DiaryHeatmap usage updated");
  } else {
    console.log("  ✗ DiaryHeatmap usage not found");
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiarySidebar.tsx");
  }
}

// ============ 3. DiaryPanel.tsx - pass onSelectDate to DiarySidebar ============
{
  const { p, content } = readFile("apps/diary/DiaryPanel.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // Update DiarySidebar usage to pass onSelectDate
  const oldSidebar = '<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={setFilterMode} />';
  const newSidebar = '<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={setFilterMode} onSelectDate={handleDateChange} />';

  if (n.includes(oldSidebar)) {
    n = n.replace(oldSidebar, newSidebar);
    changed = true;
    console.log("  ✓ DiarySidebar usage updated");
  } else {
    console.log("  ✗ DiarySidebar usage not found");
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryPanel.tsx");
  }
}

// ============ 4. DiaryFilterBar.tsx - enable random button ============
{
  const { p, content } = readFile("apps/diary/components/DiaryFilterBar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // Remove disabled: true from random filter
  const oldFilter = '{ key: "random", icon: Shuffle, disabled: true }';
  const newFilter = '{ key: "random", icon: Shuffle }';

  if (n.includes(oldFilter)) {
    n = n.replace(oldFilter, newFilter);
    changed = true;
    console.log("  ✓ random filter enabled");
  } else {
    console.log("  ✗ random filter pattern not found");
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryFilterBar.tsx");
  }
}

// ============ 5. DiaryEditor.tsx - implement random walk ============
{
  const { p, content } = readFile("apps/diary/DiaryEditor.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  let changed = false;

  // 1. Add useState for random selection after the existing state declarations
  // Find a good insertion point - after the last state declaration before journalQuery
  const oldStates = `\tconst [isSaving, setIsSaving] = useState(false);`;
  const newStates = `\tconst [isSaving, setIsSaving] = useState(false);
\tconst [randomShuffle, setRandomShuffle] = useState(0);`;

  if (n.includes(oldStates)) {
    n = n.replace(oldStates, newStates);
    changed = true;
    console.log("  ✓ randomShuffle state added");
  } else {
    console.log("  ✗ isSaving state pattern not found");
  }

  // 2. Add random selection logic before sortedNotes
  // sortedNotes is computed from notesList, we need to wrap it or add random selection
  const oldSortedNotes = `\tconst sortedNotes = useMemo(() => {
\t\treturn [...notesList].sort((a, b) => {
\t\t\tconst aPinned = pinnedIds.includes(a.id);
\t\t\tconst bPinned = pinnedIds.includes(b.id);
\t\t\tif (aPinned && !bPinned) return -1;
\t\t\tif (!aPinned && bPinned) return 1;
\t\t\treturn 0;
\t\t});
\t}, [notesList, pinnedIds]);`;

  const newSortedNotes = `\tconst sortedNotes = useMemo(() => {
\t\tconst sorted = [...notesList].sort((a, b) => {
\t\t\tconst aPinned = pinnedIds.includes(a.id);
\t\t\tconst bPinned = pinnedIds.includes(b.id);
\t\t\tif (aPinned && !bPinned) return -1;
\t\t\tif (!aPinned && bPinned) return 1;
\t\t\treturn 0;
\t\t});
\t\tif (filterMode === "random") {
\t\t\t// Use randomShuffle as seed to get different random results each time
\t\t\tconst shuffled = [...sorted].sort(() => Math.random() - 0.5);
\t\t\treturn shuffled.slice(0, 3);
\t\t}
\t\treturn sorted;
\t}, [notesList, pinnedIds, filterMode, randomShuffle]);`;

  if (n.includes(oldSortedNotes)) {
    n = n.replace(oldSortedNotes, newSortedNotes);
    changed = true;
    console.log("  ✓ sortedNotes random logic added");
  } else {
    console.log("  ✗ sortedNotes pattern not found");
  }

  // 3. Add reshuffle button in the notes list header area
  // Find the "No notes yet" empty state and the notes list header
  const oldNotesHeader = `\t\t\t\t<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
\t\t\t\t\t{sortedNotes.length === 0 ? (
\t\t\t\t\t\t<div className="text-xs text-muted-foreground/50 italic text-center pt-8">`;

  const newNotesHeader = `\t\t\t\t<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
\t\t\t\t\t{filterMode === "random" && (
\t\t\t\t\t\t<div className="flex items-center justify-between mb-2">
\t\t\t\t\t\t\t<span className="text-xs font-medium text-primary">{t("sidebarFilterRandom")}</span>
\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\tonClick={() => setRandomShuffle((prev) => prev + 1)}
\t\t\t\t\t\t\t\tclassName="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t{t("sidebarFilterRandom")}
\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t</div>
\t\t\t\t\t)}
\t\t\t\t\t{sortedNotes.length === 0 ? (
\t\t\t\t\t\t<div className="text-xs text-muted-foreground/50 italic text-center pt-8">`;

  if (n.includes(oldNotesHeader)) {
    n = n.replace(oldNotesHeader, newNotesHeader);
    changed = true;
    console.log("  ✓ reshuffle button added");
  } else {
    console.log("  ✗ notes header pattern not found");
  }

  if (changed) {
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryEditor.tsx");
  }
}

console.log("\n✅ Done");
