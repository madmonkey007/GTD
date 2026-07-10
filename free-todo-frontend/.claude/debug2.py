# Debug DiarySidebar
with open('apps/diary/components/DiarySidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'DiaryHeatmap' in line or 'DiarySidebar' in line:
        print(f'Sidebar Line {i+1}: tabs={line.count(chr(9))} |{line[:80]}|')

print('---')

# Debug DiaryEditor header
with open('apps/diary/DiaryEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'flex-1 min-h-0 overflow-y-auto' in line or 'sortedNotes.length === 0' in line:
        print(f'Editor Line {i+1}: tabs={line.count(chr(9))} |{line[:80]}|')
