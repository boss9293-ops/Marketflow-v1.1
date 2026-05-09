import os
import re

dir_path = 'marketflow/frontend/src/components/semiconductor'

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig_content = content

    # 1. BANNED: 10px 이하의 모든 폰트 사이즈. (10px -> 11px)
    content = re.sub(r'text-\[10px\]', 'text-[11px]', content)
    content = re.sub(r'fontSize:\s*10(\D)', r'fontSize: 11\1', content)

    # 2. Section Labels (ALL CAPS): Font-size: 11px (from 10px) / Letter-spacing: 0.12em / Font-weight: 600
    # Currently they might be text-[11px] uppercase tracking-widest text-slate-400
    content = re.sub(r'text-\[(?:11|12)px\]\s+(?:font-bold\s+)?text-slate-400\s+uppercase\s+tracking-widest', 
                     'text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]', content)
    content = re.sub(r'text-slate-500\s+uppercase\s+mb-1', 'text-slate-500 uppercase tracking-[0.12em] font-semibold text-[11px] mb-1', content)
    
    # 3. Engine/Strategy Score (Headline): Font-size: 32px / Font-weight: 700 / Font-family: --font-data
    content = re.sub(r'text-\[30px\]\s+font-black', 'text-[32px] font-bold font-mono', content)
    content = re.sub(r'text-\[26px\]\s+font-black', 'text-[32px] font-bold font-mono', content)

    # 4. Sub-Headlines (Breadth, AI Refine 등): Font-size: 20px / Font-weight: 600
    # Also Map Interpretation, Correlation Interpretation, Breadth Interpretation, etc.
    # Often they look like <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-1.5">Map Interpretation</div>
    content = re.sub(r'text-\[11px\]\s+font-semibold\s+text-slate-400\s+uppercase\s+tracking-\[0.12em\](\s+mb-[\d\.]+)">(.*?Interpretation)</div>', 
                     r'text-[20px] font-semibold text-slate-400\1">\2</div>', content)

    # 5. Stage Names & Data Values (Main): Font-size: 14px (from 12px) / Line-height: 1.6
    content = re.sub(r'text-\[12px\]', 'text-[14px] leading-[1.6]', content)
    
    # 6. gap 속성 +2px (gap-X in Bucket Map, Cycle Position, etc.)
    # In Tailwind, gap-1 is 0.25rem (4px). gap-[6px] is +2px.
    content = re.sub(r'\bgap-1\b', 'gap-[6px]', content)
    content = re.sub(r'\bgap-1\.5\b', 'gap-[8px]', content)
    content = re.sub(r'\bgap-2\b', 'gap-[10px]', content)
    content = re.sub(r'\bgap-2\.5\b', 'gap-[12px]', content)
    content = re.sub(r'\bgap-3\b', 'gap-[14px]', content)
    content = re.sub(r'\bgap-4\b', 'gap-[18px]', content)

    # 7. Interpretation Card (Right Panel): 6개 블록 텍스트 행간 넓혀 읽기 모드 피로도 감소
    # `leading-relaxed` or explicit `leading-[1.8]` on interpretation text.
    content = re.sub(r'(<span className="text-slate-300)"', r'\1 leading-[1.8]"', content)
    # If it was already matching a class list:
    content = re.sub(r'text-\[14px\]\s+leading-\[1\.6\]\s+text-slate-300', 'text-[14px] leading-[1.8] text-slate-300', content)

    if content != orig_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

for root, _, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            update_file(os.path.join(root, file))
