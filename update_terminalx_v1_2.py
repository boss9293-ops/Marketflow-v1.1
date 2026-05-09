import os
import re

dir_path = 'marketflow/frontend/src/components/semiconductor'
target_file = 'marketflow/frontend/src/components/semiconductor/TerminalXDashboard.tsx'

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig_content = content

    # Remove any text-color/opacity like text-amber-300/80 -> text-amber-300
    content = re.sub(r'text-([a-z]+-\d+)/\d+', r'text-\1', content)
    content = re.sub(r'text-white/\d+', r'text-slate-300', content)
    
    # 1. Headline (Engine Score 등): 32px / Bold (700) / --font-data
    content = re.sub(r'text-\[32px\]\s+font-bold\s+font-mono', 'text-[32px] font-bold font-mono', content)
    
    # 2. Sub-headline (Breadth 등): 20px / Semi-bold (600) / --font-ui
    content = re.sub(r'text-\[20px\]\s+font-semibold', 'text-[20px] font-semibold font-sans', content)
    
    # 3. Standard Body/Data: 14px / Medium (500) / --font-ui (Label), --font-data (Value)
    content = re.sub(r'text-\[14px\]\s+leading-\[1\.8\]', 'text-[14px] font-medium leading-[1.6]', content)
    content = re.sub(r'text-\[14px\]\s+leading-\[1\.6\]', 'text-[14px] font-medium leading-[1.6]', content)
    
    # 4. Section Labels (ALL CAPS): 11px / Semi-bold (600) / Letter-spacing: 0.12em
    content = re.sub(r'text-\[11px\]\s+font-semibold\s+text-slate-400\s+uppercase\s+tracking-\[0.12em\]', 
                     'text-[11px] font-semibold font-sans text-slate-400 uppercase tracking-[0.12em]', content)
    
    # 5. Letter Spacing: tracking-[0.02em] for all read texts (descriptions, paragraphs)
    content = re.sub(r'text-slate-300', 'text-slate-300 tracking-[0.02em]', content)
    content = re.sub(r'text-slate-400', 'text-slate-400 tracking-[0.02em]', content)
    # Deduplicate tracking
    content = content.replace('tracking-[0.02em] tracking-[0.02em]', 'tracking-[0.02em]')
    
    # 6. Card Padding and Module Gap adjustment
    # Increase paddings p-1.5 -> p-2, p-2 -> p-3, px-3 -> px-4, py-2 -> py-3
    content = re.sub(r'\bp-2\b', 'p-3', content)
    content = re.sub(r'\bp-1\.5\b', 'p-2', content)
    content = re.sub(r'\bpx-3\b', 'px-4', content)
    content = re.sub(r'\bpy-2\b', 'py-3', content)
    
    if content != orig_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

# Specifically process TerminalXDashboard.tsx
update_file(target_file)
