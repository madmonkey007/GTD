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

// ============================================================
// 1. PanelHeader.tsx — add hideMenu prop
// ============================================================
{
  const { p, content } = readFile("components/common/layout/PanelHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Add hideMenu to destructuring
  const oldDest = 'disableDrag = false,\n\ticonClassName,';
  const newDest = 'disableDrag = false,\n\thideMenu = false,\n\ticonClassName,';
  if (n.includes(oldDest)) {
    n = n.replace(oldDest, newDest);
    console.log("✓ PanelHeader: destructure");
  } else console.log("✗ PanelHeader: destructure");

  // Add hideMenu to interface
  const oldIf = '\tdisableDrag?: boolean;\n\t/** 自定义标题 icon 的样式（会覆盖全局配置） */\n\ticonClassName?: string;';
  const newIf = '\tdisableDrag?: boolean;\n\t/** 是否隐藏三点菜单（切换面板入口） */\n\thideMenu?: boolean;\n\t/** 自定义标题 icon 的样式（会覆盖全局配置） */\n\ticonClassName?: string;';
  if (n.includes(oldIf)) {
    n = n.replace(oldIf, newIf);
    console.log("✓ PanelHeader: interface");
  } else console.log("✗ PanelHeader: interface");

  // Add hideMenu check in rendering
  const oldRender = '{position && <PanelHeaderMenu position={position} />}';
  const newRender = '{position && !hideMenu && <PanelHeaderMenu position={position} />}';
  if (n.includes(oldRender)) {
    n = n.replace(oldRender, newRender);
    console.log("✓ PanelHeader: render");
  } else console.log("✗ PanelHeader: render");

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 2. TodoToolbar.tsx — pass hideMenu
// ============================================================
{
  const { p, content } = readFile("apps/todo-list/TodoToolbar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldT = '<PanelHeader\n\t\ticon={ListTodo}\n\t\ttitle={t("todoListTitle")}\n\t\tactions={';
  const newT = '<PanelHeader\n\t\ticon={ListTodo}\n\t\ttitle={t("todoListTitle")}\n\t\thideMenu\n\t\tactions={';
  if (n.includes(oldT)) {
    n = n.replace(oldT, newT);
    console.log("✓ TodoToolbar: hideMenu");
  } else console.log("✗ TodoToolbar");

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 3. DetailHeader.tsx — full rewrite
// ============================================================
{
  // We'll rebuild this file from scratch since the old script
  // already removed the import. Let's work with current state.
  const { p, content } = readFile("apps/todo-detail/components/DetailHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // The import was already changed to `import { FileText } from "lucide-react";`

  // Fix the interface (remove onToggleComplete and onDelete)
  const oldIf = 'interface DetailHeaderProps {\n\tonToggleComplete: () => void;\n\tonDelete: () => void;\n\tactiveView: "detail" | "artifacts";\n\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}';
  const newIf = 'interface DetailHeaderProps {\n\tactiveView: "detail" | "artifacts";\n\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}';
  if (n.includes(oldIf)) {
    n = n.replace(oldIf, newIf);
    console.log("✓ DetailHeader: interface");
  } else console.log("✗ DetailHeader: interface");

  // Fix the function signature
  const oldFn = 'export function DetailHeader({\n\t\tonToggleComplete,\n\t\tonDelete,\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {';
  const newFn = 'export function DetailHeader({\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {';
  if (n.includes(oldFn)) {
    n = n.replace(oldFn, newFn);
    console.log("✓ DetailHeader: function signature");
  } else console.log("✗ DetailHeader: function signature");

  // Replace the full PanelHeader block to add hideMenu and remove buttons
  const oldPH = '<PanelHeader\n\t\ticon={FileText}\n\t\ttitle={t("todoDetailLabel")}\n\t\tactions={\n\t\t\t<>\n\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t)}\n\t\t\t\t\t>\n\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t</button>\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t)}\n\t\t\t\t\t>\n\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t\t<PanelActionButton\n\t\t\t\t\tvariant="default"\n\t\t\t\t\ticon={CheckCircle2}\n\t\t\t\t\tonClick={onToggleComplete}\n\t\t\t\t\taria-label={tTodoDetail("markAsComplete")}\n\t\t\t\t/>\n\t\t\t\t<PanelActionButton\n\t\t\t\t\tvariant="destructive"\n\t\t\t\t\ticon={Trash2}\n\t\t\t\t\tonClick={onDelete}\n\t\t\t\t\taria-label={tTodoDetail("delete")}\n\t\t\t\t/>\n\t\t\t</>\n\t\t}\n\t/>';

  const newPH = '<PanelHeader\n\t\ticon={FileText}\n\t\ttitle={t("todoDetailLabel")}\n\t\thideMenu\n\t\tactions={\n\t\t\t<>\n\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t)}\n\t\t\t\t\t>\n\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t</button>\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t)}\n\t\t\t\t\t>\n\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</>\n\t\t}\n\t/>';

  if (n.includes(oldPH)) {
    n = n.replace(oldPH, newPH);
    console.log("✓ DetailHeader: PanelHeader updated");
  } else {
    console.log("✗ DetailHeader: PanelHeader block not found");
    // Debug
    const idx = n.indexOf('<PanelHeader');
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 80)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 4. HeaderBar.tsx — pass hideMenu
// ============================================================
{
  const { p, content } = readFile("apps/chat/components/layout/HeaderBar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldH = '<PanelHeader\n\t\ticon={MessageSquare}\n\t\ttitle={t("chatLabel")}\n\t\tactions={';
  const newH = '<PanelHeader\n\t\ticon={MessageSquare}\n\t\ttitle={t("chatLabel")}\n\t\thideMenu\n\t\tactions={';
  if (n.includes(oldH)) {
    n = n.replace(oldH, newH);
    console.log("✓ HeaderBar: hideMenu");
  } else console.log("✗ HeaderBar");

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 5. TodoDetail.tsx — clean up DetailHeader usage
// ============================================================
{
  const { p, content } = readFile("apps/todo-detail/TodoDetail.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldUsage = '<DetailHeader\n\t\t\t\tonToggleComplete={handleToggleComplete}\n\t\t\t\tonDelete={handleDeleteRequest}\n\t\t\t\tactiveView={activeView}\n\t\t\t\tonViewChange={setActiveView}\n\t\t\t/>';
  const newUsage = '<DetailHeader\n\t\t\t\tactiveView={activeView}\n\t\t\t\tonViewChange={setActiveView}\n\t\t\t/>';

  if (n.includes(oldUsage)) {
    n = n.replace(oldUsage, newUsage);
    console.log("✓ TodoDetail: cleaned up DetailHeader usage");
  } else {
    console.log("✗ TodoDetail: DetailHeader usage not found");
    const idx = n.indexOf('<DetailHeader');
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 220)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

console.log("\n✅ All done!");
