#!/usr/bin/env python3
"""
CI 本地预检脚本 (跨平台)

在 commit/push 前本地运行，模拟 GitHub Actions 中以下 CI 检查:
  - File Quality Gate  (file-quality-gate.yml)
  - Database Migration (db-migrate.yaml 的 lint 步骤)

用法:
  python scripts/ci-precheck.py               # 检查相对 origin/develop 的变更文件
  python scripts/ci-precheck.py --changed      # 同上（显式）
  python scripts/ci-precheck.py --base main    # 指定 base ref
  python scripts/ci-precheck.py --all          # 检查所有文件（不限于变更）
  python scripts/ci-precheck.py --migrations-only  # 只检查 migration 文件
"""

import argparse
import json
import os
import re
import subprocess
import sys

# Windows: 强制 stdout/stderr 使用 UTF-8 编码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── 配置 ──────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS_DIR = os.path.join(PROJECT_ROOT, "apps", "api", "src", "db", "migrations")
MIGRATION_NAME_RE = re.compile(r"^\d{14}_[a-z0-9-]+\.sql$")
MIGRATION_DOWN_MARKER = "${node-pg-migrate}-down"

# 敏感文件名模式（不含 .env.template / .env.example / .env.docker 等模板）
SENSITIVE_PATTERNS = [
    re.compile(r"\.env$"),          # .env (不含扩展名的模板)
    re.compile(r"\.key$"),
    re.compile(r"\.pem$"),
    re.compile(r"\.p12$"),
    re.compile(r"\.crt$"),
]

# 二进制扩展名（跳过编码/尾随空白检查）
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",  # 图片
    ".woff", ".woff2", ".ttf", ".eot",                # 字体
    ".mp3", ".mp4", ".avi", ".mov", ".wav",            # 音视频
    ".zip", ".tar", ".gz", ".bz2", ".7z",              # 压缩包
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",          # 文档
    ".exe", ".dll", ".so", ".dylib",                   # 二进制
    ".db", ".sqlite", ".sqlite3",                       # 数据库
}

FAILED = 0  # 全局失败计数器


def status(msg: str, ok: bool):
    """打印检查结果"""
    global FAILED
    prefix = "✅" if ok else "❌"
    print(f"  {prefix} {msg}")
    if not ok:
        FAILED += 1


def section(title: str):
    """打印检查段标题"""
    print(f"\n▶ {title}")


def is_binary(filepath: str) -> bool:
    """判断文件是否为二进制"""
    _, ext = os.path.splitext(filepath)
    if ext.lower() in BINARY_EXTENSIONS:
        return True
    # 通过内容探测
    try:
        with open(filepath, "rb") as f:
            chunk = f.read(1024)
        return b"\x00" in chunk  # 包含 null 字节的视为二进制
    except OSError:
        return True


def is_text_file(filepath: str) -> bool:
    """判断文件是否为可读文本文件"""
    return os.path.isfile(filepath) and not is_binary(filepath)


def get_changed_files(base_ref: str) -> list[str]:
    """获取相对 base_ref 的变更文件列表"""
    try:
        result = subprocess.run(
            ["git", "merge-base", base_ref, "HEAD"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            print(f"⚠️  无法计算 merge-base，回退到 git diff")
            merge_base = base_ref
        else:
            merge_base = result.stdout.strip()
    except FileNotFoundError:
        print("⚠️  git 不可用，将检查所有文件")
        return get_all_files()

    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{merge_base}..HEAD"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            print("⚠️  git diff 失败，将检查所有文件")
            return get_all_files()
    except FileNotFoundError:
        return get_all_files()

    files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
    return [os.path.join(PROJECT_ROOT, f) for f in files if os.path.isfile(os.path.join(PROJECT_ROOT, f))]


def get_all_files() -> list[str]:
    """获取所有版本控制中的文件"""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode != 0:
            return []
    except FileNotFoundError:
        return __fallback_find_files(PROJECT_ROOT)

    files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
    return [os.path.join(PROJECT_ROOT, f) for f in files if os.path.isfile(os.path.join(PROJECT_ROOT, f))]


def __fallback_find_files(root: str) -> list[str]:
    """git 不可用时的回退：遍历目录"""
    result = []
    for dirpath, dirnames, filenames in os.walk(root):
        # 跳过 node_modules, .git, dist
        skip = {".git", "node_modules", "dist", ".next", ".nuxt", "__pycache__"}
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fname in filenames:
            result.append(os.path.join(dirpath, fname))
    return result


# ── 检查函数 ──────────────────────────────────────────────

def check_trailing_whitespace(files: list[str]):
    """检查尾随空白"""
    section("尾随空白 (Trailing Whitespace)")
    ok = True
    for filepath in files:
        if not is_text_file(filepath):
            continue
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except OSError:
            continue
        bad_lines = [(i + 1, line.rstrip("\n\r")) for i, line in enumerate(lines) if line.rstrip("\n\r") != line.rstrip()]
        if bad_lines:
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            print(f"  ❌ {rel_path}:")
            for lineno, content in bad_lines:
                print(f"     L{lineno}: {content[:80]}{'...' if len(content) > 80 else ''}[TRAILING]")
            ok = False
    status("尾随空白", ok)
    if not ok:
        print("     💡 运行 python scripts/fix-trailing-whitespace.py 自动修复")


def check_utf8_encoding(files: list[str]):
    """检查文件 UTF-8 编码"""
    section("文件编码 (UTF-8)")
    ok = True
    for filepath in files:
        if not is_text_file(filepath):
            continue
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                f.read()
        except UnicodeDecodeError:
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            print(f"  ❌ {rel_path}: 不是有效的 UTF-8 编码")
            ok = False
        except OSError:
            continue
    status("文件编码", ok)


def check_final_newline(files: list[str]):
    """检查文件末尾是否有换行符"""
    section("文件末尾换行 (Final Newline)")
    ok = True
    for filepath in files:
        if not is_text_file(filepath):
            continue
        try:
            with open(filepath, "rb") as f:
                content = f.read()
        except OSError:
            continue
        if len(content) == 0:
            continue  # 空文件放过
        if not content.endswith(b"\n"):
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            print(f"  ❌ {rel_path}: 缺少末尾换行符")
            ok = False
    status("文件末尾换行", ok)


def check_yaml_syntax(files: list[str]):
    """检查 YAML 语法"""
    section("YAML 语法")
    ok = True
    try:
        import yaml
    except ImportError:
        print("  ⚠️  PyYAML 未安装，跳过 (pip install pyyaml)")
        return

    for filepath in files:
        if not filepath.endswith((".yaml", ".yml")):
            continue
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                yaml.safe_load(f)
        except (yaml.YAMLError, OSError) as e:
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            print(f"  ❌ {rel_path}: {e}")
            ok = False
    status("YAML 语法", ok)


def check_json_syntax(files: list[str]):
    """检查 JSON 语法（跳过 lock 文件）"""
    section("JSON 语法")
    ok = True
    for filepath in files:
        if not filepath.endswith(".json"):
            continue
        filename = os.path.basename(filepath)
        if "lock" in filename.lower():
            continue
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            print(f"  ❌ {rel_path}: {e}")
            ok = False
    status("JSON 语法", ok)


def check_sensitive_files(files: list[str]):
    """检查敏感文件"""
    section("敏感文件")
    ok = True
    for filepath in files:
        basename = os.path.basename(filepath)
        for pattern in SENSITIVE_PATTERNS:
            if pattern.search(basename):
                rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                print(f"  ❌ {rel_path}: 敏感文件不应提交")
                ok = False
                break
    status("敏感文件", ok)


def check_migration_files():
    """检查 migration 文件命名和 down 标记"""
    section("Migration 文件 (命名 + down 标记)")

    if not os.path.isdir(MIGRATIONS_DIR):
        print("  ⚠️  migrations 目录不存在，跳过")
        return

    migration_files = sorted([
        f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")
    ])

    if not migration_files:
        print("  ⚠️  没有 migration 文件")
        return

    # 1) 命名检查
    naming_ok = True
    for filename in migration_files:
        if not MIGRATION_NAME_RE.match(filename):
            print(f"  ❌ 命名格式错误: {filename}")
            print(f"     期望格式: YYYYMMDDHHMMSS_description.sql")
            naming_ok = False
    status("Migration 文件命名", naming_ok)

    # 2) down 标记检查
    down_ok = True
    for filename in migration_files:
        filepath = os.path.join(MIGRATIONS_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except OSError:
            print(f"  ❌ 无法读取: {filename}")
            down_ok = False
            continue
        if MIGRATION_DOWN_MARKER not in content:
            print(f"  ❌ 缺少 down 标记: {filename}")
            print(f"     需要: -- ${{node-pg-migrate}}-down")
            down_ok = False
    status("Migration down 标记", down_ok)


# ── 主入口 ────────────────────────────────────────────────

def main():
    global FAILED

    parser = argparse.ArgumentParser(
        description="AgentHive Cloud CI 本地预检脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/ci-precheck.py                    # 检查变更文件
  python scripts/ci-precheck.py --base main        # 对比 main 分支
  python scripts/ci-precheck.py --all              # 检查所有文件
  python scripts/ci-precheck.py --migrations-only  # 只检查 migration
        """
    )
    parser.add_argument(
        "--base", default="origin/develop",
        help="基准分支 (默认: origin/develop)"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="检查所有文件，不限于变更"
    )
    parser.add_argument(
        "--changed", action="store_true", default=True,
        help="仅检查变更文件 (默认)"
    )
    parser.add_argument(
        "--migrations-only", action="store_true",
        help="仅检查 migration 文件"
    )

    args = parser.parse_args()

    os.chdir(PROJECT_ROOT)
    print(f"AgentHive CI 预检 | 项目根: {PROJECT_ROOT}\n")

    # 获取要检查的文件列表
    if args.migrations_only:
        check_migration_files()
        print(f"\n{'='*50}")
        print(f"{'通过 🎉' if FAILED == 0 else f'失败 {FAILED} 项'}")
        sys.exit(1 if FAILED > 0 else 0)

    if args.all:
        files = get_all_files()
        print(f"模式: 检查所有文件 ({len(files)} 个)")
    else:
        files = get_changed_files(args.base)
        print(f"模式: 检查变更文件 (base={args.base}, {len(files)} 个文件)")

    if not files:
        print("没有要检查的文件。")
        sys.exit(0)

    # 文件质量检查
    check_trailing_whitespace(files)
    check_utf8_encoding(files)
    check_final_newline(files)
    check_yaml_syntax(files)
    check_json_syntax(files)
    check_sensitive_files(files)

    # Migration 文件检查（始终检查全部 migration 文件）
    check_migration_files()

    # 汇总
    print(f"\n{'='*50}")
    if FAILED == 0:
        print("✅ 所有检查通过！")
        sys.exit(0)
    else:
        print(f"❌ {FAILED} 项检查失败，请在 commit 前修复。")
        sys.exit(1)


if __name__ == "__main__":
    main()
