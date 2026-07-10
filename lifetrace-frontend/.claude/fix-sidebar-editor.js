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

// ============ 1. DiarySidebar.tsx - pass onSelectDate ============
{
  const { p, content } = readFile("apps/diary/components/DiarySidebar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Debug: 4 tabs for <DiaryHeatmap, 5 tabs for attrs, 4 tabs for />
  const oldUsage = '<DiaryHeatmap\n\t\t\t\t\tdates={stats.dates}\n\t\t\t\t\tdailyCounts={stats.dailyCounts}\n\t\t\t\t\tmaxDailyCount={stats.maxDailyCount}\n\t\t\t\t/>';
  const newUsage = '<DiaryHeatmap\n\t\t\t\t\tdates={stats.dates}\n\t\t\t\t\tdailyCounts={stats.dailyCounts}\n\t\t\t\t\tmaxDailyCount={stats.maxDailyCount}\n\t\t\t\t\tonSelectDate={onSelectDate}\n\t\t\t\t/>';

  if (n.includes(oldUsage)) {
    n = n.replace(oldUsage, newUsage);
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiarySidebar.tsx");
  } else {
    console.log("✗ DiarySidebar: DiaryHeatmap usage not found");
    const idx = n.indexOf("DiaryHeatmap");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 120)));
  }
}

// ============ 2. DiaryEditor.tsx - fix notes header ============
{
  const { p, content } = readFile("apps/diary/DiaryEditor.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Debug: 3 tabs for <div>, 4 tabs for {sortedNotes...}
  const oldHeader = '<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">\n\t\t\t\t{sortedNotes.length === 0 ? (\n\t\t\t\t\t<div className="text-xs text-muted-foreground/50 italic text-center pt-8">';
  const newHeader = '<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">\n\t\t\t\t\t{filterMode === "random" && (\n\t\t\t\t\t\t<div className="flex items-center justify-between mb-2">\n\t\t\t\t\t\t\t<span className="text-xs font-medium text-primary">{t("sidebarFilterRandom")}</span>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => setRandomShuffle((prev) => prev + 1)}\n\t\t\t\t\t\t\t\tclassName="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{t("sidebarFilterRandom")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t)}\n\t\t\t\t{sortedNotes.length === 0 ? (\n\t\t\t\t\t<div className="text-xs text-muted-foreground/50 italic text-center pt-8">';

  if (n.includes(oldHeader)) {
    n = n.replace(oldHeader, newHeader);
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ DiaryEditor.tsx");
  } else {
    console.log("✗ DiaryEditor: notes header not found");
    const idx = n.indexOf("flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 200)));
  }
}

console.log("\n✅ Done");
