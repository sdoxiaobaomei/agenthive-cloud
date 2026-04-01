#!/bin/bash
# Git 清理脚本 - 移除不应该被跟踪的文件

echo "🧹 开始清理 Git 仓库..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ 错误：当前目录不是 Git 仓库${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 当前 Git 状态：${NC}"
git status --short | head -20

echo ""
echo -e "${YELLOW}🗑️  移除已跟踪的日志和二进制文件...${NC}"

# 移除日志文件
files_to_remove=(
    "apps/supervisor/supervisor.err"
    "apps/supervisor/supervisor.log"
    "apps/web/dev.err"
    "apps/web/dev.log"
    "apps/web/vite.err"
    "apps/web/vite.log"
)

for file in "${files_to_remove[@]}"; do
    if git ls-files | grep -q "^${file}$"; then
        echo "  移除: $file"
        git rm --cached "$file" 2>/dev/null || true
    fi
done

# 移除二进制文件
if git ls-files | grep -q "apps/supervisor/supervisor.exe"; then
    echo "  移除: apps/supervisor/supervisor.exe"
    git rm --cached "apps/supervisor/supervisor.exe" 2>/dev/null || true
fi

echo ""
echo -e "${YELLOW}📝 更新 .gitignore...${NC}"
git add .gitignore
if [ -f "apps/web/.gitignore" ]; then
    git add apps/web/.gitignore
fi
if [ -f "apps/supervisor/.gitignore" ]; then
    git add apps/supervisor/.gitignore
fi

echo ""
echo -e "${GREEN}✅ 清理完成！${NC}"
echo ""
echo "请检查以下未跟踪文件，决定是否添加到仓库："
echo -e "${YELLOW}git status${NC}"
echo ""
echo "提交更改："
echo -e "${YELLOW}git commit -m \"chore: cleanup git tracking and update .gitignore\"${NC}"
