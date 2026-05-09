import os
import re

dir_path = 'marketflow/frontend/src/components/semiconductor'

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig_content = content

    # 1. Define font constants
    font_defs = """
const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";
"""
    if 'const UI_FONT' not in content:
        # Insert after imports
        import_match = list(re.finditer(r'^(import.*?|)$', content, re.MULTILINE))
        if import_match:
            # Find the last import
            last_import_end = 0
            for m in import_match:
                if m.group().startswith('import'):
                    last_import_end = m.end()
            
            if last_import_end > 0:
                content = content[:last_import_end] + '\n' + font_defs + content[last_import_end:]
            else:
                content = font_defs + '\n' + content

    # 2. Top-level Container
    # <div className="... flex flex-col h-screen text-slate-200 overflow-hidden select-none bg-[#020408] font-sans" style={{ fontSize: 14, fontFamily: 'JetBrains Mono','Fira Code',monospace }}>
    content = re.sub(
        r'<div([^>]+bg-\[#020408\][^>]+)style=\{\{\s*fontSize:\s*14,\s*fontFamily:[^}]+?\}\}',
        r'<div\1style={{ fontSize: 14, fontFamily: UI_FONT, letterSpacing: \'0.02em\' }}',
        content
    )
    
    # Also find mf-dashboard-root div
    content = re.sub(
        r'<div([^>]+mf-dashboard-root[^>]+)style=\{\{[^}]*?\}\}',
        r'<div\1style={{ fontSize: 14, fontFamily: UI_FONT, letterSpacing: \'0.02em\' }}',
        content
    )
    # If no style tag exists on top level but mf-dashboard-root is there
    content = re.sub(
        r'<div([^>]+mf-dashboard-root[^>]*?)>',
        lambda m: m.group(0) if 'style={{' in m.group(0) else f'<div{m.group(1)} style={{{{ fontSize: 14, fontFamily: UI_FONT, letterSpacing: \'0.02em\' }}}}>',
        content
    )


    # 3. Component level font splitting
    # Labels / Titles: Panel title, Section Labels
    # uppercase tracking-[0.12em] or tracking-widest
    # Add style={{ fontFamily: UI_FONT }} to them. We can just add it before the closing bracket of the tag.
    
    # Let's fix text-[10px] -> text-[11px] globally
    content = re.sub(r'text-\[10px\]', 'text-[11px]', content)

    # Let's fix opacities. /50, /60, /70, /80 etc. on text-colors. 
    # Example: text-blue-400/70 -> text-blue-400
    content = re.sub(r'(text-[a-z]+-[0-9]+)/\d+', r'\1', content)
    content = re.sub(r'(text-slate-\d+)/\d+', r'\1', content)

    # Fix leading for standard text
    # text-[14px] leading-[1.6] -> make sure leading-[1.6] is there
    content = re.sub(r'text-\[14px\]\s+font-medium\s+leading-\[1\.6\]', 'text-[14px] font-medium leading-[1.6]', content)
    # If we find text-slate-300 leading-snug -> text-slate-300 leading-[1.6]
    content = content.replace('leading-snug', 'leading-[1.6]')
    content = content.replace('leading-tight', 'leading-[1.6]')

    # Apply UI_FONT to uppercase tracking-[0.12em]
    # We find classNames with these and inject style={{ fontFamily: UI_FONT }} if not present
    def inject_ui_font(match):
        tag = match.group(0)
        if 'style={{' in tag:
            # Inject into existing style
            if 'fontFamily' not in tag:
                return re.sub(r'style=\{\{', r'style={{ fontFamily: UI_FONT, ', tag)
            else:
                return tag
        else:
            return tag[:-1] + ' style={{ fontFamily: UI_FONT }}>'

    content = re.sub(r'<[a-zA-Z0-9]+\s+className="[^"]*uppercase[^"]*tracking-\[0.12em\][^"]*"[^>]*>', inject_ui_font, content)
    content = re.sub(r'<[a-zA-Z0-9]+\s+className="[^"]*uppercase[^"]*tracking-widest[^"]*"[^>]*>', inject_ui_font, content)

    # Apply DATA_FONT to font-mono
    def inject_data_font(match):
        tag = match.group(0)
        if 'style={{' in tag:
            # Inject into existing style
            if 'fontFamily' not in tag:
                return re.sub(r'style=\{\{', r'style={{ fontFamily: DATA_FONT, ', tag)
            else:
                return re.sub(r'fontFamily:\s*[^,}]+', r'fontFamily: DATA_FONT', tag)
        else:
            return tag[:-1] + ' style={{ fontFamily: DATA_FONT }}>'

    # Any tag with font-mono should get DATA_FONT
    content = re.sub(r'<[a-zA-Z0-9]+\s+className="[^"]*\bfont-mono\b[^"]*"[^>]*>', inject_data_font, content)
    
    # Any tag with tabular-nums should get DATA_FONT
    content = re.sub(r'<[a-zA-Z0-9]+\s+className="[^"]*\btabular-nums\b[^"]*"[^>]*>', inject_data_font, content)

    # Core KPI Values: text-[32px] font-bold -> text-[32px] font-bold font-mono
    # Since we mapped font-mono to DATA_FONT, adding font-mono will get processed above or we can just inject directly.
    content = re.sub(r'text-\[32px\]\s+font-bold(?!.*?font-mono)', r'text-[32px] font-bold font-mono', content)

    if content != orig_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

# Run on all files
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            update_file(os.path.join(root, file))
