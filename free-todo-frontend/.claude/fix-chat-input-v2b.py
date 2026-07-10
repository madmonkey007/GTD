#!/usr/bin/env python3
"""Fix chat input v2b - InputBox, LinkedTodos, ToolSelector"""

# ============================================================
# 3. InputBox.tsx - Remove modeSwitcher, add onSlashTyped
# ============================================================
with open('apps/chat/components/input/InputBox.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0
warnings = []

# 3a. Update type props - remove modeSwitcher/modeMenuOpen, add onSlashTyped
old_props = '\tonKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;\n\tonCompositionStart: () => void;\n\tonCompositionEnd: () => void;\n\tmodeSwitcher?: React.ReactNode;\n\t/** Mode Switcher 菜单是否打开 */\n\tmodeMenuOpen?: boolean;\n\tonAtClick?: () => void;\n\tlinkedTodos?: React.ReactNode;'
new_props = '\tonKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;\n\tonCompositionStart: () => void;\n\tonCompositionEnd: () => void;\n\tonAtClick?: () => void;\n\tonSlashTyped?: () => void;\n\tlinkedTodos?: React.ReactNode;'

if old_props in content:
    content = content.replace(old_props, new_props)
    changes += 1
    print("OK InputBox: updated props type")
else:
    warnings.append("props type not matched")
    # Find the area
    idx = content.find('onCompositionEnd')
    if idx >= 0:
        print(f"  DEBUG: onCompositionEnd context: {repr(content[idx:idx+200])}")

# 3b. Update function signature
old_sig = '\tonCompositionStart,\n\tonCompositionEnd,\n\tmodeSwitcher,\n\tmodeMenuOpen = false,\n\tonAtClick,'
new_sig = '\tonCompositionStart,\n\tonCompositionEnd,\n\tonAtClick,\n\tonSlashTyped,'

if old_sig in content:
    content = content.replace(old_sig, new_sig)
    changes += 1
    print("OK InputBox: updated function signature")
else:
    warnings.append("function signature not matched")
    idx = content.find('onCompositionEnd,')
    if idx >= 0:
        print(f"  DEBUG: signature context: {repr(content[idx:idx+150])}")

# 3c. Remove layout logic (isCompactLayout, hasModeSwitcher, isExpandedLayout)
old_layout = '\t// 判断是否使用单行紧凑布局：Mode Switcher 菜单没打开的时候使用它\n\tconst isCompactLayout = !modeMenuOpen;\n\t// 判断是否需要显示 Mode Switcher（作为 modeSwitcher 存在）\n\tconst hasModeSwitcher = !!modeSwitcher;\n\t// 展开模式：有 modeSwitcher 且菜单打开时\n\tconst isExpandedLayout = hasModeSwitcher && modeMenuOpen;'
new_layout = '\t// 始终使用紧凑布局（单行）\n\tconst isCompactLayout = true;'

if old_layout in content:
    content = content.replace(old_layout, new_layout)
    changes += 1
    print("OK InputBox: simplified layout logic")
else:
    warnings.append("layout logic not matched")
    idx = content.find('isCompactLayout')
    if idx >= 0:
        print(f"  DEBUG: layout context: {repr(content[idx:idx+200])}")

# 3d. Replace compact layout - remove modeSwitcher rendering, add slash detection in onKeyDown
old_compact = '\t// 紧凑布局：输入框和按钮在同一行\n\tif (isCompactLayout && !isExpandedLayout) {\n\t\treturn (\n\t\t\t<div\n\t\t\t\tclassName={cn(\n\t\t\t\t\t"flex flex-col rounded-xl border border-border",\n\t\t\t\t\t"bg-background/60 px-3 py-2 mb-4",\n\t\t\t\t)}\n\t\t\t>\n\t\t\t\t{/* 关联待办区域 */}\n\t\t\t\t{linkedTodos}\n\n\t\t\t\t{/* 单行布局：输入框和按钮在同一行 */}\n\t\t\t\t<div className="flex items-center gap-2">\n\t\t\t\t\t{/* 左侧：mode switcher */}\n\t\t\t\t\t{modeSwitcher && (\n\t\t\t\t\t\t<div className="shrink-0">{modeSwitcher}</div>\n\t\t\t\t\t)}\n\n\t\t\t\t\t{/* 中间：输入框 */}\n\t\t\t\t\t<textarea\n\t\t\t\t\t\tref={textareaRef}\n\t\t\t\t\t\tvalue={inputValue}\n\t\t\t\t\t\tonChange={handleChange}\n\t\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\t\t\tplaceholder={placeholder}\n\t\t\t\t\t\trows={SINGLE_LINE_ROWS}\n\t\t\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t\t\t)}\n\t\t\t\t\t/>\n\n\t\t\t\t\t{/* 右侧：按钮组 */}\n\t\t\t\t\t{actionButtons}\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t);\n\t}'

new_compact = '\t// 紧凑布局：输入框和按钮在同一行\n\tif (isCompactLayout) {\n\t\treturn (\n\t\t\t<div\n\t\t\t\tclassName={cn(\n\t\t\t\t\t"flex flex-col rounded-xl border border-border",\n\t\t\t\t\t"bg-background/60 px-3 py-2 mb-4",\n\t\t\t\t)}\n\t\t\t>\n\t\t\t\t{/* 关联待办区域 */}\n\t\t\t\t{linkedTodos}\n\n\t\t\t\t{/* 单行布局：输入框和按钮在同一行 */}\n\t\t\t\t<div className="flex items-center gap-2">\n\t\t\t\t\t{/* 中间：输入框 */}\n\t\t\t\t\t<textarea\n\t\t\t\t\t\tref={textareaRef}\n\t\t\t\t\t\tvalue={inputValue}\n\t\t\t\t\t\tonChange={handleChange}\n\t\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\t\tonKeyDown={(e) => {\n\t\t\t\t\t\t\tif (e.key === "/" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {\n\t\t\t\t\t\t\t\te.preventDefault();\n\t\t\t\t\t\t\t\tonSlashTyped?.();\n\t\t\t\t\t\t\t\treturn;\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tonKeyDown(e);\n\t\t\t\t\t\t}}\n\t\t\t\t\t\tplaceholder={placeholder}\n\t\t\t\t\t\trows={SINGLE_LINE_ROWS}\n\t\t\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t"flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t\t\t)}\n\t\t\t\t\t/>\n\n\t\t\t\t\t{/* 右侧：按钮组 */}\n\t\t\t\t\t{actionButtons}\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t);\n\t}'

if old_compact in content:
    content = content.replace(old_compact, new_compact)
    changes += 1
    print("OK InputBox: replaced compact layout, added slash detection")
else:
    warnings.append("compact layout not matched")
    idx = content.find('isCompactLayout && !isExpandedLayout')
    if idx >= 0:
        print(f"  DEBUG: compact layout at {idx}")
        # Show some context around it
        start = max(0, idx - 50)
        end = min(len(content), idx + 300)
        print(f"  Content: {repr(content[start:end])}")

# 3e. Remove expanded layout
old_expanded = '\t// 展开布局：输入框在上方，工具栏在下方\n\treturn (\n\t\t<div\n\t\t\tclassName={cn(\n\t\t\t\t"relative flex flex-col rounded-xl border border-border",\n\t\t\t\t"bg-background/60 px-3 pt-2 pb-14",\n\t\t\t)}\n\t\t>\n\t\t\t{/* 关联待办区域 */}\n\t\t\t{linkedTodos}\n\n\t\t\t<textarea\n\t\t\t\tref={textareaRef}\n\t\t\t\tvalue={inputValue}\n\t\t\t\tonChange={handleChange}\n\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\tplaceholder={placeholder}\n\t\t\t\trows={MULTI_LINE_ROWS}\n\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\tclassName={cn(\n\t\t\t\t\t"w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t)}\n\t\t\t/>\n\n\t\t\t{/* 底部工具栏 - 绝对定位在底部 */}\n\t\t\t<div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">\n\t\t\t\t{/* 左下角：mode switcher */}\n\t\t\t\t<div className="flex items-center">{modeSwitcher}</div>\n\n\t\t\t\t{/* 右下角：按钮组 */}\n\t\t\t\t{actionButtons}\n\t\t\t</div>\n\t\t</div>\n\t);'

if old_expanded in content:
    content = content.replace(old_expanded, "")
    changes += 1
    print("OK InputBox: removed expanded layout")
else:
    warnings.append("expanded layout not found")
    idx = content.find('展开布局')
    if idx >= 0:
        print(f"  DEBUG: expanded layout at {idx}")
        print(f"  Content: {repr(content[idx:idx+400])}")

# 3f. Remove MULTI_LINE_ROWS constant
content = content.replace('\nconst MULTI_LINE_ROWS = 1;', '')
# Don't count as change, might not be there

if changes > 0:
    with open('apps/chat/components/input/InputBox.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"OK InputBox.tsx saved ({changes} changes)")
else:
    print("FAIL: No changes to InputBox.tsx")

for w in warnings:
    print(f"  WARNING: {w}")

# ============================================================
# 4. LinkedTodos.tsx - Redesign tags
# ============================================================
with open('apps/chat/components/input/LinkedTodos.tsx', 'r', encoding='utf-8') as f:
    linked = f.read()

changes4 = 0

old_linked = '''\treturn (
\t\t<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">
\t\t\t<span className="text-xs font-semibold text-foreground">
\t\t\t\t{t("linkedTodos", { count: effectiveTodos.length })}
\t\t\t</span>
\t\t\t{previewTodos.map((todo) => (
\t\t\t\t<button
\t\t\t\t\tkey={todo.id}
\t\t\t\t\ttype="button"
\t\t\t\t\tonClick={() => onToggleTodo(todo.id)}
\t\t\t\t\tclassName="rounded-full border border-border/70 bg-card/80 px-2 py-1 text-xs text-foreground hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer"
\t\t\t\t>
\t\t\t\t\t{todo.name}
\t\t\t\t</button>
\t\t\t))}
\t\t\t{hiddenCount > 0 && (
\t\t\t\t<span className="text-xs text-muted-foreground">+{hiddenCount}</span>
\t\t\t)}
\t\t\t{effectiveTodos.length > 3 && (
\t\t\t\t<button
\t\t\t\t\ttype="button"
\t\t\t\t\tonClick={onToggleExpand}
\t\t\t\t\tclassName="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
\t\t\t\t>
\t\t\t\t\t{showTodosExpanded ? t("collapse") : t("expand")}
\t\t\t\t</button>
\t\t\t)}
\t\t\t{hasSelection && (
\t\t\t\t<button
\t\t\t\t\ttype="button"
\t\t\t\t\tonClick={onClearSelection}
\t\t\t\t\tclassName="text-[11px] text-[oklch(var(--primary))] transition-colors hover:text-[oklch(var(--primary-border))]"
\t\t\t\t>
\t\t\t\t\t{t("clearSelection")}
\t\t\t\t</button>
\t\t\t)}
\t\t</div>
\t);'''

new_linked = '''\treturn (
\t\t<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">
\t\t\t{previewTodos.map((todo) => (
\t\t\t\t<div
\t\t\t\t\tkey={todo.id}
\t\t\t\t\tclassName="relative group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 pl-3 pr-2 py-1"
\t\t\t\t>
\t\t\t\t\t<span className="text-xs text-foreground">{todo.name}</span>
\t\t\t\t\t<button
\t\t\t\t\t\ttype="button"
\t\t\t\t\t\tonClick={(e) => {
\t\t\t\t\t\t\te.stopPropagation();
\t\t\t\t\t\t\tonToggleTodo(todo.id);
\t\t\t\t\t\t}}
\t\t\t\t\t\tclassName="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
\t\t\t\t\t\taria-label={t("removeLinkedTodo")}
\t\t\t\t\t>
\t\t\t\t\t\t<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
\t\t\t\t\t\t\t<path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
\t\t\t\t\t\t</svg>
\t\t\t\t\t</button>
\t\t\t\t</div>
\t\t\t))}
\t\t\t{hiddenCount > 0 && (
\t\t\t\t<span className="text-xs text-muted-foreground">+{hiddenCount}</span>
\t\t\t)}
\t\t\t{effectiveTodos.length > 3 && (
\t\t\t\t<button
\t\t\t\t\ttype="button"
\t\t\t\t\tonClick={onToggleExpand}
\t\t\t\t\tclassName="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
\t\t\t\t>
\t\t\t\t\t{showTodosExpanded ? t("collapse") : t("expand")}
\t\t\t\t</button>
\t\t\t)}
\t\t</div>
\t);'''

if old_linked in linked:
    linked = linked.replace(old_linked, new_linked)
    changes4 += 1
    print("OK LinkedTodos: redesigned tags with X buttons")
else:
    print("FAIL LinkedTodos: return block not matched")
    idx = linked.find('return (')
    if idx >= 0:
        print(f"  DEBUG: return block at {idx}")
        print(f"  Content: {repr(linked[idx:idx+300])}")

if changes4 > 0:
    with open('apps/chat/components/input/LinkedTodos.tsx', 'w', encoding='utf-8') as f:
        f.write(linked)
    print(f"OK LinkedTodos.tsx saved ({changes4} changes)")

# ============================================================
# 5. ToolSelector.tsx - Add isOpen/onOpenChange
# ============================================================
with open('apps/chat/components/input/ToolSelector.tsx', 'r', encoding='utf-8') as f:
    selector = f.read()

changes5 = 0

# 5a. Update props interface
old_ts_iface = '''\tinterface ToolSelectorProps {
\t\t/** 是否禁用 */
\t\tdisabled?: boolean;
\t}'''

new_ts_iface = '''\tinterface ToolSelectorProps {
\t\t/** 是否禁用 */
\t\tdisabled?: boolean;
\t\t/** 外部控制是否打开下拉菜单 */
\t\tisOpen?: boolean;
\t\t/** 外部控制状态变化回调 */
\t\tonOpenChange?: (open: boolean) => void;
\t}'''

if old_ts_iface in selector:
    selector = selector.replace(old_ts_iface, new_ts_iface)
    changes5 += 1
    print("OK ToolSelector: updated props interface")
else:
    print("FAIL ToolSelector: props interface not matched")
    idx = selector.find('interface ToolSelectorProps')
    if idx >= 0:
        print(f"  DEBUG: interface at {idx}: {repr(selector[idx:idx+200])}")

# 5b. Update function signature
old_ts_sig = 'function ToolSelector({ disabled = false }: ToolSelectorProps) {'
new_ts_sig = 'function ToolSelector({ disabled = false, isOpen: externalIsOpen, onOpenChange }: ToolSelectorProps) {'

if old_ts_sig in selector:
    selector = selector.replace(old_ts_sig, new_ts_sig)
    changes5 += 1
    print("OK ToolSelector: updated function signature")
else:
    print("FAIL ToolSelector: function signature not matched")

# 5c. Replace useState with external-aware state management
old_ts_state = '\tconst [isOpen, setIsOpen] = useState(false);'

new_ts_state = '''\tconst [internalIsOpen, setInternalIsOpen] = useState(false);
\tconst isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
\tconst setIsOpen = (open: boolean) => {
\t\tif (onOpenChange) onOpenChange(open);
\t\telse setInternalIsOpen(open);
\t};'''

if old_ts_state in selector:
    selector = selector.replace(old_ts_state, new_ts_state)
    changes5 += 1
    print("OK ToolSelector: updated state management")
else:
    print("FAIL ToolSelector: state not matched")
    idx = selector.find('const [isOpen, setIsOpen]')
    if idx >= 0:
        print(f"  DEBUG: state at {idx}: {repr(selector[idx:idx+60])}")

if changes5 > 0:
    with open('apps/chat/components/input/ToolSelector.tsx', 'w', encoding='utf-8') as f:
        f.write(selector)
    print(f"OK ToolSelector.tsx saved ({changes5} changes)")

print("=== Phase 2 done ===")
