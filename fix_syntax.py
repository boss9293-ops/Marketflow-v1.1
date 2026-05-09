import os
import re

dir_path = 'marketflow/frontend/src/components/semiconductor'

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig_content = content

    # 1. Remove bad injection
    bad_injection = """
const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";
"""
    content = content.replace(bad_injection, '')
    
    bad_injection_2 = """const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";
"""
    content = content.replace(bad_injection_2, '')

    # 2. Fix escaped quotes in style
    content = content.replace(r"\'0.02em\'", "'0.02em'")
    
    # Also replace any other stray escaped quotes
    content = re.sub(r"style=\{\{([^\}]+)\\\'([^\}]+)\\\'([^\}]+)\}\}", r"style={{\1'\2'\3}}", content)

    # 3. Inject correctly before `export default function` or `export function`
    if 'const UI_FONT' not in content:
        # Find the first export function
        match = re.search(r'^export\s+(?:default\s+)?(?:function|const)\s+', content, re.MULTILINE)
        if match:
            insert_pos = match.start()
            content = content[:insert_pos] + bad_injection_2 + '\n' + content[insert_pos:]

    if content != orig_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {path}")

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))
