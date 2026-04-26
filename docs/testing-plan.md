# AgentHive Cloud - 测试计划

## 1. 测试范围

### 1.1 Node.js 服务测试

| 模块 | 测试类型 | 覆盖内容 |
|------|----------|----------|
| API Core | 单元测试 | 所有 Controller、Service、Middleware |
| Chat Controller | E2E 测试 | 会话创建、消息发送、Agent 调度 |
| Auth | 集成测试 | 注册、登录、JWT、权限 |
| Agent Runtime | E2E 测试 | WebSocket 连接、任务执行、LLM 调用 |
| Database | 迁移测试 | 所有表创建、索引、外键 |

### 1.2 Java 微服务测试

| 服务 | 测试类型 | 覆盖内容 |
|------|----------|----------|
| Gateway | 集成测试 | 路由、鉴权、限流 |
| Auth | 单元+集成 | 注册、登录、Token、OAuth2 |
| User | 单元+集成 | CRUD、Feign 调用 |
| Payment | 单元+集成 | 支付创建、回调、退款、钱包 |
| Order | 单元+集成 | 下单、状态机、MQ 消费 |
| Cart | 单元+集成 | 加购、修改、清空、结算 |
| Logistics | 单元+集成 | 创建、发货、签收、轨迹 |

## 2. 测试环境

### 2.1 本地开发环境
```bash
# 启动所有基础设施
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
docker compose -f monitoring/docker-compose.yml up -d

# 启动 Node.js 服务
cd apps/api && npm run dev
cd apps/landing && npm run dev

# 启动 Java 服务
cd apps/java && mvn clean install -DskipTests
# 逐个启动或使用 docker-compose
```

### 2.2 LLM 测试配置
- 模型：Ollama qwen3:14b
- 端点：http://host.docker.internal:11434
- 用途：意图识别、代码生成、代码审查

## 3. 关键测试用例

### 3.1 Chat → Agent 完整流程
```
1. 用户访问 http://localhost:3000/chat
2. 登录（或访客模式）
3. 发送消息："创建一个 TODO 应用"
4. 验证：
   - Chat API 返回 200
   - 意图识别为 "create_project"
   - Orchestrator 生成 Tickets
   - Worker Agents 并行执行
   - WebSocket 推送实时进度
   - 最终返回可运行的代码
```

### 3.2 电商完整流程
```
1. 用户注册 → 获取 JWT
2. 加购商品 → Cart Service
3. 结算 → 创建订单 → Order Service
4. 支付 → Payment Service → 钱包扣款
5. 发货 → Logistics Service
6. 签收 → 订单完成
7. 验证：
   - 所有状态变更正确
   - MQ 消息投递成功
   - 数据一致性（Seata / 本地消息表）
```

### 3.3 高并发测试
```
1. 并发注册用户 (100 并发)
2. 并发加购 (500 并发)
3. 并发下单 (200 并发，库存 100)
4. 验证：
   - 无超卖
   - 无重复支付
   - 响应时间 < 500ms (P95)
```

## 4. 自动化测试脚本

```bash
# Node.js API 测试
cd apps/api && npm test

# Java 单元测试
cd apps/java && mvn test

# E2E 测试（Playwright）
cd apps/landing && npm run test:e2e

# 性能测试（k6）
k6 run tests/performance/load-test.js
```

## 5. 验收标准

| 指标 | 目标 |
|------|------|
| 单元测试覆盖率 | > 80% |
| API 成功率 | > 99.9% |
| P95 延迟 | < 500ms |
| 错误率 | < 0.1% |
| Agent 任务成功率 | > 95% |
| 支付成功率 | 100% (幂等) |
