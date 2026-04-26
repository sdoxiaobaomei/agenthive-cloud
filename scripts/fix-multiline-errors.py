from pathlib import Path
import re

API_SRC = Path('apps/api/src')

for f in API_SRC.rglob('*.ts'):
    content = f.read_text(encoding='utf-8')
    original = content
    # Multi-line pattern: .status(NNN).json({\n  success: false,\n  error: '...',\n})
    content = re.sub(
        r'\.status\((\d{3})\)\.json\(\{\s*\n\s*success:\s*false,\s*\n\s*error:\s*([^,\n]+),?\s*\n\s*\}\)',
        lambda m: f".status({m.group(1)}).json({{ code: {m.group(1)}, message: {m.group(2).strip()}, data: null }})",
        content
    )
    if content != original:
        f.write_text(content, encoding='utf-8')
        print(f'Fixed multi-line: {f}')
print('Done')
