# Landing Docker 容器化问题总结

> **状态**: 已转为本地开发模式运行  
> **建议**: 前端团队优化构建配置后再尝试容器化

---

## 问题 1: pnpm Workspace 依赖解析失败

### 现象
```
ERR_PNPM_NO_PKG_MANIFEST  No package.json found in /app
# 或
npm error Unsupported URL Type "workspace:": workspace:*
```

### 原因
- Landing 依赖了 `@agenthive/types: "workspace:*"`
- Docker 容器内的 npm 不支持 workspace 协议
- pnpm 需要 `pnpm-workspace.yaml` 和完整的 monorepo 结构

### 影响
- 无法在容器内直接 `npm install`
- 必须先用 pnpm 在宿主机安装好，再挂载整个 node_modules

### 建议修复
**方案 A**: 移除 workspace 依赖，改为普通 npm 包
```json
// package.json
"@agenthive/types": "^1.0.0"  // 改为版本号
```

**方案 B**: 构建时预打包 types
```dockerfile
# Dockerfile
COPY packages/types /tmp/types
RUN cd /tmp/types && npm pack && npm install /tmp/types/*.tgz
```

---

## 问题 2: Volume 挂载覆盖代码

### 现象
```
Error: Cannot find module '/app/package.json'
```

### 原因
```yaml
volumes:
  - ./agenthive-cloud:/app          # 代码
  - landing-node-modules:/app/node_modules  # 这会覆盖代码中的 node_modules
```

Docker volume 挂载顺序导致 `node_modules` 覆盖了代码目录。

### 建议修复
**方案 A**: 分开挂载
```yaml
volumes:
  - ./agenthive-cloud/apps/landing:/app:delegated
  - landing-node-modules:/app/node_modules
  # 不要挂载整个 agenthive-cloud
```

**方案 B**: 使用 pnpm 的 --shamefully-hoist
```bash
pnpm install --shamefully-hoist  # 扁平化依赖
```

---

## 问题 3: Vite 开发服务器崩溃

### 现象
```
ERROR  Pre-transform error: The service is no longer running
Plugin: vite:client-inject
File: /app/node_modules/.pnpm/vue@3.5.32/...

[nitro] ERROR Error: The service is no longer running
```

### 原因
- Vite 的 esbuild 服务在容器内反复崩溃
- 可能是内存限制或文件系统监听问题
- Windows 宿主机 + Docker 容器的文件系统兼容性

### 临时解决
```yaml
deploy:
  resources:
    limits:
      memory: 2G  # 增加内存限制
    reservations:
      memory: 500M
```

### 建议修复
**方案 A**: 使用 Vite 的 polling 模式
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    server: {
      watch: {
        usePolling: true,  // 容器内必须使用 polling
        interval: 1000
      }
    }
  }
})
```

**方案 B**: 生产模式运行
```yaml
# 不用 npm run dev，用 npm run build + npm start
command: sh -c "pnpm build && pnpm start"
```

---

## 问题 4: Windows 路径兼容性问题

### 现象
- Nuxt 生成的 CSS/JS 路径包含 Windows 绝对路径：
```html
<link rel="stylesheet" href="/_nuxt/@fs/E:/Git/ai-digital-twin/...">
```

### 原因
- Vite 在 Windows 宿主机上运行时，使用绝对路径
- Nginx 反向代理后，浏览器无法解析这些路径

### 当前解决
Nginx 配置添加特殊处理：
```nginx
location ~ ^/_nuxt/@fs/(.*)$ {
    proxy_pass http://landing/_nuxt/@fs/$1;
}
```

### 建议修复
**方案 A**: 配置 Vite 使用相对路径
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    build: {
      assetsDir: '_nuxt',
      rollupOptions: {
        output: {
          assetFileNames: '_nuxt/[name].[hash][extname]'
        }
      }
    }
  }
})
```

**方案 B**: 使用 WSL2 或 Linux 宿主机
- 避免 Windows 路径问题

---

## 问题 5: 文件监听和热重载失效

### 现象
- 代码修改后，容器内的服务不自动重载
- 需要手动重启容器才能看到更新

### 原因
- Docker Desktop on Windows 使用 SMB/CIFS 共享文件
- Vite 的 native fs.watch 在容器内不工作

### 建议修复
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 1000
      },
      hmr: {
        port: 24678,  // 固定 HMR 端口
        clientPort: 24678
      }
    }
  },
  // 禁用 Nitro 的默认文件监听
  nitro: {
    watchOptions: {
      usePolling: true
    }
  }
})
```

---

## 推荐的 Docker 配置

### 方案 1: 生产模式（推荐用于部署）
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build  # 先构建

FROM nginx:alpine
COPY --from=builder /app/.output/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 方案 2: 开发模式（如果必须容器化）
```yaml
services:
  landing:
    image: node:20-alpine
    working_dir: /app
    # 关键：不要用 pnpm，用 npm + 预构建的 node_modules
    volumes:
      - ./agenthive-cloud/apps/landing:/app
      # node_modules 不挂载，在镜像内安装
    environment:
      - NODE_ENV=development
      - NUXT_HOST=0.0.0.0
      # 禁用文件监听，使用手动重启
      - NUXT_DEVTOOLS=false
    command: >
      sh -c "
        npm install --legacy-peer-deps &&
        npm run dev -- --host 0.0.0.0
      "
```

---

## 当前解决方案

**已改为本地 Node 直接运行**：
```bash
cd agenthive-cloud/apps/landing
pnpm install
pnpm run dev
```

**优点：**
- ✅ 无 Docker 文件系统问题
- ✅ 热重载正常工作
- ✅ Vite 不会崩溃
- ✅ Windows 路径正常

**缺点：**
- ❌ 不是全容器化
- ❌ 需要本地安装 Node

---

## 待前端修复后重新尝试

### 前置条件
1. [ ] 移除或替换 `@agenthive/types` 的 workspace 依赖
2. [ ] 配置 Vite 使用 polling 模式（容器兼容）
3. [ ] 配置静态资源使用相对路径（无 @fs）
4. [ ] 提供生产构建的 Dockerfile

### 验证步骤
```bash
# 1. 生产构建测试
docker build -t landing-test -f Dockerfile .
docker run -p 3000:80 landing-test

# 2. 开发模式测试
docker-compose -f docker-compose.dev.yml up landing
# 修改代码，验证热重载
```

---

**相关文档：**
- [RFC-001: Workspace 架构设计](./RFC-001-Workspace-Architecture.md)
- [Nuxt 3 Docker 部署指南](https://nuxt.com/docs/getting-started/deployment)
- [Vite 配置参考](https://vitejs.dev/config/)
