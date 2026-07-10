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

  // Add hideMenu to the interface (after disableDrag)
  const oldInterface = `	/** 是否禁用拖拽（即使有 position context） */\n\tdisableDrag?: boolean;\n\t/** 自定义标题 icon 的样式（会覆盖全局配置） */\n\ticonClassName?: string;`;

  const newInterface = `	/** 是否禁用拖拽（即使有 position context） */\n\tdisableDrag?: boolean;\n\t/** 是否隐藏三点菜单（切换面板入口） */\n\thideMenu?: boolean;\n\t/** 自定义标题 icon 的样式（会覆盖全局配置） */\n\ticonClassName?: string;`;

  if (n.includes(oldInterface)) {
    n = n.replace(oldInterface, newInterface);
    console.log("✓ PanelHeader.tsx: added hideMenu to interface");
  } else {
    console.log("✗ PanelHeader.tsx: interface not found");
  }

  // Use hideMenu in the conditional rendering
  const oldRender = `{position && <PanelHeaderMenu position={position} />}`;
  const newRender = `{position && !hideMenu && <PanelHeaderMenu position={position} />}`;

  if (n.includes(oldRender)) {
    n = n.replace(oldRender, newRender);
    console.log("✓ PanelHeader.tsx: added hideMenu check");
  } else {
    console.log("✗ PanelHeader.tsx: render not found");
  }

  // Update destructuring to include hideMenu
  const oldDestructure = `\t\tdisableDrag = false,\n\t\ticonClassName,`;
  const newDestructure = `\t\tdisableDrag = false,\n\t\thideMenu = false,\n\t\ticonClassName,`;

  if (n.includes(oldDestructure)) {
    n = n.replace(oldDestructure, newDestructure);
    console.log("✓ PanelHeader.tsx: added hideMenu destructuring");
  } else {
    console.log("✗ PanelHeader.tsx: destructure not found");
  }

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 2. TodoToolbar.tsx — pass hideMenu
// ============================================================
{
  const { p, content } = readFile("apps/todo-list/TodoToolbar.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldHeader = `<PanelHeader\n\t\t\t\ticon={ListTodo}\n\t\t\t\ttitle={t("todoListTitle")}\n\t\t\t\tactions={`;

  const newHeader = `<PanelHeader\n\t\t\t\ticon={ListTodo}\n\t\t\t\ttitle={t("todoListTitle")}\n\t\t\t\thideMenu\n\t\t\t\tactions={`;

  // Use a more targeted replacement
  if (n.includes(oldHeader)) {
    n = n.replace(oldHeader, newHeader);
    console.log("✓ TodoToolbar.tsx: added hideMenu");
  } else {
    console.log("✗ TodoToolbar.tsx: pattern not found");
    // Show what we have
    const idx = n.indexOf("PanelHeader");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 120)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 3. DetailHeader.tsx — pass hideMenu, remove buttons
// ============================================================
{
  const { p, content } = readFile("apps/todo-detail/components/DetailHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Add hideMenu and remove CheckCircle2/Trash2 buttons
  // Match the full actions block to replace
  const oldBlock = `<PanelHeader\n\t\t\t\ticon={FileText}\n\t\t\t\ttitle={t("todoDetailLabel")}\n\t\t\t\tactions={\n\t\t\t\t\t<>\n\t\t\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<PanelActionButton\n\t\t\t\t\t\t\tvariant="default"\n\t\t\t\t\t\t\ticon={CheckCircle2}\n\t\t\t\t\t\t\tonClick={onToggleComplete}\n\t\t\t\t\t\t\taria-label={tTodoDetail("markAsComplete")}\n\t\t\t\t\t\t/>\n\t\t\t\t\t\t<PanelActionButton\n\t\t\t\t\t\t\tvariant="destructive"\n\t\t\t\t\t\t\ticon={Trash2}\n\t\t\t\t\t\t\tonClick={onDelete}\n\t\t\t\t\t\t\taria-label={tTodoDetail("delete")}\n\t\t\t\t\t\t/>\n\t\t\t\t\t</>\n\t\t\t\t}\n\t\t\t/>`;

  const newBlock = `<PanelHeader\n\t\t\t\ticon={FileText}\n\t\t\t\ttitle={t("todoDetailLabel")}\n\t\t\t\thideMenu\n\t\t\t\tactions={\n\t\t\t\t\t<>\n\t\t\t\t\t\t<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => onViewChange("detail")}\n\t\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\t\tactiveView === "detail"\n\t\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{tTodoDetail("detailViewLabel")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t\t<button\n\t\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\t\tonClick={() => onViewChange("artifacts")}\n\t\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t\t"rounded-full px-2.5 py-1 font-medium transition-colors",\n\t\t\t\t\t\t\t\t\tactiveView === "artifacts"\n\t\t\t\t\t\t\t\t\t\t? "bg-foreground text-background"\n\t\t\t\t\t\t\t\t\t\t: "text-muted-foreground hover:text-foreground",\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t>\n\t\t\t\t\t\t\t\t{tTodoDetail("artifactsViewLabel")}\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</>\n\t\t\t\t}\n\t\t\t/>`;

  if (n.includes(oldBlock)) {
    n = n.replace(oldBlock, newBlock);
    console.log("✓ DetailHeader.tsx: added hideMenu, removed CheckCircle2/Trash2");
  } else {
    console.log("✗ DetailHeader.tsx: old block not found");
    const idx = n.indexOf("PanelHeader");
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

  const oldHeader = `<PanelHeader\n\t\t\t\ticon={MessageSquare}\n\t\t\t\ttitle={t("chatLabel")}\n\t\t\t\tactions={`;

  const newHeader = `<PanelHeader\n\t\t\t\ticon={MessageSquare}\n\t\t\t\ttitle={t("chatLabel")}\n\t\t\t\thideMenu\n\t\t\t\tactions={`;

  if (n.includes(oldHeader)) {
    n = n.replace(oldHeader, newHeader);
    console.log("✓ HeaderBar.tsx: added hideMenu");
  } else {
    console.log("✗ HeaderBar.tsx: pattern not found");
    const idx = n.indexOf("PanelHeader");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 80)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 5. Clean up DetailHeader unused props in interface and TodoDetail.tsx
// ============================================================
{
  // DetailHeader.tsx — remove onToggleComplete and onDelete from interface
  const { p, content } = readFile("apps/todo-detail/components/DetailHeader.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  // Clean up imports - remove CheckCircle2, Trash2 if no longer used
  const oldImport = `import { CheckCircle2, FileText, Trash2 } from "lucide-react";`;
  const newImport = `import { FileText } from "lucide-react";`;

  if (n.includes(oldImport)) {
    n = n.replace(oldImport, newImport);
    console.log("✓ DetailHeader.tsx: cleaned up imports");
  } else {
    console.log("✗ DetailHeader.tsx: import not found");
  }

  // Remove onToggleComplete and onDelete from interface
  const oldInterface = `interface DetailHeaderProps {\n\t\tonToggleComplete: () => void;\n\t\tonDelete: () => void;\n\t\tactiveView: "detail" | "artifacts";\n\t\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}`;

  const newInterface = `interface DetailHeaderProps {\n\t\tactiveView: "detail" | "artifacts";\n\t\tonViewChange: (view: "detail" | "artifacts") => void;\n\t}`;

  if (n.includes(oldInterface)) {
    n = n.replace(oldInterface, newInterface);
    console.log("✓ DetailHeader.tsx: cleaned up interface");
  } else {
    console.log("✗ DetailHeader.tsx: interface not found");
  }

  // Remove destructured props
  const oldDestructure = `export function DetailHeader({\n\t\tonToggleComplete,\n\t\tonDelete,\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {`;

  const newDestructure = `export function DetailHeader({\n\t\tactiveView,\n\t\tonViewChange,\n\t}: DetailHeaderProps) {`;

  if (n.includes(oldDestructure)) {
    n = n.replace(oldDestructure, newDestructure);
    console.log("✓ DetailHeader.tsx: cleaned up destructuring");
  } else {
    console.log("✗ DetailHeader.tsx: destructure not found");
    const idx = n.indexOf("DetailHeader");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 80)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

// ============================================================
// 6. TodoDetail.tsx — remove onToggleComplete and onDelete from DetailHeader usage
// ============================================================
{
  const { p, content } = readFile("apps/todo-detail/TodoDetail.tsx");
  const hasCRLF = content.includes("\r\n");
  let n = normalize(content);

  const oldUsage = `<DetailHeader\n\t\t\t\t\tonToggleComplete={handleToggleComplete}\n\t\t\t\t\tonDelete={handleDeleteRequest}\n\t\t\t\t\tactiveView={activeView}\n\t\t\t\t\tonViewChange={setActiveView}\n\t\t\t\t/>`;

  const newUsage = `<DetailHeader\n\t\t\t\t\tactiveView={activeView}\n\t\t\t\t\tonViewChange={setActiveView}\n\t\t\t\t/>`;

  if (n.includes(oldUsage)) {
    n = n.replace(oldUsage, newUsage);
    console.log("✓ TodoDetail.tsx: cleaned up DetailHeader usage");
  } else {
    console.log("✗ TodoDetail.tsx: usage not found");
    const idx = n.indexOf("DetailHeader");
    if (idx >= 0) console.log("  Found at", idx, ":", JSON.stringify(n.substring(idx, idx + 120)));
  }

  saveFile(p, denormalize(n, hasCRLF));
}

console.log("\n✅ All done!");
