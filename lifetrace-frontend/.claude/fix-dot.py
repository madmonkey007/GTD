import re

with open('apps/diary/components/DiaryHeatmap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Based on debug:
# Line 91: 7 tabs <div
# Line 92-94: 8 tabs for attributes
# Line 95: 7 tabs />
old_dot = """\t\t\t\t\t\t\t<div
\t\t\t\t\t\t\t\tkey={rowIdx}
\t\t\t\t\t\t\t\ttitle={cell.tooltip}
\t\t\t\t\t\t\t\tclassName={`w-3 h-3 rounded-full ${DOT_COLORS[cell.level]} cursor-default transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}
\t\t\t\t\t\t\t/>"""

new_dot = """\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\tkey={rowIdx}
\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\ttitle={cell.tooltip}
\t\t\t\t\t\t\t\tonClick={onSelectDate ? () => onSelectDate(cell.date) : undefined}
\t\t\t\t\t\t\t\tclassName={`w-3 h-3 rounded-full ${DOT_COLORS[cell.level]} ${onSelectDate ? 'cursor-pointer' : 'cursor-default'} transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}
\t\t\t\t\t\t\t/>"""

if old_dot in content:
    content = content.replace(old_dot, new_dot)
    with open('apps/diary/components/DiaryHeatmap.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: heatmap dot updated')
else:
    print('FAIL: pattern not found')
    # Show surrounding lines
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if i >= 88 and i <= 97:
            print(f'  Line {i+1}: tabs={line.count(chr(9))} |{line[:60]}|')
