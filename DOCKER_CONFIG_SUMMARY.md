# AgentHive Cloud - Docker 启动配置汇总

> 本文档汇总了项目中所有的 Docker Compose 编排文件和 Dockerfile 构建配置，方便快速定位和使用。

---

## 一、根目录 Docker Compose 文件（3个）

### 1. `docker-compose.dev.yml` — 本地开发统一配置
- **场景**：本地开发环境，一键启动全部依赖
- **默认服务**：PostgreSQL（多数据库）、Redis、API（build）、Landing（build）
- **Profile 扩展**：
  - `--profile java`：Nacos + RabbitMQ + 7 个 Java 微服务
  - `--profile monitoring`：Prometheus + Grafana + Tempo + Loki + OTel Collector
  - `--profile with-nginx`：Nginx 反向代理
- **端口**：DB `5433`、Redis `6379`、API `3001`、Landing `80`、Nacos `8848/9848`、Java `8080-8086`
- **启动命令**：
  ```bash
  # 最简开发栈
  docker compose -f docker-compose.dev.yml --env-file .env.dev up -d

  # 含 Java 微服务
  docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d

  # 含监控栈
  docker compose -f docker-compose.dev.yml --env-file .env.dev --profile monitoring up -d

  # 全部启动
  docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java --profile monitoring --profile with-nginx up -d
  ```
- **关键特性**：
  - Nacos 带 healthcheck，Java 服务 `depends_on` 使用 `condition: service_healthy`，解决 race condition
  - PostgreSQL 自动初始化多数据库（agenthive + 6 个 Java 服务库）

### 2. `docker-compose.prod.yml` — ECS 生产部署
- **场景**：阿里云 ECS 服务器部署，连接远端 2+2 数据层
- **默认服务**：Nginx、API（镜像拉取）、Landing（镜像拉取）
- **Profile 扩展**：
  - `--profile java`：Nacos + RabbitMQ + Java Gateway/Auth/User
  - `--profile monitoring`：Prometheus + Grafana + Tempo + Loki + OTel Collector
- **特点**：
  - 不启动本地 PostgreSQL/Redis，连接远端数据库（默认 `172.24.146.165`）
  - 使用预构建镜像（非本地 build）
  - Nginx 默认启用，已挂载 SSL 目录
- **启动命令**：
  ```bash
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod --profile java up -d
  docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d
  ```

### 3. `docker-compose.demo.yml` — 演示/准生产环境
- **场景**：业务层和数据层分离部署（8C16G 跑业务，2C2G 跑数据）
- **服务**：Nginx、API（镜像拉取）、Landing（镜像拉取）、Java 微服务（profile）、监控栈（profile）、Cloudflare Tunnel（profile）
- **Profile**：
  - `--profile java`：启动 Java Gateway + Auth + User + Nacos + RabbitMQ
  - `--profile monitoring`：启动 Prometheus + Grafana + Tempo + Loki + OTel
  - `--profile with-tunnel`：启动 Cloudflare Tunnel
- **启动命令**：
  ```bash
  docker compose -f docker-compose.demo.yml --env-file .env.demo up -d
  docker compose -f docker-compose.demo.yml --env-file .env.demo --profile java up -d
  docker compose -f docker-compose.demo.yml --env-file .env.demo --profile monitoring up -d
  ```

---

## 二、应用级 Dockerfile

### Node.js 服务（多阶段构建，pnpm workspace）

| 服务 | 文件 | 基础镜像 | 特点 |
|------|------|---------|------|
| **API** | `apps/api/Dockerfile` | `node:20-alpine` | 多阶段构建，`pnpm deploy` 提取最小产物，非 root 用户，预期 ~180-250MB |
| **Landing** | `apps/landing/Dockerfile` | `node:20-alpine` | 多阶段构建，容器内完成 Nuxt 3 build，生产运行 `.output/server/index.mjs`，端口 80 |
| **Agent Runtime** | `apps/agent-runtime/Dockerfile` | `node:20-alpine` | 多阶段构建，`pnpm deploy` 提取产物，依赖 git CLI |

**构建命令示例**：
```bash
# API
docker build -f apps/api/Dockerfile -t agenthive/api:latest .

# Landing（可传入 API_BASE）
docker build -f apps/landing/Dockerfile -t agenthive/landing:latest . \
  --build-arg NUXT_PUBLIC_API_BASE=/api

# Agent Runtime
docker build -f apps/agent-runtime/Dockerfile -t agenthive/agent-runtime:latest .
```

### Java 服务（Spring Boot 3 + Layertools 分层构建）

| 服务 | 文件 | 基础镜像 | 端口 |
|------|------|---------|------|
| **Gateway** | `apps/java/gateway-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8080 |
| **Auth** | `apps/java/auth-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8081 |
| **Payment** | `apps/java/payment-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8083 |
| **Order** | `apps/java/order-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8084 |
| **Cart** | `apps/java/cart-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8085 |
| **Logistics** | `apps/java/logistics-service/Dockerfile` | `eclipse-temurin:21-jre-alpine` | 8086 |

**构建特点**：
- 使用 `jarmode=layertools` 将 fat JAR 拆分为可缓存层（dependencies / spring-boot-loader / snapshot-dependencies / application）
- JVM 参数自适应容器内存：`-XX:MaxRAMPercentage=75.0`
- 非 root 用户运行

**构建命令示例**：
```bash
cd apps/java/auth-service
mvn package -DskipTests
docker build -t agenthive/auth-service:latest .
```

### 其他 Dockerfile

| 文件 | 用途 |
|------|------|
| `apps/api/deploy/Dockerfile` | API 部署专用 |
| `apps/api/deploy/Dockerfile.ci` | CI 流水线专用 |
| `apps/api/deploy/Dockerfile.minimal` | API 最小化镜像 |
| `apps/api/deploy/Dockerfile.prod` | API 生产优化版 |
| `apps/api/deploy/Dockerfile.simple` | API 简化版 |
| `apps/landing/Dockerfile.base` | Landing 基础镜像 |
| `apps/landing/Dockerfile.minimal` | Landing 最小化镜像 |
| `apps/landing/Dockerfile.prod` | Landing 生产优化版 |
| `monitoring/grafana/Dockerfile` | Grafana 自定义镜像 |
| `monitoring/node-exporter/Dockerfile` | Node Exporter 自定义镜像 |
| `monitoring/prometheus/Dockerfile` | Prometheus 自定义镜像 |
| `monitoring/opentelemetry/otel-collector/Dockerfile` | OTel Collector 自定义镜像 |

---

## 三、监控/可观测性 Docker Compose

### `monitoring/docker-compose.yml` — 统一可观测性栈（LGTM + Beyla）
- **服务**：MinIO、Tempo、Loki、Prometheus（build）、Grafana（build）、Node Exporter（build）、OTel Collector、Beyla（profile）
- **端口**：9000/9001（MinIO）、3200（Tempo）、3100（Loki）、9090（Prometheus）、**3003**（Grafana）、9100（Node Exporter）、4327/4328（OTel）
- **Beyla**：eBPF 无侵入追踪，需 privileged + host network，默认不启动
- **注意**：独立 monitoring 栈与 dev/prod 的 `--profile monitoring` 不要同时运行（端口冲突）
- **启动命令**：
  ```bash
  cd monitoring
  docker compose up -d
  docker compose --profile beyla up -d   # 启用 eBPF 追踪
  ```

### 其他监控配置

| 文件 | 用途 |
|------|------|
| `monitoring/beyla/docker-compose.yml` | Beyla 独立配置 |
| `monitoring/elk/docker-compose.yml` | ELK 栈（Elasticsearch + Logstash + Kibana） |
| `monitoring/loki/docker-compose.yml` | Loki 独立配置 |
| `monitoring/tempo/docker-compose.yml` | Tempo 独立配置 |
| `monitoring/opentelemetry/docker-compose.yml` | OTel Collector 独立配置 |

---

## 四、Nginx 配置

### 配置文件

| 文件 | 用途 |
|------|------|
| `nginx/nginx.conf` | **主配置文件**，定义 upstream、HTTP server、HTTPS server（已注释，生产用） |
| `nginx/conf.d/default.conf` | 本地开发附加配置，支持 Vite HMR、WebSocket、Tailwind Viewer |

### 关键信息
- **HTTP**：已配置，监听 80，代理 `/` → Landing，`/api` → API
- **HTTPS**：配置已预留（`nginx/nginx.conf` 第 76-103 行），需：
  1. 将证书放入 `nginx/ssl/fullchain.pem` 和 `nginx/ssl/privkey.pem`
  2. 取消注释 HTTPS server 块
  3. 取消第 36 行 HTTP 强制跳转 HTTPS
- **ECS 部署**：`docker-compose.prod.yml` 和 `docker-compose.demo.yml` 已挂载 `./nginx/ssl:/etc/nginx/ssl:ro`

---

## 五、环境变量与辅助文件

| 文件 | 说明 |
|------|------|
| `.env.dev` | 本地开发环境变量（Docker 容器内数据库/Redis） |
| `.env.prod` | 生产环境变量（远端数据库/Redis） |
| `.env.demo` | Demo 环境变量 |
| `.env.example` | 通用环境变量模板 |
| `.dockerignore` | 全局 Docker 构建忽略规则 |
| `apps/.dockerignore` | apps 目录构建忽略规则 |
| `apps/api/deploy/.dockerignore` | API 部署构建忽略规则 |
| `apps/landing/.dockerignore` | Landing 构建忽略规则 |
| `docker/install-docker-on-linux-vm.md` | Linux VM 安装 Docker 指南 |

---

## 六、快速启动速查表

### 本地开发
```bash
# 最简开发环境（DB + Redis + API + Landing）
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d

# 含 Java 微服务
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile java up -d

# 含 Nginx 反向代理
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile with-nginx up -d

# 含监控栈
docker compose -f docker-compose.dev.yml --env-file .env.dev --profile monitoring up -d
```

### 生产部署（阿里云 ECS）
```bash
# 基础生产栈（Nginx + API + Landing）
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 含 Java 微服务
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile java up -d

# 含监控栈
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d
```

### Demo 环境
```bash
# 基础 Demo 栈
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d

# 含 Java 微服务
docker compose -f docker-compose.demo.yml --env-file .env.demo --profile java up -d

# 含监控栈
docker compose -f docker-compose.demo.yml --env-file .env.demo --profile monitoring up -d
```

### 监控栈（独立部署）
```bash
cd monitoring
docker compose up -d

# 访问地址
# Grafana:    http://localhost:3003
# Prometheus: http://localhost:9090
# Tempo:      http://localhost:3200
# Loki:       http://localhost:3100
```

---

## 七、服务端口总览

| 服务 | 端口 | 所在 Compose |
|------|------|-------------|
| Nginx HTTP | 80 | dev (profile), prod, demo |
| Nginx HTTPS | 443 | prod, demo |
| API | 3001 | dev, prod, demo |
| Landing | 80 / 3000 | dev, prod, demo |
| PostgreSQL | 5433 | dev |
| Redis | 6379 | dev |
| Prometheus | 9090 | dev (profile), prod (profile), demo (profile), monitoring |
| Grafana | 3002 / 3003 | dev (profile), prod (profile), demo (profile): 3002；monitoring: 3003 |
| Tempo | 3200 | dev (profile), prod (profile), demo (profile), monitoring |
| Loki | 3100 | dev (profile), prod (profile), demo (profile), monitoring |
| OTel Collector gRPC | 4317 / 4327 | dev (profile), prod (profile), demo (profile): 4317；monitoring: 4327 |
| OTel Collector HTTP | 4318 / 4328 | dev (profile), prod (profile), demo (profile): 4318；monitoring: 4328 |
| Nacos | 8848 / 9848 | dev (profile), prod (profile), demo (profile) |
| RabbitMQ | 5672 / 15672 | dev (profile), prod (profile), demo (profile) |
| MinIO | 9000 / 9001 | monitoring |
| Node Exporter | 9100 | monitoring |
| Java Gateway | 8080 | dev (profile), prod (profile), demo (profile) |
| Java Auth | 8081 | dev (profile), prod (profile), demo (profile) |
| Java Payment | 8083 | dev (profile) |
| Java Order | 8084 | dev (profile) |
| Java Cart | 8085 | dev (profile) |
| Java Logistics | 8086 | dev (profile) |

---

> **提示**：如需启用 HTTPS，参考 `nginx/nginx.conf` 中已注释的 HTTPS server 配置，将证书放入 `nginx/ssl/` 目录即可。
