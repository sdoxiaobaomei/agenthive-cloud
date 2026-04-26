# 项目经验教训

## 🔥 重大事件

### Workspace 爆炸 (2026-04-05)
- **现象**: VS Code 内存 2.8GB，严重卡顿
- **原因**: 30 个 ticket × 完整 node_modules 副本 = 170 万文件
- **解决**: 符号链接方案 + 定期清理
- **教训**: "复制是万恶之源。共享和链接才是正道。"

### Landing SSR 错误
- **现象**: `Cannot read properties of undefined (reading 'addEventListener')`
- **原因**: SSR 时 `window` 不存在
- **解决**: 使用 `if (import.meta.client)` 包裹客户端代码
- **教训**: SSR 不是免费的，每个插件都要考虑服务端环境

### Store 依赖地狱
- **现象**: `Failed to resolve import "pinia"`
- **原因**: landing/package.json 缺少依赖声明
- **解决**: 每个子项目明确声明所有依赖
- **教训**: 依赖不是自动继承的

---

## 🏗️ 架构教训

| 问题 | 影响 | 建议 |
|------|------|------|
| 技术栈分裂 | Landing (Nuxt SSR) vs Web (Vite SPA) 增加复杂度 | 统一技术栈 |
| 类型定义冲突 | UI 和 Domain 同名类型 | 使用命名空间区分 |
| 路径地狱 | `../../../../packages/...` | 使用 Path Mapping |

---

## 🛠️ 工具链推荐

1. **pnpm Workspace** - 全局存储 + 硬链接，节省 90% 磁盘
2. **Changesets** - 版本发布管理
3. **Turborepo** - 构建加速

---

## 💡 团队格言

1. "如果一件事需要手动做两次，就自动化它。"
2. "复制代码是债务，共享代码是资产。"
3. "今天偷的懒，明天双倍还。"
4. "文档写得越多，解释得越少。"

### K8s 部署踩坑 (2026-04-22)

- **镜像缓存陷阱**: `latest` + `IfNotPresent` 导致节点永远使用旧镜像。必须设置 `imagePullPolicy: Always` 或使用显式版本标签。
- **ConfigMap 漂移**: 新增 key 到 ConfigMap 后，如果 Deployment 是逐个 `configMapKeyRef` 引用的，新 key 不会自动映射到容器环境变量。
- **Kustomize 数组合并**: Strategic Merge Patch 对同名数组元素会合并而非替换，导致 `Duplicate value` 错误。
- **证书与 DNS 先行**: cert-manager 的 HTTP01 challenge 要求域名 DNS 先解析到 Ingress SLB，否则验证会循环失败。
- **CORS 浏览器缓存**: 浏览器会缓存失败的 OPTIONS 预检响应，服务端修复后需强制刷新 (Ctrl+Shift+R)。
- **Dist 构建遗忘**: Dockerfile 采用"预构建 dist"模式时，修改 src 后必须先本地 `npm run build`，否则 docker build 复制的是旧 dist。

---

_最后更新: 2026-04-22_


### 本地 Docker 全栈启动踩坑 (2026-04-26)

#### 1. Nuxt runtimeConfig 构建时内联陷阱
- **现象**: Docker 中 `apiBase` 仍硬编码为 `http://localhost:3001`，浏览器直连后端触发 CORS
- **原因**: `NUXT_PUBLIC_API_BASE` 通过 `build.args` 在构建阶段内联到 HTML，运行时 `environment` 同名变量**无法覆盖**
- **解决**: 修改 `docker-compose.dev.yml` build args → 重新构建 Landing 镜像
- **教训**: Nuxt public runtimeConfig 是"构建时决定，运行时只读"，改环境变量必须 rebuild

#### 2. Spring CORS `allowCredentials=true` + `allowedOrigins("*")` 不兼容
- **现象**: Gateway 对所有 `/api/auth/*` 请求返回 500，`IllegalArgumentException`
- **原因**: Spring 6.1+ 不允许 `allowedOrigins` 含 `*` 同时 `allowCredentials=true`
- **解决**: `setAllowedOrigins("*")` → `setAllowedOriginPatterns("*")`
- **教训**: Spring 的 CORS 配置升级后行为变化，开发环境用 `allowedOriginPatterns` 更安全

#### 3. JWT Secret 跨服务不一致 → 401
- **现象**: 登录成功，但 `/api/auth/me` 返回 401，`JWT signature does not match`
- **原因**: auth-service 使用 `.env.dev` 的 `JWT_SECRET`，Gateway 使用默认值 `agenthive-default-secret-key-2024`
- **解决**: `docker-compose.dev.yml` gateway-service 添加 `JWT_SECRET: ${JWT_SECRET}`
- **教训**: 任何参与 JWT 签/验的服务必须共享同一个 secret，默认值是安全隐患

#### 4. Docker 容器内 `localhost` 自我指涉陷阱
- **现象**: Landing BFF 注册接口 500，内部调用 Gateway 失败
- **原因**: Landing BFF 中 `getGatewayBase()` 默认 `http://localhost:8080`，在容器内指向自己
- **解决**: `docker-compose.dev.yml` landing 添加 `GATEWAY_URL: http://gateway-service:8080`
- **教训**: 容器内绝不能用 `localhost` 访问其他服务，必须用 Docker Compose service name

#### 5. nginx `location` 前缀匹配跳过了 BFF
- **现象**: `/api/auth/me` 直接打到 Gateway，Landing BFF 的格式转换、错误处理未生效
- **原因**: nginx.conf 中 `location /api/auth` 优先级高于 `location /api`，请求被直接代理到 Gateway
- **解决**: 移除单独的 `location /api/auth`，统一走 Landing BFF；单独保留 `location /api/chat` 走 Node API
- **教训**: 引入 BFF 后，nginx 的 API 路由需要重新梳理，避免"直连后端"和"走 BFF"混用

#### 6. Spring 标准环境变量名
- **现象**: Java 服务 RabbitMQ 连接失败、Nacos 认证失败
- **原因**: 使用了自定义变量名如 `RABBITMQ_HOST`、`NACOS_SERVER`，Spring 不认识
- **解决**: 统一使用 `SPRING_RABBITMQ_HOST`、`SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR` 等标准名
- **教训**: Spring Boot 只认标准属性名，自定义名必须通过 `@Value` 显式读取

#### 7. Nacos 2.x gRPC 延迟就绪
- **现象**: Java 服务启动报 `Connection refused: nacos/9848`
- **原因**: Nacos HTTP 端口 8848 ready 不代表 gRPC 端口 9848 ready
- **解决**: Nacos healthcheck 同时检查 `nc -z localhost 9848`
- **教训**: Nacos 2.x 引入 gRPC，healthcheck 不能只测 HTTP 端口

---

_最后更新: 2026-04-26_
