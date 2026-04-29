import sys, re

def add_labels(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 处理 BOM
    if lines and lines[0].startswith('\ufeff'):
        lines[0] = lines[0][1:]

    # 需要添加 label 的业务服务
    target_services = {
        'api', 'landing', 'java-gateway', 'java-auth', 'java-user',
        'java-payment', 'java-order', 'java-cart', 'java-logistics'
    }

    # 找到所有 service 块
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
            if indent == 0 and (stripped.startswith('volumes:') or stripped.startswith('networks:') or stripped.startswith('version:')):
                if start_idx is not None:
                    service_ranges.append((start_idx, idx))
                    start_idx = None
                in_services = False
                continue

            if indent == 2 and re.match(r'^[a-zA-Z0-9_-]+:\s*$', stripped):
                if start_idx is not None:
                    service_ranges.append((start_idx, idx))
                start_idx = idx

    if start_idx is not None:
        service_ranges.append((start_idx, len(lines)))

    final_lines = lines[:]
    offset = 0

    for start, end in service_ranges:
        # 获取 service 名称
        service_name = lines[start].strip().rstrip(':')
        if service_name not in target_services:
            continue

        # 找到 service 块中最后一个非空行的位置
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

        label_block = [
            '    labels:\n',
            '      - "com.centurylinklabs.watchtower.enable=true"\n',
        ]

        final_lines = final_lines[:insert_pos + offset] + label_block + final_lines[insert_pos + offset:]
        offset += len(label_block)
        print("Added watchtower label to service: " + service_name)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_lines)

    print("Updated: " + file_path)

add_labels(sys.argv[1])
