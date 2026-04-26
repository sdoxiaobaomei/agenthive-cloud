# AgentHive Landing

AgentHive Cloud 营销站点 - 基于 Nuxt 3 + Vue 3 + Tailwind CSS 构建的 SSR 应用。

> **注意**：本项目是 monorepo 的一部分，使用 **pnpm workspace** 管理依赖。请勿使用 npm/yarn 安装。

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Nuxt | 3.21.2 | SSR 框架 |
| Vue | 3.5.32 | UI 框架 |
| Vite | 8.0.9 | 构建工具 |
| Tailwind CSS | 3.4.19 | 原子化 CSS |
| Element Plus | 2.13.6 | UI 组件库 |
| Pinia | 3.0.4 | 状态管理 |
| GSAP | 3.14.2 | 动画引擎 |

---

## 快速开始

### 1. 安装依赖（在 monorepo 根目录）

```bash
cd E:\Git\agenthive-cloud
pnpm install
```

> 如果只在 landing 目录下安装，pnpm 也能自动识别 workspace 链接：
> ```bash
> cd apps/landing
> pnpm install
> ```

### 2. 启动开发服务器

```bash
cd apps/landing
pnpm dev
```

开发服务器运行在 http://localhost:3000

### 3. 构建

```bash
# 生产构建（SSR 模式）
pnpm build

# 静态生成（用于静态托管）
pnpm generate
```

### 4. 预览构建结果

```bash
# SSR 预览
pnpm preview

# 或直接运行 Nitro 服务器
node .output/server/index.mjs
```

---

## 常用脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| `dev` | `pnpm dev` | 启动开发服务器 |
| `build` | `pnpm build` | 生产构建（SSR） |
| `generate` | `pnpm generate` | 静态站点生成 |
| `preview` | `pnpm preview` | 预览构建结果 |
| `clean` | `pnpm clean` | 清理编译缓存和构建产物 |
| `typecheck` | `pnpm typecheck` | TypeScript 类型检查 |
| `test` | `pnpm test` | 运行单元测试（Vitest） |
| `test:e2e` | `pnpm test:e2e` | 运行 E2E 测试（Playwright） |

### 清理编译产物

```bash
pnpm clean
```

这会删除：
- `.nuxt-build/dist/` — 客户端/服务端构建产物
- `.nuxt-build/dev/` — dev 模式构建产物
- `.output/` — 最终输出目录
- `.vite-cache/` — Vite 缓存

---

## 目录结构

```
apps/landing/
├── .nuxt-build/              # Nuxt 构建缓存和类型定义（由 postinstall 生成）
├── assets/
│   └── css/
│       ├── tailwind.css      # Tailwind CSS 入口 + 全局设计令牌
│       └── element-plus-override.css  # Element Plus 样式覆盖
├── components/               # Vue 组件（自动导入）
│   ├── animated/             # 动画子组件
│   ├── organisms/            # 复杂组件
│   └── ...                   # 页面级组件
├── composables/              # 组合式函数（自动导入）
│   ├── useApi.ts
│   ├── useAuth.ts
│   └── useLoading.ts
├── docs/                     # 项目内部文档
│   ├── API_INTEGRATION.md
│   └── SSR-SAFETY-GUIDE.md
├── e2e/                      # Playwright E2E 测试
│   └── landing.spec.ts
├── layouts/                  # 页面布局
│   ├── chat.vue              # 聊天页布局
│   └── default.vue           # 默认布局
├── middleware/               # 路由中间件
│   └── auth.global.ts        # 全局认证中间件
├── pages/                    # 页面路由（文件即路由）
│   ├── index.vue             # 首页
│   ├── login.vue             # 登录页
│   ├── chat.vue              # 聊天页
│   ├── docs/
│   │   ├── agents.vue
│   │   ├── api.vue
│   │   ├── code.vue
│   │   ├── concepts.vue
│   │   ├── quickstart.vue
│   │   ├── tasks.vue
│   │   └── vue3-agent-guide.vue
│   └── ...                   # 其他营销页面
├── plugins/                  # Nuxt 插件
│   ├── element-plus.ts
│   ├── error-handler.ts
│   ├── pinia-persistedstate.client.ts
│   └── telemetry.client.ts
├── public/                   # 静态资源（直接复制到输出目录）
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── avatars/              # 角色头像
├── server/                   # Nitro 服务端 API（BFF 层）
│   ├── api/                  # API 路由
│   │   ├── agents.get.ts
│   │   ├── auth/
│   │   ├── code/
│   │   ├── projects/
│   │   └── tasks.get.ts
│   ├── plugins/
│   │   └── telemetry.ts
│   └── utils/
│       ├── apiProxy.ts
│       └── logger.ts
├── stores/                   # Pinia Store（自动导入）
│   ├── auth.ts
│   ├── chat.ts
│   └── project.ts
├── utils/                    # 工具函数
│   ├── constants.ts
│   ├── error-handler.ts
│   ├── format.ts
│   └── validators.ts
├── app.vue                   # 应用根组件
├── nuxt.config.ts            # Nuxt 配置
├── tailwind.config.js        # Tailwind CSS 配置
├── vitest.config.ts          # Vitest 测试配置
├── package.json
└── tsconfig.json             # 继承 .nuxt-build/tsconfig.json
```

---

## 环境变量

复制 `.env.example` 创建本地配置：

```bash
cp .env.example .env.local
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NUXT_PUBLIC_API_BASE` | `http://localhost:8080` | 后端 API 基础地址 |

---

## Docker 部署

### SSR 模式（Node.js 服务器）

```bash
docker build -f apps/landing/Dockerfile -t agenthive/landing:latest .
docker run -p 3000:80 agenthive/landing:latest
```

### 静态生成模式（Nginx）

```bash
docker build -f apps/landing/Dockerfile.prod -t agenthive/landing:static .
docker run -p 3000:80 agenthive/landing:static
```

---

## 注意事项

1. **必须使用 pnpm**：本项目依赖 `workspace:*` 协议，npm 和 yarn 不支持。
2. **Windows 文件锁**：如遇 `.nuxt` 目录文件被锁定无法删除，已配置 `buildDir: '.nuxt-build'` 绕过。
3. **构建缓存**：如果构建异常，先执行 `pnpm clean` 清除缓存后再重新构建。
4. **Favicon**：已配置 AgentHive 品牌 favicon（`public/favicon.ico` + `public/apple-touch-icon.png`）。
