#!/bin/bash
# =============================================================================
# Git 历史敏感数据清理脚本 (TICKET-P0-003)
# =============================================================================
# 用途：清理 Git 历史中已删除的明文 Secret（k8s/base/01-secrets.yaml 等）
# 警告：此操作会重写 Git 历史，所有协作者需重新克隆或执行强制同步
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 检测 Git 历史中的敏感文件..."

# 检测历史中存在但当前已删除的文件
if git log --all --full-history -- "k8s/base/01-secrets.yaml" | grep -q commit; then
    echo "⚠️ 发现 k8s/base/01-secrets.yaml 存在于 Git 历史中"
fi
if git log --all --full-history -- "k8s/overlays/demo-ask/base/01-secrets.yaml" | grep -q commit; then
    echo "⚠️ 发现 k8s/overlays/demo-ask/base/01-secrets.yaml 存在于 Git 历史中"
fi

echo ""
echo "================================================================="
echo "推荐工具：git-filter-repo（比 BFG Repo-Cleaner 更现代、更安全）"
echo "================================================================="
echo ""
echo "步骤 1: 安装 git-filter-repo"
echo "  pip install git-filter-repo"
echo ""
echo "步骤 2: 执行清理（从所有分支历史中移除指定文件）"
echo "  git filter-repo --path k8s/base/01-secrets.yaml --invert-paths"
echo "  git filter-repo --path k8s/overlays/demo-ask/base/01-secrets.yaml --invert-paths"
echo ""
echo "步骤 3: 强制推送清理后的历史到远端（所有协作者需同步）"
echo "  git push origin --force --all"
echo "  git push origin --force --tags"
echo ""
echo "================================================================="
echo "替代方案：BFG Repo-Cleaner"
echo "================================================================="
echo ""
echo "步骤 1: 下载 BFG"
echo "  wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
echo ""
echo "步骤 2: 创建保护规则（防止误删当前文件中的密码）"
echo "  echo 'dev-jwt-secret-do-not-use-in-production' >> passwords.txt"
echo "  echo 'sk-your-llm-api-key' >> passwords.txt"
echo ""
echo "步骤 3: 执行清理"
echo "  java -jar bfg-1.14.0.jar --delete-files 01-secrets.yaml ."
echo "  java -jar bfg-1.14.0.jar --replace-text passwords.txt ."
echo ""
echo "步骤 4: 清理 reflog 并强制垃圾回收"
echo "  git reflog expire --expire=now --all"
echo "  git gc --prune=now --aggressive"
echo ""
echo "================================================================="
echo "清理后验证"
echo "================================================================="
echo ""
echo "验证文件已从历史中移除："
echo "  git log --all --full-history -- k8s/base/01-secrets.yaml"
echo "  （应无任何输出）"
echo ""
echo "验证敏感字符串是否残留："
echo "  git log --all -S 'dev-jwt-secret-do-not-use-in-production' --source --remotes"
echo "  git log --all -S 'DB_PASSWORD: \"dev\"' --source --remotes"
echo ""
echo "⚠️ 重要提醒："
echo "  1. 执行前务必备份仓库（git clone --mirror）"
echo "  2. 通知所有协作者在清理后重新克隆仓库"
echo "  3. 如果 Secret 曾包含真实生产密码，视为已泄露，立即轮换！"
echo "  4. GitHub/GitLab 等平台的 PR/Merge Request 历史可能仍保留差异，需手动检查"
echo ""
