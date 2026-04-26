#!/usr/bin/env python3
"""
批量迁移 Node API 响应格式：
{ success: true/false, error?, data? } -> { code, message, data }
"""
import re
from pathlib import Path

API_SRC = Path('apps/api/src')


def replace_in_file(path: Path):
    content = path.read_text(encoding='utf-8')
    original = content

    # ------------------------------------------------------------------
    # A. success: true, data:   -> code: 200, message: 'success', data:
    #    Handles same-line and multi-line
    # ------------------------------------------------------------------
    content = re.sub(
        r'\{\s*success:\s*true,\s*data:',
        "{ code: 200, message: 'success', data:",
        content
    )

    # ------------------------------------------------------------------
    # B. .status(NNN).json({ success: true, data: -> code: NNN
    # ------------------------------------------------------------------
    def replace_success_with_code(match):
        code = match.group(1)
        return f".status({code}).json({{ code: {code}, message: 'success', data:"

    content = re.sub(
        r'\.status\((\d{3})\)\.json\(\{\s*success:\s*true,\s*data:',
        replace_success_with_code,
        content
    )

    # ------------------------------------------------------------------
    # C. { success: true, message: '...', data: -> code: 200, message: '...', data:
    # ------------------------------------------------------------------
    content = re.sub(
        r"\{\s*success:\s*true,\s*message:\s*('[^']*'),\s*data:",
        r"{ code: 200, message: \1, data:",
        content
    )

    # ------------------------------------------------------------------
    # D. .status(NNN).json({ success: true, message: '...', data:
    # ------------------------------------------------------------------
    def replace_success_msg_with_code(match):
        code = match.group(1)
        msg = match.group(2)
        return f".status({code}).json({{ code: {code}, message: {msg}, data:"

    content = re.sub(
        r"\.status\((\d{3})\)\.json\(\{\s*success:\s*true,\s*message:\s*('[^']*'),\s*data:",
        replace_success_msg_with_code,
        content
    )

    # ------------------------------------------------------------------
    # E. { success: true, message: '...' }  (no data) -> add data: null
    #    Single-line only to avoid accidentally matching multi-line objects.
    # ------------------------------------------------------------------
    content = re.sub(
        r"\{\s*success:\s*true,\s*message:\s*('[^']*')\s*\}",
        r"{ code: 200, message: \1, data: null }",
        content
    )

    # ------------------------------------------------------------------
    # F. .status(NNN).json({ success: false, error: '...' })
    #    Single-line, no details.
    # ------------------------------------------------------------------
    def replace_error_status(match):
        code = match.group(1)
        msg = match.group(2)
        return f".status({code}).json({{ code: {code}, message: {msg}, data: null }})"

    content = re.sub(
        r'\.status\((\d{3})\)\.json\(\{\s*success:\s*false,\s*error:\s*([^,\}]+)\s*\}\)',
        replace_error_status,
        content
    )

    # ------------------------------------------------------------------
    # G. .status(NNN).json({ success: false, error: '...', details: ... })
    #    Keep details, replace error->message, success->code.
    # ------------------------------------------------------------------
    def replace_error_details(match):
        code = match.group(1)
        msg = match.group(2)
        rest = match.group(3)  # includes comma + details + closing
        return f".status({code}).json({{ code: {code}, message: {msg}{rest})"

    content = re.sub(
        r'\.status\((\d{3})\)\.json\(\{\s*success:\s*false,\s*error:\s*([^,]+)(,\s*details:[^\)]+)\)',
        replace_error_details,
        content
    )

    # ------------------------------------------------------------------
    # H. Generic res.json({ success: false, error: '...' }) without status.
    #    Infer status from preceding .status(NNN) in same or previous lines.
    # ------------------------------------------------------------------
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        if 'success: false' not in line or 'error:' not in line:
            new_lines.append(line)
            continue

        # Already replaced by earlier regex? Skip if code: already present
        if 'code:' in line and 'success: false' not in line:
            new_lines.append(line)
            continue

        # Find status code
        status_code = '500'
        context = ' '.join(lines[max(0, i - 2):i + 1])
        m = re.search(r'\.status\((\d{3})\)', context)
        if m:
            status_code = m.group(1)

        # Replace error: -> message:
        line = re.sub(r'\berror\b(?=\s*:)', 'message', line)
        # Replace success: false -> code: NNN
        line = re.sub(r'success:\s*false', f'code: {status_code}', line)

        # If no data field and line ends with } or }), inject data: null
        if 'data:' not in line:
            # Replace last occurrence of } with , data: null }
            line = re.sub(r'([\s,]*)(\}\s*\)?)\s*$', r', data: null\2', line)
            # Fix possible double commas
            line = re.sub(r',\s*,', ',', line)
            line = re.sub(r'\{\s*,', '{', line)

        new_lines.append(line)

    content = '\n'.join(new_lines)

    # ------------------------------------------------------------------
    # I. Health check specific: { ok: false, error: '...' }
    # ------------------------------------------------------------------
    content = re.sub(
        r"\{\s*ok:\s*false,\s*error:\s*([^\}]+)\s*\}",
        r"{ ok: false, message: \1, data: null }",
        content
    )

    # ------------------------------------------------------------------
    # J. Clean up double commas
    # ------------------------------------------------------------------
    content = re.sub(r',\s*,', ',', content)
    content = re.sub(r'\{\s*,', '{', content)

    if content != original:
        path.write_text(content, encoding='utf-8')
        print(f'Updated: {path}')


def main():
    files = list(API_SRC.rglob('*.ts'))
    for f in files:
        if f.name in ('swagger.ts',):
            continue
        replace_in_file(f)
    print('Done.')


if __name__ == '__main__':
    main()
