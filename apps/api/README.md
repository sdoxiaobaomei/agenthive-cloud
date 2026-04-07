# AgentHive Cloud API

> AgentHive Cloud 后端 API 服务 - Express + TypeScript + PostgreSQL + Redis

---

## 📁 目录结构

```
api/
├── src/                    # 源代码
│   ├── config/            # 配置 (数据库、Redis、CORS)
│   ├── controllers/       # 控制器 (auth, agents, tasks, code)
│   ├── db/               # 数据库层
│   ├── middleware/       # 中间件 (auth, visitor)
│   ├── routes/           # 路由定义
│   ├── services/         # 服务层 (sms, llm, redis-cache)
│   ├── types/            # TypeScript 类型
│   ├── utils/            # 工具函数
│   └── websocket/        # WebSocket 处理
├── scripts/              # 数据库脚本
├── tests/               # 测试
│   ├── unit/           # 单元测试
│   ├── integration/    # 集成测试
│   └── scripts/        # 测试脚本
├── deploy/              # Docker 部署配置
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   └── ...
└── docs/               # 文档
    ├── API_REFERENCE.md # API 文档
    ├── TODO.md          # 待办事项
    ├── database/        # 数据库文档
    └── guides/          # 使用指南
```

---

## 🚀 快速开始

### 1. 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 配置数据库连接
```

### 4. 初始化数据库

```bash
npm run db:init
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

---

## 📚 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| **文档首页** | [docs/README.md](./docs/README.md) | 文档导航入口 |
| **API 文档** | [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | 完整 API 接口文档 |
| **数据库指南** | [docs/database/README.md](./docs/database/README.md) | 数据库设计和使用 |
| **PostgreSQL 设置** | [docs/database/POSTGRESQL_SETUP.md](./docs/database/POSTGRESQL_SETUP.md) | PostgreSQL 安装配置 |
| **Redis WebSocket** | [docs/database/REDIS_WEBSOCKET.md](./docs/database/REDIS_WEBSOCKET.md) | Redis 和 WebSocket 配置 |
| **启动指南** | [docs/guides/STARTUP_GUIDE.md](./docs/guides/STARTUP_GUIDE.md) | 详细启动步骤 |
| **环境设置** | [docs/guides/SETUP_SUMMARY.md](./docs/guides/SETUP_SUMMARY.md) | 环境配置总结 |
| **TODO** | [docs/TODO.md](./docs/TODO.md) | 待办事项 |

---

## 🧪 测试

```bash
# 运行单元测试
npm run test

# 运行测试（带覆盖）
npm run test:coverage

# 运行特定测试脚本
cd tests/scripts
node test-db.mjs
```

---

## 🐳 Docker 部署

```bash
# 构建镜像
docker build -f deploy/Dockerfile -t agenthive-api .

# 运行容器
docker run -p 3001:3001 agenthive-api
```

---

## 📌 主要功能

- ✅ 用户认证 (JWT + 短信验证码)
- ✅ Agent 管理 (CRUD + 状态控制)
- ✅ 任务系统 (创建、分配、执行)
- ✅ 代码文件操作
- ✅ WebSocket 实时通信
- ✅ PostgreSQL 数据持久化
- ✅ Redis 缓存

---

## 🔧 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Express.js |
| 语言 | TypeScript |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 测试 | Vitest |
| 构建 | tsc |

---

*最后更新: 2026-04-08*
