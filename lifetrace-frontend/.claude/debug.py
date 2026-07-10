with open('apps/diary/components/DiaryHeatmap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if '<div' in line or '/>' in line:
        if i >= 88 and i <= 96:
            print(f'Line {i+1}: tabs={line.count(chr(9))} content=|{line}|')
