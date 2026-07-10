const fs = require("fs");
const path = require("path");

function readFile(relPath) {
  const p = path.resolve(__dirname, "..", relPath);
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

// ============ 1. TodoToolbar.tsx ============
{
  const { p, content } = readFile("apps/todo-list/TodoToolbar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  // Pattern: <PanelHeader at 2 tabs indent, icon/title/actions at 3 tabs
  const oldT = '<PanelHeader\n\t\t\ticon={ListTodo}\n\t\t\ttitle={t("todoListTitle")}\n\t\t\tactions={';
  const newT = '<PanelHeader\n\t\t\ticon={ListTodo}\n\t\t\ttitle={t("todoListTitle")}\n\t\t\thideMenu\n\t\t\tactions={';
  if (n.includes(oldT)) {
    n = n.replace(oldT, newT);
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ TodoToolbar");
  } else {
    console.log("✗ TodoToolbar - finding actual...");
    const idx = n.indexOf("PanelHeader");
    if (idx >= 0) console.log("  At", idx, ":", JSON.stringify(n.substring(idx, idx + 100)));
  }
}

// ============ 2. DetailHeader.tsx (full) ============
{
  const { p, content } = readFile("apps/todo-detail/components/DetailHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Fix interface
  const oldIf = 'interface DetailHeaderProps {\n\t\tonToggleComplete: () => void;\n\t\tonDelete: () => void;\n\t\tactiveView: "detail" | "artifacts";\n\t\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}';
  const newIf = 'interface DetailHeaderProps {\n\t\tactiveView: "detail" | "artifacts";\n\t\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}';
  let changed = false;
  if (n.includes(oldIf)) { n = n.replace(oldIf, newIf); changed = true; console.log("✓ DetailHeader: interface"); }
  else console.log("✗ DetailHeader: interface");

  // Fix function signature
  const oldFn = 'export function DetailHeader({\n\t\tonToggleComplete,\n\t\tonDelete,\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {';
  const newFn = 'export function DetailHeader({\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {';
  if (n.includes(oldFn)) { n = n.replace(oldFn, newFn); changed = true; console.log("✓ DetailHeader: function"); }
  else console.log("✗ DetailHeader: function");

  // Replace full PanelHeader block: hideMenu + remove buttons
  const oldPH = '<PanelHeader\n\t\t\ticon={FileText}\n\t\t\ttitle={t("todoDetailLabel")}\n\t\t\tactions={\n\t\t\t\t<>\n\t\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t\t<button\n\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t\t</button>\n\t\t\t\t\t\t<button\n\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t\t</button>\n\t\t\t\t\t</div>\n\t\t\t\t\t<PanelActionButton\n\t\t\t\t\t\tvariant="default"\n\t\t\t\t\t\ticon={CheckCircle2}\n\t\t\t\t\t\tonClick={onToggleComplete}\n\t\t\t\t\t\taria-label={tTodoDetail("markAsComplete")}\n\t\t\t\t\t/>\n\t\t\t\t\t<PanelActionButton\n\t\t\t\t\t\tvariant="destructive"\n\t\t\t\t\t\ticon={Trash2}\n\t\t\t\t\t\tonClick={onDelete}\n\t\t\t\t\t\taria-label={tTodoDetail("delete")}\n\t\t\t\t\t/>\n\t\t\t\t</>\n\t\t\t}\n\t\t/>';

  const newPH = '<PanelHeader\n\t\t\ticon={FileText}\n\t\t\ttitle={t("todoDetailLabel")}\n\t\t\thideMenu\n\t\t\tactions={\n\t\t\t\t<>\n\t\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t\t<button\n\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t\t</button>\n\t\t\t\t\t\t<button\n\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t\t</button>\n\t\t\t\t\t</div>\n\t\t\t\t</>\n\t\t\t}\n\t\t/>';

  if (n.includes(oldPH)) { n = n.replace(oldPH, newPH); changed = true; console.log("✓ DetailHeader: PanelHeader block"); }
  else {
    console.log("✗ DetailHeader: PanelHeader block");
    const idx = n.indexOf("<PanelHeader");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 200)));
  }

  if (changed) saveFile(p, denormalize(n, hasCRLF));
}

// ============ 3. HeaderBar.tsx ============
{
  const { p, content } = readFile("apps/chat/components/layout/HeaderBar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);
  const oldH = '<PanelHeader\n\t\t\ticon={MessageSquare}\n\t\t\ttitle={t("chatLabel")}\n\t\t\tactions={';
  const newH = '<PanelHeader\n\t\t\ticon={MessageSquare}\n\t\t\ttitle={t("chatLabel")}\n\t\t\thideMenu\n\t\t\tactions={';
  if (n.includes(oldH)) {
    n = n.replace(oldH, newH);
    saveFile(p, denormalize(n, hasCRLF));
    console.log("✓ HeaderBar");
  } else {
    console.log("✗ HeaderBar");
    const idx = n.indexOf("PanelHeader");
    if (idx >= 0) console.log("  At", idx, ":", JSON.stringify(n.substring(idx, idx + 100)));
  }
}

console.log("\n✅ Done");
