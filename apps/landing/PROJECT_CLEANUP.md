# Landing 项目清理记录

## 清理时间
2026-04-08

## 执行的操作

### 1. 创建 .gitignore
- 添加 Nuxt/Nitro 构建缓存忽略规则
- 添加环境变量、日志、测试覆盖率等忽略规则
- 添加编辑器/OS 临时文件忽略规则

### 2. 归档临时测试文件
将以下调试文件移动到 `archive/` 目录：

| 原位置 | 新位置 | 说明 |
|--------|--------|------|
| `test-login-debug.mjs` | `archive/test-login-debug.mjs` | 登录调试脚本 |
| `test-login-flow.mjs` | `archive/test-login-flow.mjs` | 登录流程测试 |
| `e2e-test.mjs` | `archive/e2e-test.mjs` | E2E 测试脚本 |
| `test.html` | `archive/test.html` | 临时测试页面 |

### 3. 停止追踪生成文件
- `.nuxt/` - Nuxt 构建缓存目录
- `test-results/.last-run.json` - Playwright 测试结果

## 项目结构变化

```
apps/landing/
├── ✅ 保留核心代码
│   ├── components/
│   ├── pages/
│   ├── stores/
│   ├── composables/
│   ├── layouts/
│   ├── middleware/
│   ├── plugins/
│   ├── utils/
│   ├── server/
│   ├── assets/
│   ├── public/
│   ├── nuxt.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── ✅ 新增配置
│   ├── .gitignore          # 忽略规则
│   └── PROJECT_CLEANUP.md  # 本文档
│
└── 📁 归档文件
    └── archive/            # 临时/历史文件
        ├── README.md
        ├── test-login-debug.mjs
        ├── test-login-flow.mjs
        ├── e2e-test.mjs
        └── test.html
```

## 后续建议

1. **archive/ 目录清理**：保留 3 个月（至 2026-07-01）后可删除
2. **定期执行**：建议每月运行一次 `git clean -fdx -n` 检查未追踪文件
3. **提交前检查**：PR 前检查是否有不应该提交的文件

## Git 命令参考

```bash
# 查看未追踪文件
git status

# 查看已追踪但不应提交的文件
git ls-files | grep -E "\.nuxt|\.output|test-"

# 停止追踪已提交的文件（保留本地）
git rm -r --cached .nuxt/

# 清理未追踪文件（干运行）
git clean -fdx -n

# 实际清理（谨慎使用）
git clean -fdx
```
