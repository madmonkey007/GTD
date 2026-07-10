#!/usr/bin/env python3
"""Fix chat input v2 - correct tab indentation"""

# ============================================================
# Helper: read file into lines
# ============================================================
def read_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_lines(path, lines):
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

def line_text(lines, n):
    """Get text of line n (0-indexed), stripping trailing newline"""
    return lines[n].rstrip('\r\n')

def find_line_starting_with(lines, prefix, start=0):
    for i in range(start, len(lines)):
        if lines[i].lstrip().startswith(prefix):
            return i
    return -1

# ============================================================
# 1. ChatPanel.tsx - Remove PromptSuggestions
# ============================================================
lines = read_lines('apps/chat/ChatPanel.tsx')
changes = 0
new_lines = []
skip_until = -1

for i, line in enumerate(lines):
    # Remove PromptSuggestions import
    if 'PromptSuggestions' in line and 'import' in line:
        changes += 1
        print(f"OK ChatPanel: removed PromptSuggestions import (line {i+1})")
        continue

    # Remove shouldShowSuggestions useMemo block (lines between )
    if line.strip().startswith('const shouldShowSuggestions'):
        # Remove this line and everything until the closing });
        j = i
        while j < len(lines) and '}, [' not in lines[j]:
            j += 1
        # Also remove the next line if it's just });
        if j < len(lines) and '}, [' in lines[j]:
            j += 1
        changes += 1
        print(f"OK ChatPanel: removed shouldShowSuggestions block (lines {i+1}-{j})")
        # We need to skip all these lines
        skip_until = j
        continue

    if skip_until > i + 5:  # safety: don't accidentally skip too far
        # Hmm, this is getting complex. Let me use a different approach.
        pass

# Actually, let me just do simple line-by-line filtering
lines2 = []
skip_suggestions_block = False
skip_suggestions_block_end = 0

for i, line in enumerate(lines):
    stripped = line.strip()

    # Remove PromptSuggestions import
    if 'PromptSuggestions' in stripped and 'import' in stripped:
        changes += 1
        print(f"OK ChatPanel: removed PromptSuggestions import (line {i+1})")
        continue

    # Remove shouldShowSuggestions useMemo block
    if stripped == 'const shouldShowSuggestions = useMemo(() => {' and '{' in stripped:
        skip_suggestions_block = True
        skip_suggestions_block_end = i + 20  # max 20 lines
        changes += 1
        print(f"OK ChatPanel: removed shouldShowSuggestions (line {i+1})")
        continue

    if skip_suggestions_block:
        # Look for the closing of the useMemo: });
        if stripped == '}, [chatController.messages]);':
            skip_suggestions_block = False
            changes += 1
            print(f"OK ChatPanel: removed end of shouldShowSuggestions (line {i+1})")
            continue
        if i > skip_suggestions_block_end:
            skip_suggestions_block = False
        continue

    # Remove PromptSuggestions rendering block
    if stripped.startswith('{/* ') and '提示' in stripped and '建议按钮' in stripped:
        # Skip the comment line
        changes += 1
        print(f"OK ChatPanel: removed PromptSuggestions rendering (line {i+1})")
        continue
    if skip_suggestions_block:
        continue
    # Check for the PromptSuggestions JSX line
    if '<PromptSuggestions' in stripped and 'onSelect={handleSelectPrompt}' in stripped:
        changes += 1
        print(f"OK ChatPanel: removed PromptSuggestions JSX (line {i+1})")
        continue

    lines2.append(line)

# Now handle the ChatInputSection props
panel_text = ''.join(lines2)

# Find the ChatInputSection block and add showSuggestions/onSelectPrompt
old_section_start = '<ChatInputSection'
old_section_end = '/>'

idx_start = panel_text.find(old_section_start)
if idx_start >= 0:
    # Find the closing />
    idx_close = panel_text.find(old_section_end, idx_start)
    if idx_close >= 0:
        section_block = panel_text[idx_start:idx_close + 2]
        # Check if showSuggestions is already there
        if 'showSuggestions' not in section_block:
            # Add showSuggestions and onSelectPrompt before the last />
            insert_pos = section_block.rstrip().rfind('\n')
            indent = '\t\t\t\t\t'
            if insert_pos >= 0:
                new_section = (section_block[:idx_close] +
                    indent + 'showSuggestions={chatController.messages.length === 0 || ' +
                    '(chatController.messages.length === 1 && chatController.messages[0].role === "assistant") || ' +
                    'chatController.messages.every((msg) => msg.role === "assistant")}\n' +
                    indent + 'onSelectPrompt={handleSelectPrompt}\n' +
                    '\t\t\t\t' + '/>')
                # But we need to find the original /> to replace
                # Let's find the last line of the section block
                last_newline = section_block.rfind('\n')
                if last_newline >= 0:
                    last_line = section_block[last_newline:]
                    new_last_line = (indent + 'showSuggestions={chatController.messages.length === 0 || (chatController.messages.length === 1 && chatController.messages[0].role === "assistant") || chatController.messages.every((msg) => msg.role === "assistant")}\n' +
                        indent + 'onSelectPrompt={handleSelectPrompt}\n' +
                        '\t\t\t\t/>')
                    panel_text = panel_text.replace(last_line, '\n' + new_last_line)
                    changes += 1
                    print(f"OK ChatPanel: added showSuggestions and onSelectPrompt props")

if changes > 0:
    with open('apps/chat/ChatPanel.tsx', 'w', encoding='utf-8') as f:
        f.write(panel_text)
    print(f"OK ChatPanel.tsx saved ({changes} changes)")

# ============================================================
# 2. ChatInputSection.tsx - Full rewrite
# ============================================================
with open('apps/chat/components/input/ChatInputSection.tsx', 'r', encoding='utf-8') as f:
    section = f.read()

changes2 = 0

# Add useState to imports
section = section.replace(
    'import { useRef } from "react";',
    'import { useRef, useState } from "react";'
)
changes2 += 1
print("OK ChatInputSection: added useState import")

# Update import order for PromptSuggestions
section = section.replace(
    'import { ToolSelector } from "@/apps/chat/components/input/ToolSelector";',
    'import { PromptSuggestions } from "@/apps/chat/components/input/PromptSuggestions";\nimport { ToolSelector } from "@/apps/chat/components/input/ToolSelector";'
)
changes2 += 1
print("OK ChatInputSection: added PromptSuggestions import")

# Update props interface
old_iface = '\tonToggleExpand: () => void;\n\tonClearSelection: () => void;\n\tonToggleTodo: (todoId: number) => void;\n};'
new_iface = '\tonToggleExpand: () => void;\n\tonClearSelection: () => void;\n\tonToggleTodo: (todoId: number) => void;\n\tshowSuggestions: boolean;\n\tonSelectPrompt: (prompt: string) => void;\n};'
if old_iface in section:
    section = section.replace(old_iface, new_iface)
    changes2 += 1
    print("OK ChatInputSection: updated props interface")

# Update destructuring
old_dest = '\tonToggleExpand,\n\tonClearSelection,'
new_dest = '\tonToggleExpand,\n\tshowSuggestions,\n\tonSelectPrompt,\n\tonClearSelection,'
if old_dest in section:
    section = section.replace(old_dest, new_dest)
    changes2 += 1
    print("OK ChatInputSection: updated destructuring")

# Replace modeMenuRef with slashMenuRef
section = section.replace(
    'const modeMenuRef = useRef<HTMLDivElement | null>(null);',
    'const [showSlashMenu, setShowSlashMenu] = useState(false);\n\tconst slashMenuRef = useRef<HTMLDivElement | null>(null);'
)
changes2 += 1
print("OK ChatInputSection: added showSlashMenu state")

# Replace the full return block
old_return = '\treturn (\n\t\t<div className="bg-background p-4">\n\t\t\t<InputBox\n\t\t\t\tlinkedTodos={\n\t\t\t\t\t<LinkedTodos\n\t\t\t\t\t\teffectiveTodos={effectiveTodos}\n\t\t\t\t\t\thasSelection={hasSelection}\n\t\t\t\t\t\tlocale={locale}\n\t\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\t\tonToggleExpand={onToggleExpand}\n\t\t\t\t\t\tonClearSelection={onClearSelection}\n\t\t\t\t\t\tonToggleTodo={onToggleTodo}\n\t\t\t\t\t/>\n\t\t\t\t}\n\t\t\t\tmodeSwitcher={\n\t\t\t\t\t<div className="flex items-center gap-2" ref={modeMenuRef}>\n\t\t\t\t\t\t<ToolSelector disabled={isStreaming} />\n\t\t\t\t\t</div>\n\t\t\t\t}\n\t\t\t\tinputValue={inputValue}\n\t\t\t\tplaceholder={inputPlaceholder}\n\t\t\t\tisStreaming={isStreaming}\n\t\t\t\tlocale={locale}\n\t\t\t\tonChange={onInputChange}\n\t\t\t\tonSend={onSend}\n\t\t\t\tonStop={onStop}\n\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t/>\n\n\t\t\t{error && <p className="mt-2 text-sm">{error}</p>}\n\t\t</div>\n\t);'

new_return = '\treturn (\n\t\t<div className="bg-background p-4">\n\t\t\t{/* 输入框上方的 PromptSuggestions 弹窗 */}\n\t\t\t{showSuggestions && (\n\t\t\t\t<div className="pb-3">\n\t\t\t\t\t<PromptSuggestions onSelect={onSelectPrompt} />\n\t\t\t\t</div>\n\t\t\t)}\n\n\t\t\t{/* 斜杠触发的工具菜单 */}\n\t\t\t{showSlashMenu && (\n\t\t\t\t<div ref={slashMenuRef} className="mb-2">\n\t\t\t\t\t<ToolSelector\n\t\t\t\t\t\tdisabled={isStreaming}\n\t\t\t\t\t\tisOpen={showSlashMenu}\n\t\t\t\t\t\tonOpenChange={setShowSlashMenu}\n\t\t\t\t\t/>\n\t\t\t\t</div>\n\t\t\t)}\n\n\t\t\t<InputBox\n\t\t\t\tlinkedTodos={\n\t\t\t\t\t<LinkedTodos\n\t\t\t\t\t\teffectiveTodos={effectiveTodos}\n\t\t\t\t\t\thasSelection={hasSelection}\n\t\t\t\t\t\tlocale={locale}\n\t\t\t\t\t\tshowTodosExpanded={showTodosExpanded}\n\t\t\t\t\t\tonToggleExpand={onToggleExpand}\n\t\t\t\t\t\tonClearSelection={onClearSelection}\n\t\t\t\t\t\tonToggleTodo={onToggleTodo}\n\t\t\t\t\t/>\n\t\t\t\t}\n\t\t\t\tinputValue={inputValue}\n\t\t\t\tplaceholder={inputPlaceholder}\n\t\t\t\tisStreaming={isStreaming}\n\t\t\t\tlocale={locale}\n\t\t\t\tonChange={onInputChange}\n\t\t\t\tonSend={onSend}\n\t\t\t\tonStop={onStop}\n\t\t\t\tonKeyDown={onKeyDown}\n\t\t\t\tonCompositionStart={onCompositionStart}\n\t\t\t\tonCompositionEnd={onCompositionEnd}\n\t\t\t\tonSlashTyped={() => setShowSlashMenu(true)}\n\t\t\t/>\n\n\t\t\t{error && <p className="mt-2 text-sm">{error}</p>}\n\t\t</div>\n\t);'

if old_return in section:
    section = section.replace(old_return, new_return)
    changes2 += 1
    print("OK ChatInputSection: replaced return JSX")

if changes2 > 0:
    with open('apps/chat/components/input/ChatInputSection.tsx', 'w', encoding='utf-8') as f:
        f.write(section)
    print(f"OK ChatInputSection.tsx saved ({changes2} changes)")

print("=== Phase 1 done ===")
