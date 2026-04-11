# npm install 与 Docker 多阶段构建详解

> 解释 `--only=production` 的用途和正确使用方式

---

## 🤔 问题本质

用户问：
```
既然 --only=production 会导致构建失败，它存在的意义是什么？
什么时候才需要用它？
```

**答案**: `--only=production` 有重要的用途，但必须配合**多阶段构建**正确使用。

---

## 📦 npm 依赖的分类

```json
{
  "dependencies": {
    "express": "^4.18.0",      // 生产运行必需
    "pg": "^8.11.0"            // 生产运行必需
  },
  "devDependencies": {
    "typescript": "^5.0.0",     // 开发/构建需要
    "jest": "^29.0.0",          // 测试需要
    "@types/node": "^20.0.0"    // 类型定义，构建需要
  }
}
```

| 类型 | 内容 | 生产环境需要？ |
|------|------|--------------|
| `dependencies` | express, pg, redis 等 | ✅ 必需 |
| `devDependencies` | typescript, jest, @types/* | ❌ 运行时不需要 |

---

## 🎯 `--only=production` 的用途

### 场景 1：减小生产镜像体积

```
总依赖：
├── dependencies (10MB)      ← 生产需要
└── devDependencies (200MB)  ← 生产不需要
                          (TypeScript + Jest + 类型定义等)

使用 --only=production：
镜像大小从 210MB → 10MB
```

### 场景 2：减少攻击面

```
更少的依赖 = 更少的潜在漏洞

jest 可能依赖某个有漏洞的库
但如果生产环境不装 jest，这个漏洞就不存在
```

### 场景 3：加快部署速度

```
更少的文件 = 更快的构建和传输
```

---

## 🏗️ 正确的多阶段构建模式

```dockerfile
# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# ✅ 安装**所有**依赖（包括 devDependencies）
# 因为需要 TypeScript 编译器、构建工具等
RUN npm ci

# 复制源码
COPY . .

# 构建（需要 tsc）
RUN npm run build

# ============ 生产阶段 ============
FROM node:20-alpine

WORKDIR /app

# 复制 package.json
COPY package*.json ./

# ✅ 只安装生产依赖（不需要 devDependencies）
# 因为运行时不需要 TypeScript、Jest 等
RUN npm ci --only=production

# 从构建阶段复制编译结果
COPY --from=builder /app/dist ./dist

# 启动
CMD ["node", "dist/index.js"]
```

### 数据流图解

```
┌─────────────────────────────────────────────────────────────┐
│ 构建阶段 (builder)                                          │
│                                                             │
│  package.json                                               │
│  ├── dependencies (10MB)     ← 安装 ✓                       │
│  └── devDependencies (200MB) ← 安装 ✓ (需要 tsc/jest)       │
│                                                             │
│  源码 → tsc 编译 → dist/                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ 只复制 dist 和 production 依赖
┌─────────────────────────────────────────────────────────────┐
│ 生产阶段 (production)                                       │
│                                                             │
│  package.json                                               │
│  ├── dependencies (10MB)     ← 安装 ✓                       │
│  └── devDependencies (200MB) ← 不安装 ✗                     │
│                                                             │
│  dist/ ← 来自构建阶段                                       │
│  node_modules/ ← 只有 production 依赖                       │
└─────────────────────────────────────────────────────────────┘

最终镜像：10MB (依赖) + 构建产物 = 很小！
```

---

## ❌ 错误的做法

### 错误 1：构建阶段就用 `--only=production`

```dockerfile
# ❌ 错误！
FROM node:20-alpine

COPY package*.json ./

# 这里用了 --only=production
RUN npm ci --only=production

COPY . .

# 构建失败！因为 typescript 在 devDependencies
RUN npm run build  # ❌ tsc: not found
```

### 错误 2：单阶段构建，安装所有依赖

```dockerfile
# ❌ 不够优化
FROM node:20-alpine

COPY package*.json ./

# 安装了所有依赖（包括 dev）
RUN npm ci

COPY . .
RUN npm run build

# 镜像包含所有 devDependencies，很大！
CMD ["node", "dist/index.js"]
```

---

## ✅ 不同场景的正确做法

### 场景 A：TypeScript/需要编译的项目

```dockerfile
# 多阶段构建必须
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # ✅ 所有依赖
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production  # ✅ 只生产依赖
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### 场景 B：纯 JavaScript/不需要编译

```dockerfile
# 可以单阶段
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production  # ✅ 直接只装生产依赖
COPY . .
CMD ["node", "index.js"]
```

### 场景 C：前端项目（Nuxt/Vue/React）

```dockerfile
# 和 TypeScript 类似
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # ✅ 需要构建工具
COPY . .
RUN npm run build

# 用 nginx 托管静态文件
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# 或者 Nuxt: /app/.output/public
```

---

## 📊 对比

| 方式 | 镜像大小 | 构建可行性 | 推荐度 |
|------|---------|-----------|--------|
| 单阶段 + `npm ci` | 大 (210MB) | ✅ 成功 | ⭐⭐ |
| 单阶段 + `--only=production` | 小 (10MB) | ❌ 失败 | ❌ |
| 多阶段 + 正确使用 | 小 (10MB) | ✅ 成功 | ⭐⭐⭐⭐⭐ |

---

## 💡 记忆口诀

```
构建阶段：npm ci
         全部依赖都装上
         编译测试都需要

生产阶段：npm ci --only=production
         只装生产依赖
         精简镜像省空间
```

---

## 🔧 修复后的 API Dockerfile

```dockerfile
# API 生产构建 Dockerfile

# ============ 构建阶段 ============
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# ✅ 修复：安装所有依赖（包括 devDependencies）
RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build

# ============ 生产阶段 ============
FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

# ✅ 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 从构建阶段复制
COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

**但我建议更进一步的优化**：在生产阶段也复制 node_modules，而不是重新安装。

```dockerfile
# 最终优化版本
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app

# ✅ 直接从 builder 复制所有需要的内容
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

这样更快，因为不需要在生产阶段重新 `npm install`！
