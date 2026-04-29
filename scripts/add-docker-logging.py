import sys, re

def add_logging(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 处理 BOM
    if lines and lines[0].startswith('\ufeff'):
        lines[0] = lines[0][1:]

    # 找到所有 service 块的范围
    service_ranges = []
    in_services = False
    start_idx = None

    for idx, line in enumerate(lines):
        stripped = line.lstrip()
        if not stripped or stripped.startswith('#'):
            continue

        indent = len(line) - len(line.lstrip())

        if stripped == 'services:' or stripped.startswith('services:'):
            in_services = True
            continue

        if in_services:
            # 检测全局顶级关键字（缩进为0）
            if indent == 0 and (stripped.startswith('volumes:') or stripped.startswith('networks:') or stripped.startswith('version:')):
                if start_idx is not None:
                    service_ranges.append((start_idx, idx))
                    start_idx = None
                in_services = False
                continue

            # service 名称行：缩进2空格
            if indent == 2 and re.match(r'^[a-zA-Z0-9_-]+:\s*$', stripped):
                if start_idx is not None:
                    service_ranges.append((start_idx, idx))
                start_idx = idx

    if start_idx is not None:
        service_ranges.append((start_idx, len(lines)))

    # 插入 logging 配置
    final_lines = lines[:]
    offset = 0

    for start, end in service_ranges:
        # 找到 service 块中最后一个非空、非注释、且属于该 service 的行的位置
        # 属于该 service 的行：缩进 >= 4，或者是空行/注释（但空行/注释后面还有内容则继续）
        insert_pos = end
        for j in range(end - 1, start, -1):
            line_j = final_lines[j + offset]
            stripped_j = line_j.lstrip()
            if not stripped_j:
                continue
            if stripped_j.startswith('#'):
                continue
            indent_j = len(line_j) - len(line_j.lstrip())
            if indent_j >= 4 or (indent_j == 2 and not re.match(r'^[a-zA-Z0-9_-]+:\s*$', stripped_j)):
                insert_pos = j + 1
                break

        indent = '    '
        logging_block = [
            indent + 'logging:\n',
            indent + '  driver: "json-file"\n',
            indent + '  options:\n',
            indent + '    max-size: "100m"\n',
            indent + '    max-file: "5"\n',
            indent + '    compress: "true"\n',
        ]

        final_lines = final_lines[:insert_pos + offset] + logging_block + final_lines[insert_pos + offset:]
        offset += len(logging_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)

    print("Updated: " + file_path + " (added logging to " + str(len(service_ranges)) + " services)")

for fp in sys.argv[1:]:
    add_logging(fp)
