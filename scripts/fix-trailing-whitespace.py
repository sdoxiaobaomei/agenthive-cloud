#!/usr/bin/env python3
"""
自动修复文件尾随空白 (跨平台)

移除文本文件每行末尾的多余空格，保持文件编码不变。

用法:
  python scripts/fix-trailing-whitespace.py               # 修复变更文件
  python scripts/fix-trailing-whitespace.py --check        # 仅检测，不修改
  python scripts/fix-trailing-whitespace.py --all          # 修复所有文件
  python scripts/fix-trailing-whitespace.py --base main    # 指定基准分支
  python scripts/fix-trailing-whitespace.py <file1> <file2> # 修复指定文件
"""

import argparse
import os
import subprocess
import sys

# Windows: 强制 stdout/stderr 使用 UTF-8 编码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 二进制扩展名（跳过这些文件）
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".avi", ".mov", ".wav",
    ".zip", ".tar", ".gz", ".bz2", ".7z",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".exe", ".dll", ".so", ".dylib",
    ".db", ".sqlite", ".sqlite3",
}


def is_binary(filepath: str) -> bool:
    """判断文件是否为二进制"""
    _, ext = os.path.splitext(filepath)
    if ext.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with open(filepath, "rb") as f:
            chunk = f.read(1024)
        return b"\x00" in chunk
    except OSError:
        return True


def get_changed_files(base_ref: str) -> list[str]:
    """获取相对 base_ref 的变更文件列表"""
    try:
        result = subprocess.run(
            ["git", "merge-base", base_ref, "HEAD"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            cwd=PROJECT_ROOT
        )
        merge_base = result.stdout.strip() if result.returncode == 0 else base_ref
    except FileNotFoundError:
        print("⚠️  git 不可用")
        return []

    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{merge_base}..HEAD"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            cwd=PROJECT_ROOT
        )
    except FileNotFoundError:
        return []

    files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
    return [os.path.join(PROJECT_ROOT, f) for f in files
            if os.path.isfile(os.path.join(PROJECT_ROOT, f))]


def get_all_files() -> list[str]:
    """获取所有版本控制中的文件"""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            cwd=PROJECT_ROOT
        )
        files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
        return [os.path.join(PROJECT_ROOT, f) for f in files
                if os.path.isfile(os.path.join(PROJECT_ROOT, f))]
    except FileNotFoundError:
        return []


def fix_trailing_whitespace(filepath: str, dry_run: bool = False) -> tuple[int, int]:
    """
    修复单个文件的尾随空白。
    返回 (修复行数, 总行数)
    """
    if not os.path.isfile(filepath) or is_binary(filepath):
        return 0, 0

    # 读取原始内容
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            original_lines = f.readlines()
    except (UnicodeDecodeError, OSError):
        return 0, 0

    # 去掉每行末尾空白（保留换行符）
    fixed_lines = []
    fixed_count = 0
    for i, line in enumerate(original_lines):
        stripped = line.rstrip("\n\r")
        trimmed = stripped.rstrip()
        if len(trimmed) < len(stripped):
            fixed_count += 1
            # 保留原始换行符
            if line.endswith("\r\n"):
                fixed_lines.append(trimmed + "\r\n")
            elif line.endswith("\n"):
                fixed_lines.append(trimmed + "\n")
            else:
                fixed_lines.append(trimmed)
        else:
            fixed_lines.append(line)

    if fixed_count == 0:
        return 0, len(original_lines)

    if not dry_run:
        try:
            # 保留原始换行符风格
            newline = None  # 自动检测
            with open(filepath, "r", newline="", encoding="utf-8") as f:
                f.read()
                newline = f.newlines

            with open(filepath, "w", encoding="utf-8", newline="") as f:
                f.writelines(fixed_lines)
        except OSError as e:
            print(f"  ❌ 写入失败: {e}")
            return 0, len(original_lines)

    return fixed_count, len(original_lines)


def main():
    parser = argparse.ArgumentParser(
        description="自动修复文本文件中的尾随空白",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/fix-trailing-whitespace.py                    # 修复变更文件
  python scripts/fix-trailing-whitespace.py --check            # 仅检测
  python scripts/fix-trailing-whitespace.py --all              # 修复所有文件
  python scripts/fix-trailing-whitespace.py src/app.ts         # 修复指定文件
        """
    )
    parser.add_argument(
        "files", nargs="*",
        help="要修复的文件（留空则根据 --base 或 --all 自动检测）"
    )
    parser.add_argument(
        "--base", default="origin/develop",
        help="基准分支 (默认: origin/develop)"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="修复所有文件，不限于变更"
    )
    parser.add_argument(
        "--check", "--dry-run", dest="dry_run", action="store_true",
        help="仅检测并报告，不实际修改文件"
    )

    args = parser.parse_args()
    os.chdir(PROJECT_ROOT)

    mode = "检测 (dry-run)" if args.dry_run else "修复"
    print(f"尾随空白{ mode}工具 | 项目根: {PROJECT_ROOT}\n")

    # 确定要处理的文件列表
    if args.files:
        target_files = [os.path.abspath(f) for f in args.files]
        print(f"模式: 指定 {len(target_files)} 个文件")
    elif args.all:
        target_files = get_all_files()
        print(f"模式: 全部文件 ({len(target_files)} 个)")
    else:
        target_files = get_changed_files(args.base)
        print(f"模式: 变更文件 (base={args.base}, {len(target_files)} 个)")

    if not target_files:
        print("没有要处理的文件。")
        sys.exit(0)

    # 过滤出文本文件
    text_files = [f for f in target_files if not is_binary(f)]
    skipped = len(target_files) - len(text_files)
    if skipped > 0:
        print(f"跳过 {skipped} 个二进制文件\n")

    # 处理所有文件
    total_fixed_lines = 0
    fixed_files = []

    for filepath in text_files:
        rel_path = os.path.relpath(filepath, PROJECT_ROOT)
        fixed, total = fix_trailing_whitespace(filepath, dry_run=args.dry_run)
        if fixed > 0:
            fixed_files.append((rel_path, fixed, total))
            total_fixed_lines += fixed

    # 汇总
    if fixed_files:
        print(f"\n{'-- DRY RUN --' if args.dry_run else '已修复'} {len(fixed_files)} 个文件, {total_fixed_lines} 行尾随空白:")
        for path, fixed, total in fixed_files:
            print(f"  {path}: {fixed}/{total} 行")
        if not args.dry_run:
            print(f"\n✅ 修复完成。请运行 git diff 确认变更。")
            sys.exit(0)
        else:
            print(f"\n💡 去掉 --check 参数即可自动修复。")
            sys.exit(1)
    else:
        print(f"\n{'='*50}")
        print("✅ 所有文件无尾随空白！")
        sys.exit(0)


if __name__ == "__main__":
    main()
