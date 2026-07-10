#!/usr/bin/env python3
"""Fix chat input: prompt popup, slash trigger, linked-todo tags"""

import re

# ============================================================
# 1. ChatPanel.tsx - Remove PromptSuggestions, pass showSuggestions
# ============================================================
with open('apps/chat/ChatPanel.tsx', 'r', encoding='utf-8') as f:
    panel = f.read()

changes = 0

# 1a. Remove PromptSuggestions import
old_import = "import { PromptSuggestions } from \"@/apps/chat/components/input/PromptSuggestions\";"
if old_import in panel:
    panel = panel.replace(old_import, "")
    changes += 1
    print("OK ChatPanel: removed PromptSuggestions import")
else:
    print("FAIL ChatPanel: PromptSuggestions import not found")

# 1b. Remove shouldShowSuggestions useMemo block
old_showsug = '\tconst shouldShowSuggestions = useMemo(() => {\n\t\tconst messages = chatController.messages;\n\t\tif (messages.length === 0) return true;\n\t\tif (messages.length === 1 && messages[0].role === "assistant") return true;\n\t\tif (messages.every((msg) => msg.role === "assistant")) return true;\n\t\treturn false;\n\t}, [chatController.messages]);\n'
if old_showsug in panel:
    panel = panel.replace(old_showsug, "")
    changes += 1
    print("OK ChatPanel: removed shouldShowSuggestions")
else:
    print("FAIL ChatPanel: shouldShowSuggestions not found")
    # Debug: find the pattern
    idx = panel.find("shouldShowSuggestions")
    if idx >= 0:
        print(f"  Found at {idx}: {repr(panel[idx:idx+200])}")

# 1c. Remove PromptSuggestions rendering block
old_rendersug = '\t\t\t\t{/* 首页时在输入框上方显示建议按�?*/}\n\t\t\t\t{shouldShowSuggestions &&\n\t\t\t\t\t(breakdownQuestionnaire.stage === "idle" ||\n\t\t\t\t\t\tbreakdownQuestionnaire.stage === "completed") && (\n\t\t\t\t\t\t<PromptSuggestions onSelect={handleSelectPrompt} className="pb-4" />\n\t\t\t\t\t)}\n'
if old_rendersug in panel:
    panel = panel.replace(old_rendersug, "")
    changes += 1
    print("OK ChatPanel: removed PromptSuggestions rendering")
else:
    print("FAIL ChatPanel: PromptSuggestions rendering not found")
    idx = panel.find("PromptSuggestions")
    if idx >= 0:
        print(f"  Found PromptSuggestions at {idx}: {repr(panel[idx-20:idx+80])}")

# 1d. Add showSuggestions and onSelectPrompt to ChatInputSection props
old_inputsection = '\t\t\t\t<ChatInputSection\n\t\t\t\t\tlocale={locale}\n\t\t\t\t\tinputValue={chatController.inputValue}\n\t\t\t\t\tisStreaming={chatController.isStreaming}\n\t\t\t\t\terror={chatController.error}\n\t\t\t\t\teffectiveTodos={chatController.effectiveTodos}\n\t\t\t\t\thasSelection={chatController.hasSelection}\n\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\tonInputChange={chatController.setInputValue}\n\t\t\t\t\tonSend={chatController.handleSend}\n\t\t\t\t\tonStop={chatController.handleStop}\n\t\t\t\t\tonKeyDown={chatController.handleKeyDown}\n\t\t\t\t\tonCompositionStart={() => chatController.setIsComposing(true)}\n\t\t\t\t\tonCompositionEnd={() => chatController.setIsComposing(false)}\n\t\t\t\t\tonToggleExpand={() => setShowTodosExpanded((prev) => !prev)}\n\t\t\t\t\tonClearSelection={clearTodoSelection}\n\t\t\t\t\tonToggleTodo={toggleTodoSelection}\n\t\t\t\t/>'

# Build the new section: compute showSuggestions inline
new_inputsection = '\t\t\t\t<ChatInputSection\n\t\t\t\t\tlocale={locale}\n\t\t\t\t\tinputValue={chatController.inputValue}\n\t\t\t\t\tisStreaming={chatController.isStreaming}\n\t\t\t\t\terror={chatController.error}\n\t\t\t\t\teffectiveTodos={chatController.effectiveTodos}\n\t\t\t\t\thasSelection={chatController.hasSelection}\n\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\tonInputChange={chatController.setInputValue}\n\t\t\t\t\tonSend={chatController.handleSend}\n\t\t\t\t\tonStop={chatController.handleStop}\n\t\t\t\t\tonKeyDown={chatController.handleKeyDown}\n\t\t\t\t\tonCompositionStart={() => chatController.setIsComposing(true)}\n\t\t\t\t\tonCompositionEnd={() => chatController.setIsComposing(false)}\n\t\t\t\t\tonToggleExpand={() => setShowTodosExpanded((prev) => !prev)}\n\t\t\t\t\tonClearSelection={clearTodoSelection}\n\t\t\t\t\tonToggleTodo={toggleTodoSelection}\n\t\t\t\t\tshowSuggestions={chatController.messages.length === 0 || (chatController.messages.length === 1 && chatController.messages[0].role === "assistant") || chatController.messages.every((msg) => msg.role === "assistant")}\n\t\t\t\t\tonSelectPrompt={handleSelectPrompt}\n\t\t\t\t/>'

if old_inputsection in panel:
    panel = panel.replace(old_inputsection, new_inputsection)
    changes += 1
    print("OK ChatPanel: added showSuggestions and onSelectPrompt props")
else:
    print("FAIL ChatPanel: ChatInputSection props not found")
    idx = panel.find("<ChatInputSection")
    if idx >= 0:
        print(f"  Found at {idx}: {repr(panel[idx:idx+400])}")

if changes > 0:
    with open('apps/chat/ChatPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(panel)
    print(f"OK ChatPanel.tsx saved ({changes} changes)")
else:
    print("No changes to ChatPanel.tsx")

# ============================================================
# 2. ChatInputSection.tsx - Integrate PromptSuggestions popup + slash trigger
# ============================================================
with open('apps/chat/components/input/ChatInputSection.tsx', 'r', encoding='utf-8') as f:
    section = f.read()

changes2 = 0

# 2a. Add imports
old_imports = 'import { useTranslations } from "next-intl";\nimport { useRef } from "react";'
new_imports = 'import { useTranslations } from "next-intl";\nimport { useRef, useState } from "react";'
if old_imports in section:
    section = section.replace(old_imports, new_imports)
    changes2 += 1
    print("OK ChatInputSection: added useState import")
else:
    print("FAIL ChatInputSection: imports not matched")

# Add PromptSuggestions and ToolSelector imports
old_import2 = 'import { ToolSelector } from "@/apps/chat/components/input/ToolSelector";'
new_import2 = 'import { PromptSuggestions } from "@/apps/chat/components/input/PromptSuggestions";\nimport { ToolSelector } from "@/apps/chat/components/input/ToolSelector";'
if old_import2 in section:
    section = section.replace(old_import2, new_import2)
    changes2 += 1
    print("OK ChatInputSection: added PromptSuggestions import")
else:
    print("FAIL ChatInputSection: ToolSelector import not found")

# 2b. Update props interface
old_props_iface = '\tinputValue: string;\n\tisStreaming: boolean;\n\terror: string | null;\n\teffectiveTodos: Todo[];\n\thasSelection: boolean;\n\tshowTodosExpanded: boolean;'
new_props_iface = '\tinputValue: string;\n\tisStreaming: boolean;\n\terror: string | null;\n\teffectiveTodos: Todo[];\n\thasSelection: boolean;\n\tshowTodosExpanded: boolean;\n\tshowSuggestions: boolean;\n\tonSelectPrompt: (prompt: string) => void;'
if old_props_iface in section:
    section = section.replace(old_props_iface, new_props_iface)
    changes2 += 1
    print("OK ChatInputSection: updated props interface")
else:
    print("FAIL ChatInputSection: props interface not matched")

# 2c. Add showSuggestions and onSelectPrompt to destructuring
old_dest = '\t\tshowTodosExpanded,\n\t\tonInputChange,'
new_dest = '\t\tshowTodosExpanded,\n\t\tshowSuggestions,\n\t\tonSelectPrompt,\n\t\tonInputChange,'
if old_dest in section:
    section = section.replace(old_dest, new_dest)
    changes2 += 1
    print("OK ChatInputSection: added showSuggestions to destructuring")
else:
    print("FAIL ChatInputSection: destructuring not matched")
    idx = section.find("showTodosExpanded,")
    if idx >= 0:
        print(f"  Found showTodosExpanded at {idx}: {repr(section[idx:idx+80])}")

# 2d. Replace the component body: add state, restructure
# Find the modeMenuRef line
old_body = '\t\tconst tPage = useTranslations("page");\n\t\tconst modeMenuRef = useRef<HTMLDivElement | null>(null);\n\t\tconst inputPlaceholder = tPage("chatInputPlaceholder");'
new_body = '\t\tconst tPage = useTranslations("page");\n\t\tconst [showSlashMenu, setShowSlashMenu] = useState(false);\n\t\tconst slashMenuRef = useRef<HTMLDivElement | null>(null);\n\t\tconst inputPlaceholder = tPage("chatInputPlaceholder");'
if old_body in section:
    section = section.replace(old_body, new_body)
    changes2 += 1
    print("OK ChatInputSection: added showSlashMenu state")
else:
    print("FAIL ChatInputSection: body not matched")
    idx = section.find("tPage = useTranslations")
    if idx >= 0:
        print(f"  Found at {idx}: {repr(section[idx:idx+100])}")

# 2e. Replace the return JSX - remove modeSwitcher, add PromptSuggestions + slash menu
old_return = '\t\treturn (\n\t\t\t<div className="bg-background p-4">\n\t\t\t\t<InputBox\n\t\t\t\t\tlinkedTodos={\n\t\t\t\t\t\t<LinkedTodos\n\t\t\t\t\t\t\teffectiveTodos={effectiveTodos}\n\t\t\t\t\t\t\thasSelection={hasSelection}\n\t\t\t\t\t\t\tlocale={locale}\n\t\t\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\t\t\tonToggleExpand={onToggleExpand}\n\t\t\t\t\t\t\tonClearSelection={onClearSelection}\n\t\t\t\t\t\t\tonToggleTodo={onToggleTodo}\n\t\t\t\t\t\t/>\n\t\t\t\t\t}\n\t\t\t\t\tmodeSwitcher={\n\t\t\t\t\t\t<div className="flex items-center gap-2" ref={modeMenuRef}>\n\t\t\t\t\t\t\t<ToolSelector disabled={isStreaming} />\n\t\t\t\t\t\t</div>\n\t\t\t\t\t}\n\t\t\t\t\tinputValue={inputValue}\n\t\t\t\t\tplaceholder={inputPlaceholder}\n\t\t\t\t\tisStreaming={isStreaming}\n\t\t\t\t\tlocale={locale}\n\t\t\t\t\tonChange={onInputChange}\n\t\t\t\t\tonSend={onSend}\n\t\t\t\t\tonStop={onStop}\n\t\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t/>\n\n\t\t\t\t{error && <p className="mt-2 text-sm">{error}</p>}\n\t\t\t</div>\n\t\t);'

new_return = '\t\treturn (\n\t\t\t<div className="bg-background p-4">\n\t\t\t\t{/* 输入框上方的PromptSuggestions弹窗 */}\n\t\t\t\t{showSuggestions && (\n\t\t\t\t\t<div className="pb-3">\n\t\t\t\t\t\t<PromptSuggestions onSelect={onSelectPrompt} />\n\t\t\t\t\t</div>\n\t\t\t\t)}\n\n\t\t\t\t{/* 斜杠触发的工具菜�?*/}\n\t\t\t\t{showSlashMenu && (\n\t\t\t\t\t<div\n\t\t\t\t\t\tref={slashMenuRef}\n\t\t\t\t\t\tclassName="mb-2"\n\t\t\t\t\t>\n\t\t\t\t\t\t<ToolSelector\n\t\t\t\t\t\t\tdisabled={isStreaming}\n\t\t\t\t\t\t\tisOpen={showSlashMenu}\n\t\t\t\t\t\t\tonOpenChange={setShowSlashMenu}\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t)}\n\n\t\t\t\t<InputBox\n\t\t\t\t\tlinkedTodos={\n\t\t\t\t\t\t<LinkedTodos\n\t\t\t\t\t\t\teffectiveTodos={effectiveTodos}\n\t\t\t\t\t\t\thasSelection={hasSelection}\n\t\t\t\t\t\t\tlocale={locale}\n\t\t\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\t\t\tonToggleExpand={onToggleExpand}\n\t\t\t\t\t\t\tonClearSelection={onClearSelection}\n\t\t\t\t\t\t\tonToggleTodo={onToggleTodo}\n\t\t\t\t\t\t/>\n\t\t\t\t\t}\n\t\t\t\t\tinputValue={inputValue}\n\t\t\t\t\tplaceholder={inputPlaceholder}\n\t\t\t\t\tisStreaming={isStreaming}\n\t\t\t\t\tlocale={locale}\n\t\t\t\t\tonChange={onInputChange}\n\t\t\t\t\tonSend={onSend}\n\t\t\t\t\tonStop={onStop}\n\t\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\tonSlashTyped={() => setShowSlashMenu(true)}\n\t\t\t\t/>\n\n\t\t\t\t{error && <p className="mt-2 text-sm">{error}</p>}\n\t\t\t</div>\n\t\t);'

if old_return in section:
    section = section.replace(old_return, new_return)
    changes2 += 1
    print("OK ChatInputSection: replaced return JSX")
else:
    print("FAIL ChatInputSection: return JSX not matched")
    idx = section.find("return (")
    if idx >= 0:
        print(f"  Found 'return (' at {idx}")
        print(f"  Context: {repr(section[idx:idx+500])}")

if changes2 > 0:
    with open('apps/chat/components/input/ChatInputSection.tsx', 'w', encoding='utf-8') as f:
        f.write(section)
    print(f"OK ChatInputSection.tsx saved ({changes2} changes)")
else:
    print("No changes to ChatInputSection.tsx")

# ============================================================
# 3. InputBox.tsx - Remove modeSwitcher, add onSlashTyped
# ============================================================
with open('apps/chat/components/input/InputBox.tsx', 'r', encoding='utf-8') as f:
    box = f.read()

changes3 = 0

# 3a. Update props - remove modeSwitcher/modeMenuOpen, add onSlashTyped
old_props = '\t\tonKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;\n\t\tonCompositionStart: () => void;\n\t\tonCompositionEnd: () => void;\n\t\tmodeSwitcher?: React.ReactNode;\n\t\t/** Mode Switcher 菜单是否打开 */\n\t\tmodeMenuOpen?: boolean;\n\t\tonAtClick?: () => void;\n\t\tlinkedTodos?: React.ReactNode;\n\t\t/** 最大高度，默认�?"40vh"（视口高度的40%�?*/\n\t\tmaxHeight?: string;'
new_props = '\t\tonKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;\n\t\tonCompositionStart: () => void;\n\t\tonCompositionEnd: () => void;\n\t\tonAtClick?: () => void;\n\t\tonSlashTyped?: () => void;\n\t\tlinkedTodos?: React.ReactNode;\n\t\t/** 最大高度，默认�?"40vh"（视口高度的40%�?*/\n\t\tmaxHeight?: string;'
if old_props in box:
    box = box.replace(old_props, new_props)
    changes3 += 1
    print("OK InputBox: updated props")
else:
    print("FAIL InputBox: props not matched")
    idx = box.find("modeSwitcher")
    if idx >= 0:
        print(f"  Found modeSwitcher at {idx}: {repr(box[idx-50:idx+50])}")

# 3b. Update function signature - remove modeSwitcher, modeMenuOpen, add onSlashTyped
old_sig = '\t\tonCompositionStart,\n\t\tonCompositionEnd,\n\t\tmodeSwitcher,\n\t\tmodeMenuOpen = false,\n\t\tonAtClick,'
new_sig = '\t\tonCompositionStart,\n\t\tonCompositionEnd,\n\t\tonAtClick,\n\t\tonSlashTyped,'
if old_sig in box:
    box = box.replace(old_sig, new_sig)
    changes3 += 1
    print("OK InputBox: updated function signature")
else:
    print("FAIL InputBox: function signature not matched")
    idx = box.find("onCompositionEnd,")
    if idx >= 0:
        print(f"  Found onCompositionEnd at {idx}: {repr(box[idx:idx+150])}")

# 3c. Remove isCompactLayout/hasModeSwitcher/isExpandedLayout logic
old_layout_logic = '\t\t// 判断是否使用单行紧凑布局：Mode Switcher 菜单没打开的时候使用它\n\t\tconst isCompactLayout = !modeMenuOpen;\n\t\t// 判断是否需要显�?Mode Switcher（作�?modeSwitcher 存在）\n\t\tconst hasModeSwitcher = !!modeSwitcher;\n\t\t// 展开模式：有 modeSwitcher 且菜单打开时\n\t\tconst isExpandedLayout = hasModeSwitcher && modeMenuOpen;'
new_layout_logic = '\t\t// 始终使用紧凑布局（单行）\n\t\tconst isCompactLayout = true;'
if old_layout_logic in box:
    box = box.replace(old_layout_logic, new_layout_logic)
    changes3 += 1
    print("OK InputBox: simplified layout logic")
else:
    print("FAIL InputBox: layout logic not matched")
    idx = box.find("isCompactLayout")
    if idx >= 0:
        print(f"  Found isCompactLayout at {idx}: {repr(box[idx:idx+100])}")

# 3d. Replace the compact layout render - remove modeSwitcher, add slash detection in onKeyDown
old_compact = '\t\t// 紧凑布局：输入框和按钮在同一行\n\t\tif (isCompactLayout && !isExpandedLayout) {\n\t\t\treturn (\n\t\t\t\t<div\n\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t"flex flex-col rounded-xl border border-border",\n\t\t\t\t\t\t"bg-background/60 px-3 py-2 mb-4",\n\t\t\t\t\t)}\n\t\t\t\t>\n\t\t\t\t\t{/* 关联待办区域 */}\n\t\t\t\t\t{linkedTodos}\n\n\t\t\t\t\t{/* 单行布局：输入框和按钮在同一�?*/}\n\t\t\t\t\t<div className="flex items-center gap-2">\n\t\t\t\t\t\t{/* 左侧：mode switcher */}\n\t\t\t\t\t\t{modeSwitcher && (\n\t\t\t\t\t\t\t<div className="shrink-0">{modeSwitcher}</div>\n\t\t\t\t\t\t)}\n\n\t\t\t\t\t\t{/* 中间：输入框 */}\n\t\t\t\t\t\t<textarea\n\t\t\t\t\t\t\tref={textareaRef}\n\t\t\t\t\t\t\tvalue={inputValue}\n\t\t\t\t\t\t\tonChange={handleChange}\n\t\t\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\t\t\t\tplaceholder={placeholder}\n\t\t\t\t\t\t\trows={SINGLE_LINE_ROWS}\n\t\t\t\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t/>\n\n\t\t\t\t\t\t{/* 右侧：按钮组 */}\n\t\t\t\t\t\t{actionButtons}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t);\n\t\t}'

new_compact = '\t\t// 紧凑布局：输入框和按钮在同一行\n\t\tif (isCompactLayout) {\n\t\t\treturn (\n\t\t\t\t<div\n\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t"flex flex-col rounded-xl border border-border",\n\t\t\t\t\t\t"bg-background/60 px-3 py-2 mb-4",\n\t\t\t\t\t)}\n\t\t\t\t>\n\t\t\t\t\t{/* 关联待办区域 */}\n\t\t\t\t\t{linkedTodos}\n\n\t\t\t\t\t{/* 单行布局：输入框和按钮在同一�?*/}\n\t\t\t\t\t<div className="flex items-center gap-2">\n\t\t\t\t\t\t{/* 中间：输入框 */}\n\t\t\t\t\t\t<textarea\n\t\t\t\t\t\t\tref={textareaRef}\n\t\t\t\t\t\t\tvalue={inputValue}\n\t\t\t\t\t\t\tonChange={handleChange}\n\t\t\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\t\t\tonKeyDown={(e) => {\n\t\t\t\t\t\t\t\t// 检�?/ 键触发工具菜单\n\t\t\t\t\t\t\t\tif (e.key === "/" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {\n\t\t\t\t\t\t\t\t\te.preventDefault();\n\t\t\t\t\t\t\t\t\tonSlashTyped?.();\n\t\t\t\t\t\t\t\t\treturn;\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t\tonKeyDown(e);\n\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\tplaceholder={placeholder}\n\t\t\t\t\t\t\trows={SINGLE_LINE_ROWS}\n\t\t\t\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t\t\t"flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t/>\n\n\t\t\t\t\t\t{/* 右侧：按钮组 */}\n\t\t\t\t\t\t{actionButtons}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t);\n\t\t}'

if old_compact in box:
    box = box.replace(old_compact, new_compact)
    changes3 += 1
    print("OK InputBox: replaced compact layout, added slash detection")
else:
    print("FAIL InputBox: compact layout not matched")
    idx = box.find("isCompactLayout && !isExpandedLayout")
    if idx >= 0:
        print(f"  Found compact layout check at {idx}")
        print(f"  Content: {repr(box[idx:idx+100])}")

# 3e. Remove expanded layout (no longer needed)
old_expanded = '\t\t// 展开布局：输入框在上方，工具栏在下方\n\t\treturn (\n\t\t\t<div\n\t\t\t\tclassName={cn(\n\t\t\t\t\t"relative flex flex-col rounded-xl border border-border",\n\t\t\t\t\t"bg-background/60 px-3 pt-2 pb-14",\n\t\t\t\t)}\n\t\t\t>\n\t\t\t\t{/* 关联待办区域 */}\n\t\t\t\t{linkedTodos}\n\n\t\t\t\t<textarea\n\t\t\t\t\tref={textareaRef}\n\t\t\t\t\tvalue={inputValue}\n\t\t\t\t\tonChange={handleChange}\n\t\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\t\tplaceholder={placeholder}\n\t\t\t\t\trows={MULTI_LINE_ROWS}\n\t\t\t\t\tstyle={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}\n\t\t\t\t\tclassName={cn(\n\t\t\t\t\t\t"w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground",\n\t\t\t\t\t\t"focus-visible:outline-none overflow-y-auto leading-relaxed",\n\t\t\t\t\t)}\n\t\t\t\t/>\n\n\t\t\t\t{/* 底部工具�?- 绝对定位在底�?*/}\n\t\t\t\t<div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">\n\t\t\t\t\t{/* 左下角：mode switcher */}\n\t\t\t\t\t<div className="flex items-center">{modeSwitcher}</div>\n\n\t\t\t\t\t{/* 右下角：按钮�?*/}\n\t\t\t\t\t{actionButtons}\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t);'

if old_expanded in box:
    box = box.replace(old_expanded, "")
    changes3 += 1
    print("OK InputBox: removed expanded layout")
else:
    print("FAIL InputBox: expanded layout not found")
    idx = box.find("展开布局")
    if idx >= 0:
        print(f"  Found expanded layout at {idx}")

# 3f. Remove unused MULTI_LINE_ROWS constant
old_rows = "const MULTI_LINE_ROWS = 1;"
if old_rows in box:
    box = box.replace(old_rows, "")
    changes3 += 1
    print("OK InputBox: removed MULTI_LINE_ROWS constant")

if changes3 > 0:
    with open('apps/chat/components/input/InputBox.tsx', 'w', encoding='utf-8') as f:
        f.write(box)
    print(f"OK InputBox.tsx saved ({changes3} changes)")
else:
    print("No changes to InputBox.tsx")

# ============================================================
# 4. LinkedTodos.tsx - Redesign: remove header, add X close button
# ============================================================
with open('apps/chat/components/input/LinkedTodos.tsx', 'r', encoding='utf-8') as f:
    linked = f.read()

changes4 = 0

# Replace the entire component body
old_linked_body = '\t\treturn (\n\t\t\t<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">\n\t\t\t\t<span className="text-xs font-semibold text-foreground">\n\t\t\t\t\t{t("linkedTodos", { count: effectiveTodos.length })}\n\t\t\t\t</span>\n\t\t\t\t{previewTodos.map((todo) => (\n\t\t\t\t\t<button\n\t\t\t\t\t\tkey={todo.id}\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={() => onToggleTodo(todo.id)}\n\t\t\t\t\t\tclassName="rounded-full border border-border/70 bg-card/80 px-2 py-1 text-xs text-foreground hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer"\n\t\t\t\t\t>\n\t\t\t\t\t\t{todo.name}\n\t\t\t\t\t</button>\n\t\t\t\t))}\n\t\t\t\t{hiddenCount > 0 && (\n\t\t\t\t\t<span className="text-xs text-muted-foreground">+{hiddenCount}</span>\n\t\t\t\t)}\n\t\t\t\t{effectiveTodos.length > 3 && (\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={onToggleExpand}\n\t\t\t\t\t\tclassName="text-[11px] text-muted-foreground transition-colors hover:text-foreground"\n\t\t\t\t\t>\n\t\t\t\t\t\t{showTodosExpanded ? t("collapse") : t("expand")}\n\t\t\t\t\t</button>\n\t\t\t\t)}\n\t\t\t\t{hasSelection && (\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={onClearSelection}\n\t\t\t\t\t\tclassName="text-[11px] text-[oklch(var(--primary))] transition-colors hover:text-[oklch(var(--primary-border))]"\n\t\t\t\t\t>\n\t\t\t\t\t\t{t("clearSelection")}\n\t\t\t\t\t</button>\n\t\t\t\t)}\n\t\t\t</div>\n\t\t);'

new_linked_body = '\t\treturn (\n\t\t\t<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">\n\t\t\t\t{previewTodos.map((todo) => (\n\t\t\t\t\t<div\n\t\t\t\t\t\tkey={todo.id}\n\t\t\t\t\t\tclassName="relative group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 pl-3 pr-2 py-1"\n\t\t\t\t\t>\n\t\t\t\t\t\t<span className="text-xs text-foreground">{todo.name}</span>\n\t\t\t\t\t\t<button\n\t\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\t\tonClick={(e) => {\n\t\t\t\t\t\t\t\te.stopPropagation();\n\t\t\t\t\t\t\t\tonToggleTodo(todo.id);\n\t\t\t\t\t\t\t}}\n\t\t\t\t\t\t\tclassName="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"\n\t\t\t\t\t\t\taria-label={t("removeLinkedTodo")}\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">\n\t\t\t\t\t\t\t\t<path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n\t\t\t\t\t\t\t</svg>\n\t\t\t\t\t\t</button>\n\t\t\t\t\t</div>\n\t\t\t\t))}\n\t\t\t\t{hiddenCount > 0 && (\n\t\t\t\t\t<span className="text-xs text-muted-foreground">+{hiddenCount}</span>\n\t\t\t\t)}\n\t\t\t\t{effectiveTodos.length > 3 && (\n\t\t\t\t\t<button\n\t\t\t\t\t\ttype="button"\n\t\t\t\t\t\tonClick={onToggleExpand}\n\t\t\t\t\t\tclassName="text-[11px] text-muted-foreground transition-colors hover:text-foreground"\n\t\t\t\t\t>\n\t\t\t\t\t\t{showTodosExpanded ? t("collapse") : t("expand")}\n\t\t\t\t\t</button>\n\t\t\t\t)}\n\t\t\t</div>\n\t\t);'

if old_linked_body in linked:
    linked = linked.replace(old_linked_body, new_linked_body)
    changes4 += 1
    print("OK LinkedTodos: redesigned tags with X buttons")
else:
    print("FAIL LinkedTodos: body not matched")
    idx = linked.find("return (")
    if idx >= 0:
        print(f"  Found 'return (' at {idx}")
        print(f"  Content: {repr(linked[idx:idx+200])}")

if changes4 > 0:
    with open('apps/chat/components/input/LinkedTodos.tsx', 'w', encoding='utf-8') as f:
        f.write(linked)
    print(f"OK LinkedTodos.tsx saved ({changes4} changes)")
else:
    print("No changes to LinkedTodos.tsx")

# ============================================================
# 5. ToolSelector.tsx - Add isOpen/onOpenChange external control
# ============================================================
with open('apps/chat/components/input/ToolSelector.tsx', 'r', encoding='utf-8') as f:
    selector = f.read()

changes5 = 0

# 5a. Update props interface
old_ts_iface = '\tinterface ToolSelectorProps {\n\t\t/** 是否禁用 */\n\t\tdisabled?: boolean;\n\t}'
new_ts_iface = '\tinterface ToolSelectorProps {\n\t\t/** 是否禁用 */\n\t\tdisabled?: boolean;\n\t\t/** 外部控制是否打开下拉菜单 */\n\t\tisOpen?: boolean;\n\t\t/** 外部控制状态变化回�?*/\n\t\tonOpenChange?: (open: boolean) => void;\n\t}'
if old_ts_iface in selector:
    selector = selector.replace(old_ts_iface, new_ts_iface)
    changes5 += 1
    print("OK ToolSelector: updated props interface")
else:
    print("FAIL ToolSelector: props interface not matched")
    idx = selector.find("interface ToolSelectorProps")
    if idx >= 0:
        print(f"  Found at {idx}: {repr(selector[idx:idx+150])}")

# 5b. Update function signature
old_ts_sig = "\tfunction ToolSelector({ disabled = false }: ToolSelectorProps) {"
new_ts_sig = "\tfunction ToolSelector({ disabled = false, isOpen: externalIsOpen, onOpenChange }: ToolSelectorProps) {"
if old_ts_sig in selector:
    selector = selector.replace(old_ts_sig, new_ts_sig)
    changes5 += 1
    print("OK ToolSelector: updated function signature")
else:
    print("FAIL ToolSelector: function signature not matched")

# 5c. Update useState and isOpen logic
old_ts_open = "\t\tconst [isOpen, setIsOpen] = useState(false);"
new_ts_open = "\t\tconst [internalIsOpen, setInternalIsOpen] = useState(false);\n\t\tconst isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;\n\t\tconst setIsOpen = (open: boolean) => {\n\t\t\tif (onOpenChange) onOpenChange(open);\n\t\t\telse setInternalIsOpen(open);\n\t\t};"
if old_ts_open in selector:
    selector = selector.replace(old_ts_open, new_ts_open)
    changes5 += 1
    print("OK ToolSelector: updated isOpen state management")
else:
    print("FAIL ToolSelector: isOpen state not found")
    idx = selector.find("const [isOpen, setIsOpen]")
    if idx >= 0:
        print(f"  Found at {idx}: {repr(selector[idx:idx+50])}")

# 5d. Remove the click-outside handler that uses dropdownRef - it would interfere with external control
# Actually, keep it but update to work with external control too
old_outside = '\t\t// 点击外部关闭下拉框\n\t\tuseEffect(() => {\n\t\t\tif (!isOpen) return;\n\n\t\t\tconst handleClickOutside = (event: MouseEvent) => {\n\t\t\t\tif (\n\t\t\t\t\tdropdownRef.current &&\n\t\t\t\t\t!dropdownRef.current.contains(event.target as Node)\n\t\t\t\t) {\n\t\t\t\t\tsetIsOpen(false);\n\t\t\t\t}\n\t\t\t};\n\n\t\t\tdocument.addEventListener("mousedown", handleClickOutside);\n\t\t\treturn () => document.removeEventListener("mousedown", handleClickOutside);\n\t\t}, [isOpen]);'
# Keep it as is, it already uses setIsOpen which now handles external control

if changes5 > 0:
    with open('apps/chat/components/input/ToolSelector.tsx', 'w', encoding='utf-8') as f:
        f.write(selector)
    print(f"OK ToolSelector.tsx saved ({changes5} changes)")
else:
    print("No changes to ToolSelector.tsx")

print("=== All done ===")
