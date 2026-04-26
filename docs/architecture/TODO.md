# AgentHive Cloud — 开发任务清单 (TODO)

> **版本**: v1.0 | **日期**: 2026-04-25 | **状态**: 执行中
> **生成来源**: `node-java-boundary-refactor.md` + `development-roadmap.md`

---

## 优先级说明

| 优先级 | 含义 | 处理原则 |
|--------|------|----------|
| **P0** | 阻塞级 | 不完成则系统无法运行或存在严重安全/稳定性风险，必须立即处理 |
| **P1** | 高优先级 | 核心功能和基础架构，必须在第一个里程碑前完成 |
| **P2** | 中优先级 | 重要功能完善，可在第二个里程碑后逐步推进 |
| **P3** | 低优先级 | 优化和增强功能，视资源和反馈择机实现 |

---

## P0 — 阻塞级（立即处理）

### P0-001: 统一认证层 — 移除 Node API 本地 JWT 验证
- **模块**: 基础设施
- **运行时**: Node.js + Java
- **问题**: 双重认证风险，Node API 和 Gateway 各有一套 JWT 验证逻辑
- **改动**:
  1. 删除 `apps/api/src/middleware/auth.ts` 中的 `resolveLocalToken` 函数
  2. Node API 只透传 `X-User-Id` / `X-User-Name` / `X-User-Role` headers
  3. 开发环境增加 `NODE_ENV=development` 模拟用户头开关
  4. Gateway 白名单补充 `/api/health`、`/api/demo/**`
- **验收标准**:
  - [x] 生产环境 Node API 拒绝无 `X-User-Id` 的请求，返回 401 ✅ 2026-04-26
  - [x] 开发环境可通过配置模拟用户身份 ✅ `injectDevUser()` + `DEV_USER_*` env
  - [x] 删除所有与本地 JWT verify 相关的代码和依赖 ✅ jwt.ts 已删除，jose 已移除
- **依赖**: 无
- **负责人**: Node 团队
- **工时**: 2-3 天

### P0-002: 修复 Java 父 POM 模块注册
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **问题**: `apps/java/pom.xml` 只注册了 gateway/auth/user 3 个模块，payment/order/cart/logistics 目录存在但未激活
- **改动**:
  1. 在 `pom.xml` `<modules>` 中注册 `payment-service`、`order-service`、`cart-service`、`logistics-service`
  2. 为每个缺失服务创建最小可编译骨架（Application 类 + application.yml + pom.xml）
  3. 验证 `mvn clean install` 成功构建所有 7 个服务
- **验收标准**:
  - [x] `mvn clean install -pl '!gateway-service'` 跳过网关也能编译 ✅ 2026-04-26（9/9 SUCCESS）
  - [ ] 所有服务均能通过 `spring-boot:run` 启动（待运行时验证）
  - [ ] Nacos 控制台能看到所有服务注册（待运行时验证）
- **依赖**: 无
- **负责人**: Java 团队
- **工时**: 2-3 天

### P0-003: Node API 任务执行解耦 — 禁止直接 spawn Orchestrator
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **问题**: `chatService.executeAgentTask()` 直接 `spawn('npx tsx orchestrator.ts')`，任务崩溃拖垮 API
- **改动**:
  1. 引入 Redis Stream 作为任务队列 (`agent:task:queue`)
  2. Node API `executeTask` 改为 `XADD` 提交任务，立即返回任务 ID
  3. 新增 `apps/agent-runtime/src/services/TaskConsumer.ts`，使用 `XREADGROUP` 消费队列
  4. Agent Runtime 执行完成后通过 Redis Pub/Sub 推送进度
  5. Node API WebSocket 订阅进度频道，实时推送给前端
- **验收标准**:
  - [x] 任务提交后 API 立即返回，不等待执行完成 ✅ `enqueueTask` 异步提交已实现
  - [x] Agent Runtime 独立进程消费队列并执行任务 ✅ `TaskConsumer` + `pnpm consumer` 已实现
  - [ ] 任务崩溃不影响 API 服务（可通过 `kill -9` 模拟测试，待运行时验证）
  - [x] WebSocket 能正常接收任务进度更新 ✅ `task:subscribe` + Pub/Sub 已对接
- **依赖**: Redis Stream 配置
- **负责人**: Node 团队 + Agent 团队
- **工时**: 5-7 天

---

## P1 — 高优先级（第一个里程碑：6 周内完成）

### P1-001: 拆分 code-service（独立 Node 服务）
- **模块**: 开发者工作台
- **运行时**: Node.js
- **说明**: 将代码文件操作从 Node API 中拆出，避免文件 IO 阻塞事件循环
- **改动**:
  1. 新建 `apps/code-service` 目录，Express + TypeScript 骨架
  2. 迁移 `/api/code/files*` 和 `/api/code/workspace/*` 所有接口
  3. Node API 保留 `/api/projects/*` 项目元数据接口
  4. Node API 通过 HTTP 调用 code-service（内部网络，不经过 Gateway）
  5. code-service 独立 Dockerfile 和 K8s 部署配置
- **API 清单**:
  - `GET|POST|PUT|DELETE /v1/workspaces/:projectId/files`
  - `GET|POST /v1/workspaces/:projectId/files/content`
  - `POST /v1/workspaces/:projectId/files/rename`
  - `POST /v1/workspaces/:projectId/files/move`
  - `GET /v1/workspaces/:projectId/search`
  - `GET /v1/workspaces/:projectId/recent`
- **验收标准**:
  - [ ] code-service 可独立启动、独立部署
  - [ ] 文件操作 API 响应时间 < 100ms（本地磁盘）
  - [ ] 大文件（> 10MB）读写不影响 API 服务响应
  - [ ] 路径安全检查（防止目录遍历）100% 覆盖
- **依赖**: P0-001（认证统一后内部调用也需要鉴权）
- **负责人**: Node 团队
- **工时**: 5-7 天

### P1-002: 完成 user-service（Java）
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 补充 user-service 缺失的 Controller/Service/Mapper
- **API 清单**:
  - `GET /users/:id` — 获取用户详情
  - `PUT /users/:id` — 更新用户
  - `GET /users/:id/permissions` — 获取用户权限
  - `POST /users/:id/avatar` — 上传头像
  - `GET /users/:id/activities` — 获取活动记录
  - `DELETE /users/:id` — 注销账号（软删除）
- **数据表**: `sys_user`（已存在，需扩展字段）
- **验收标准**:
  - [ ] 6 个 API 全部实现并通过单元测试
  - [ ] 头像上传支持 MinIO/OSS
  - [ ] 软删除后数据保留 30 天，支持恢复
  - [ ] OpenFeign 客户端可被其他服务调用
- **依赖**: P0-002
- **负责人**: Java 团队
- **工时**: 5-7 天

### P1-003: auth-service 完善 — 短信登录 + OAuth2
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 当前 auth-service 只有用户名密码登录，需补充短信验证码和 OAuth2
- **改动**:
  1. 集成阿里云短信服务，实现 `POST /auth/login/sms`
  2. 集成 Spring Security OAuth2 Client，支持 GitHub/Google 登录
  3. 短信验证码 Redis 存储，5 分钟过期
  4. OAuth2 登录后自动创建本地用户绑定
- **API 清单**:
  - `POST /auth/login/sms` — 短信验证码登录
  - `GET /auth/oauth2/authorization/github` — GitHub OAuth2 授权
  - `GET /auth/oauth2/authorization/google` — Google OAuth2 授权
  - `GET /auth/oauth2/callback` — OAuth2 回调处理
- **验收标准**:
  - [ ] 短信验证码发送成功，5 分钟内有效
  - [ ] GitHub OAuth2 登录可获取用户信息并创建本地账号
  - [ ] 同一手机号/邮箱不可重复注册
  - [ ] Token 刷新机制正常（refresh_token 7 天有效）
- **依赖**: P0-002
- **负责人**: Java 团队
- **工时**: 7-10 天

### P1-004: Agent 管理 API 完善
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: 补充当前缺失的 Agent API，实现完整的生命周期管理
- **API 清单**:
  - `GET /api/v1/agents` — 列表（分页、筛选、搜索）
  - `POST /api/v1/agents` — 创建
  - `GET /api/v1/agents/:id` — 详情
  - `PATCH /api/v1/agents/:id` — 更新配置
  - `DELETE /api/v1/agents/:id` — 删除
  - `POST /api/v1/agents/:id/start` — 启动
  - `POST /api/v1/agents/:id/stop` — 停止
  - `POST /api/v1/agents/:id/pause` — 暂停
  - `POST /api/v1/agents/:id/resume` — 恢复
  - `POST /api/v1/agents/:id/restart` — 重启
  - `POST /api/v1/agents/:id/command` — 发送命令
  - `GET /api/v1/agents/:id/status` — 实时状态
  - `GET /api/v1/agents/:id/logs` — 运行日志
  - `POST /api/v1/agents/:id/clone` — 克隆
- **数据表**: `agents`（需创建）
- **验收标准**:
  - [ ] 14 个 API 全部实现并通过测试
  - [ ] Agent 状态流转正确：idle → working → paused → idle
  - [ ] 命令发送后可在日志中查看执行结果
  - [ ] 克隆 Agent 时配置深拷贝，不共享 workspace
- **依赖**: P0-001
- **负责人**: Node 团队
- **工时**: 7-10 天

### P1-005: Chat 会话 API 完善
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: 实现完整的 Chat 会话管理，包括消息发送、意图识别、Agent 任务触发
- **API 清单**:
  - `POST /api/v1/chat/sessions` — 创建会话
  - `GET /api/v1/chat/sessions` — 列表
  - `GET /api/v1/chat/sessions/:id` — 详情
  - `PATCH /api/v1/chat/sessions/:id` — 重命名
  - `DELETE /api/v1/chat/sessions/:id` — 删除
  - `POST /api/v1/chat/sessions/:id/messages` — 发送消息
  - `GET /api/v1/chat/sessions/:id/messages` — 消息历史
  - `POST /api/v1/chat/sessions/:id/execute` — 执行 Agent 任务
  - `GET /api/v1/chat/sessions/:id/tasks` — 关联任务
  - `GET /api/v1/chat/sessions/:id/progress` — 整体进度
- **数据表**: `chat_sessions`、`chat_messages`
- **验收标准**:
  - [ ] 发送消息后意图识别准确率 > 80%
  - [ ] 可执行意图（create_project/modify_code 等）自动创建 Agent 任务
  - [ ] 消息历史支持分页，默认每页 50 条
  - [ ] 会话支持归档（软删除）
- **依赖**: P0-003（任务执行解耦）、P1-004（Agent 管理）
- **负责人**: Node 团队 + AI 团队
- **工时**: 7-10 天

### P1-006: 项目工作区 API
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: 项目管理 API，与 code-service 配合提供完整工作区能力
- **API 清单**:
  - `GET|POST /api/v1/projects` — 列表/创建
  - `GET /api/v1/projects/:id` — 详情
  - `PATCH /api/v1/projects/:id` — 更新
  - `DELETE /api/v1/projects/:id` — 删除
  - `POST /api/v1/projects/:id/clone` — 克隆
  - `POST /api/v1/projects/:id/deploy` — 部署
  - `GET /api/v1/projects/:id/status` — 状态
  - `POST /api/v1/projects/:id/share` — 分享
  - `POST /api/v1/projects/:id/migrate-visitor` — 访客迁移
- **数据表**: `projects`
- **验收标准**:
  - [ ] 项目 CRUD 完整
  - [ ] 克隆项目时复制工作区文件（调用 code-service）
  - [ ] 访客项目可在登录后迁移到正式账号
  - [ ] 项目支持标签和搜索
- **依赖**: P1-001（code-service）
- **负责人**: Node 团队
- **工时**: 5-7 天

### P1-007: order-service 骨架与状态机
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 实现订单核心，包括状态机和基础 CRUD
- **API 清单**:
  - `POST /orders` — 创建订单
  - `GET /orders/:orderNo` — 详情
  - `GET /orders/user/:userId` — 用户订单列表
  - `PUT /orders/:orderNo/cancel` — 取消
  - `PUT /orders/:orderNo/confirm` — 确认收货
  - `GET /orders/:orderNo/items` — 订单项
  - `POST /orders/:orderNo/refund` — 申请退款
  - `GET /orders/stats` — 统计
- **状态机**: CREATED → PAID → SHIPPED → DELIVERED → COMPLETED（可取消/退款）
- **数据表**: `t_order`、`t_order_item`
- **验收标准**:
  - [ ] 订单号使用雪花算法生成，全局唯一
  - [ ] 状态流转有校验，不允许非法跳转
  - [ ] 取消订单时释放库存（调用 cart-service）
  - [ ] 创建订单后发布 `order.created` RabbitMQ 事件
- **依赖**: P0-002、P1-002
- **负责人**: Java 团队
- **工时**: 7-10 天

### P1-008: payment-service 骨架 — 支付单 + 钱包
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 实现支付核心，包括支付单创建、回调、钱包
- **API 清单**:
  - `POST /payments/create` — 创建支付单
  - `POST /payments/callback` — 支付回调（幂等）
  - `POST /payments/refund` — 退款
  - `GET /payments/:orderNo` — 查询状态
  - `GET /wallets/:userId` — 查询余额
  - `POST /wallets/recharge` — 充值
- **数据表**: `t_payment`、`t_user_wallet`
- **验收标准**:
  - [ ] 支付单幂等性（同一订单多次创建返回同一支付单）
  - [ ] 回调接口幂等（同一第三方单号只处理一次）
  - [ ] 钱包余额使用乐观锁（version 字段）防并发
  - [ ] 支付成功后发布 `payment.success` 事件
- **依赖**: P0-002、P1-007
- **负责人**: Java 团队
- **工时**: 7-10 天

### P1-009: cart-service 骨架
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 购物车服务，支持加购、结算预览
- **API 清单**:
  - `GET /carts/:userId` — 获取购物车
  - `POST /carts/items` — 添加商品
  - `PUT /carts/items/:id` — 更新数量
  - `DELETE /carts/items/:id` — 删除商品
  - `POST /carts/clear` — 清空
  - `POST /carts/checkout` — 结算预览
- **数据表**: `t_cart_item`
- **验收标准**:
  - [ ] 购物车数据 Redis + DB 双写，Cache-Aside 模式
  - [ ] 结算时校验商品价格和库存
  - [ ] 同一商品多次加购合并数量
  - [ ] 未登录用户支持临时购物车（Redis，7 天过期）
- **依赖**: P0-002
- **负责人**: Java 团队
- **工时**: 5-7 天

### P1-010: RabbitMQ 事件总线搭建
- **模块**: 基础设施
- **运行时**: Java
- **说明**: 配置 RabbitMQ，实现订单→支付→物流的异步事件流
- **事件清单**:
  - `order.created` → payment-service 创建支付单
  - `payment.success` → order-service 更新已支付
  - `payment.success` → logistics-service 创建物流单
  - `order.paid` → logistics-service 发货通知
  - `logistics.shipped` → order-service 更新已发货
  - `logistics.delivered` → order-service 更新已送达
  - `user.registered` → user-service 初始化资料
- **验收标准**:
  - [ ] 所有事件均有生产者和消费者
  - [ ] 消费者失败时进入死信队列，支持重试
  - [ ] 事件消费有幂等性保证（唯一键防重）
  - [ ] 消息投递延迟 < 100ms
- **依赖**: P0-002
- **负责人**: Java 团队
- **工时**: 5-7 天

### P1-011: 前端 Web 控制台 — Agent 管理页面
- **模块**: 前端
- **运行时**: Vue 3
- **说明**: Web 控制台中 Agent 列表、创建、详情、控制页面
- **页面清单**:
  - Agent 列表页（表格、搜索、分页、状态筛选）
  - Agent 创建/编辑页（表单、配置 JSON 编辑器）
  - Agent 详情页（状态、日志、命令发送）
  - Agent 实时监控卡片（WebSocket 状态）
- **验收标准**:
  - [ ] 页面适配桌面端，响应式支持平板
  - [ ] Agent 状态变化实时更新（WebSocket）
  - [ ] 日志支持实时滚动和关键字搜索
  - [ ] 命令发送后有执行反馈
- **依赖**: P1-004
- **负责人**: 前端团队
- **工时**: 7-10 天

### P1-012: 前端 Web 控制台 — Chat 会话页面
- **模块**: 前端
- **运行时**: Vue 3
- **说明**: Chat 界面，类似 Claude Code / Cursor 的交互体验
- **页面清单**:
  - 会话列表侧边栏
  - 消息气泡聊天区（用户/助手/系统）
  - 消息输入框（支持 Markdown）
  - 任务进度面板（显示 Agent 执行状态）
  - 代码块高亮 + 复制按钮
- **验收标准**:
  - [ ] 消息发送后流式显示 LLM 回复（SSE）
  - [ ] Agent 任务进度可视化（进度条、步骤列表）
  - [ ] 代码块支持语法高亮和一键复制
  - [ ] 会话列表支持搜索和归档
- **依赖**: P1-005
- **负责人**: 前端团队
- **工时**: 7-10 天

---

## P2 — 中优先级（第二个里程碑：12 周内完成）

### P2-001: LLM Gateway 独立服务
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: 统一 LLM 多厂商入口，支持 Ollama/OpenAI/通义/Claude
- **API 清单**:
  - `POST /v1/chat/completions` — OpenAI 兼容接口
  - `POST /v1/embeddings` — 文本嵌入
  - `GET /v1/models` — 列出可用模型
  - `GET /v1/usage` — Token 使用统计
  - `POST /v1/admin/quota` — 设置用户配额
- **验收标准**:
  - [ ] 支持至少 3 个 LLM 提供商无缝切换
  - [ ] 流式响应正常转发给前端
  - [ ] 单用户 Token 用量可统计和限制
  - [ ] Provider 故障时自动熔断并切换到备用
- **依赖**: P1-004、P1-005
- **负责人**: Node 团队
- **工时**: 7-10 天

### P2-002: logistics-service 骨架
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: 物流服务，支持运单创建和状态追踪
- **API 清单**:
  - `POST /logistics/create` — 创建物流单
  - `GET /logistics/:orderNo` — 查询物流
  - `GET /logistics/:trackingNo/tracks` — 获取轨迹
  - `PUT /logistics/:trackingNo/ship` — 发货
  - `PUT /logistics/:trackingNo/deliver` — 签收
- **数据表**: `t_logistics`、`t_logistics_track`
- **验收标准**:
  - [ ] 物流单创建后推送 `logistics.shipped` 事件
  - [ ] 支持顺丰、圆通、中通等主流快递查询
  - [ ] 物流轨迹时间线展示
- **依赖**: P1-007、P1-010
- **负责人**: Java 团队
- **工时**: 5-7 天

### P2-003: 订阅计费系统
- **模块**: 电商 SaaS 核心
- **运行时**: Java
- **说明**: SaaS 订阅套餐、按量计费、优惠券
- **API 清单**:
  - `GET /plans` — 套餐列表
  - `GET /plans/:id` — 套餐详情
  - `POST /subscriptions` — 创建订阅
  - `GET /subscriptions/:id` — 订阅详情
  - `PATCH /subscriptions/:id` — 升级/降级
  - `DELETE /subscriptions/:id` — 取消订阅
  - `GET /billing/history` — 账单历史
  - `GET /billing/usage` — 用量统计
  - `POST /billing/coupons/:code/apply` — 应用优惠券
  - `POST /billing/invoices/:id/request` — 申请发票
- **验收标准**:
  - [ ] 支持免费版/专业版/企业版三档套餐
  - [ ] 套餐升级按比例折算，降级下月生效
  - [ ] 优惠券支持满减和折扣两种类型
  - [ ] 用量超标时限制功能并提示升级
- **依赖**: P1-008
- **负责人**: Java 团队
- **工时**: 7-10 天

### P2-004: Node API 转型 BFF — 调用 Java 微服务
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: Node API 不再直接查用户/订单表，通过 HTTP 调用 Java 服务
- **改动**:
  1. 封装 `JavaServiceClient` 类，统一处理 HTTP 调用、错误处理、重试
  2. Agent/Project 接口中关联用户信息时调用 `user-service`
  3. 需要订单数据时调用 `order-service`
  4. 增加缓存层（Redis），热点数据缓存 5 分钟
- **验收标准**:
  - [ ] Node API 不再直接访问 `sys_user`、`t_order` 等 Java 服务表
  - [ ] Java 服务调用失败时有降级策略（返回缓存数据或友好错误）
  - [ ] 调用链路有 OpenTelemetry Trace 串联
- **依赖**: P1-002、P1-007
- **负责人**: Node 团队
- **工时**: 5-7 天

### P2-005: code-service 完善 — Git + 终端 + 预览
- **模块**: 开发者工作台
- **运行时**: Node.js
- **说明**: 在文件操作基础上，增加 Git、终端、预览部署能力
- **API 清单**:
  - Git: init, status, add, commit, push, pull, branches, branch, checkout, merge
  - 终端: `POST /terminal/session`，WebSocket 连接
  - 预览: `POST /preview`，`GET /preview/status`，`DELETE /preview`
  - 部署: `POST /deploy`，`GET /deploy/status`，`GET /deploy/logs`
- **验收标准**:
  - [ ] Git 操作支持用户名密码和 SSH Key 两种认证
  - [ ] 终端支持多会话，WebSocket 实时输出
  - [ ] 预览服务基于 Vite，支持 React/Vue 项目
  - [ ] 部署生成 Docker 镜像并推送到仓库
- **依赖**: P1-001
- **负责人**: Node 团队
- **工时**: 10-14 天

### P2-006: 可观测性 — OpenTelemetry 全链路追踪
- **模块**: 可观测性与运维
- **运行时**: Node.js + Java
- **说明**: 所有服务接入 OTel SDK，实现全链路追踪
- **改动**:
  1. Node.js 服务：引入 `@opentelemetry/sdk-node`，自动注入 HTTP/PostgreSQL/Redis 追踪
  2. Java 服务：引入 `common-otel` 模块，Spring Boot Actuator Micrometer + OTel Bridge
  3. 自定义 Span：Agent 任务、LLM 调用、QueryLoop 执行
  4. TraceId 在 Gateway → BFF → Java 服务间透传
- **验收标准**:
  - [ ] 单次用户请求可查看完整调用链（Gateway → Node API → Java Service → DB）
  - [ ] LLM 调用 Span 包含 model、tokens、cost_usd 属性
  - [ ] Agent 任务 Span 包含 agent.id、task.id、task.type 属性
  - [ ] Trace 数据可查询 7 天，采样率 10%
- **依赖**: 无
- **负责人**: DevOps 团队 + 全团队
- **工时**: 7-10 天

### P2-007: 前端 — Monaco 编辑器集成
- **模块**: 前端
- **运行时**: Vue 3
- **说明**: 在 Web 控制台中集成 Monaco Editor，提供 IDE 级编辑体验
- **功能清单**:
  - 文件树侧边栏（增删改查、拖拽排序）
  - Monaco 编辑器（语法高亮、智能提示、错误诊断）
  - 多标签页支持
  - 文件搜索（全文搜索、正则、文件过滤）
  - 代码对比（diff 视图）
- **验收标准**:
  - [ ] 支持 20+ 种编程语言高亮
  - [ ] TypeScript/JavaScript 有基础智能提示
  - [ ] 文件修改后有未保存标记
  - [ ] 文件搜索响应 < 500ms（工作区 < 1000 文件）
- **依赖**: P1-001
- **负责人**: 前端团队
- **工时**: 7-10 天

---

## P3 — 低优先级（视资源择机实现）

### P3-001: Agent Runtime K8s Job 化
- **模块**: AI Agent 平台
- **运行时**: Kubernetes
- **说明**: Agent 任务从常驻进程改为 K8s Job，每个任务独立 Pod
- **验收标准**:
  - [ ] 每个 Agent 任务启动独立 K8s Job
  - [ ] 支持配置 CPU/内存资源配额
  - [ ] 任务完成后 Pod 自动清理
  - [ ] 失败任务支持重试（最多 3 次）
- **依赖**: P0-003、P2-006
- **负责人**: DevOps 团队
- **工时**: 10-14 天

### P3-002: 多租户隔离
- **模块**: 基础设施
- **运行时**: Java + PostgreSQL
- **说明**: 支持 SaaS 多租户，数据行级隔离
- **改动**:
  1. 所有业务表增加 `tenant_id` 字段
  2. PostgreSQL RLS（Row Level Security）自动过滤
  3. 租户资源配额（CPU、内存、Agent 并发数）
  4. 管理员可切换租户视角
- **验收标准**:
  - [ ] 租户 A 无法访问租户 B 的数据
  - [ ] 超标租户触发限制并通知管理员
  - [ ] 支持租户级自定义域名和 Logo
- **依赖**: P2-003
- **负责人**: Java 团队
- **工时**: 10-14 天

### P3-003: 告警系统
- **模块**: 可观测性与运维
- **运行时**: Grafana + Alertmanager
- **说明**: 基于指标阈值的自动告警
- **告警规则**:
  - API P99 延迟 > 500ms，持续 5 分钟
  - 错误率 > 1%，持续 2 分钟
  - JVM 堆内存使用 > 80%
  - Agent 任务失败率 > 20%
  - 数据库连接池使用率 > 90%
- **通知渠道**: 钉钉、邮件、短信
- **依赖**: P2-006
- **负责人**: DevOps 团队
- **工时**: 5-7 天

### P3-004: 性能压测与优化
- **模块**: 全平台
- **说明**: 使用 k6 / JMeter 进行性能压测，找出瓶颈并优化
- **压测场景**:
  - Chat 发送消息并发 100 用户
  - Agent 任务并发创建 50 个
  - 电商下单 QPS 1000
  - 代码文件并发读写 200 用户
- **验收标准**:
  - [ ] API P99 延迟 < 200ms
  - [ ] 电商下单 QPS > 1000
  - [ ] 系统可用性 99.9%（7x24 运行）
  - [ ] 压测报告含瓶颈分析和优化建议
- **依赖**: 所有 P1/P2 完成
- **负责人**: QA 团队 + 全团队
- **工时**: 7-10 天

### P3-005: Node BFF 按前端拆分
- **模块**: 基础设施
- **运行时**: Node.js
- **说明**: 按前端类型拆分 BFF 服务
- **拆分方案**:
  - `web-bff` — Web 控制台（完整功能、大数据量）
  - `landing-bff` — 营销官网（SEO、页面聚合、缓存）
  - `open-bff` — 第三方开发者（OpenAPI、严格限流）
- **依赖**: 所有 P1/P2 完成
- **负责人**: Node 团队
- **工时**: 7-10 天

### P3-006: 代码审查与测试生成（AI 能力增强）
- **模块**: AI Agent 平台
- **运行时**: Node.js
- **说明**: Agent 自动执行代码审查和测试生成
- **功能**:
  - 代码审查：检查代码质量、安全漏洞、性能问题
  - 测试生成：根据代码自动生成单元测试
  - 文档生成：自动生成 API 文档和 README
- **依赖**: P1-004
- **负责人**: AI 团队
- **工时**: 10-14 天

---

## 任务统计

| 优先级 | 任务数 | 预估总工时 |
|--------|--------|-----------|
| P0 | 3 | 12-17 天 |
| P1 | 12 | 70-95 天 |
| P2 | 7 | 44-63 天 |
| P3 | 6 | 46-63 天 |
| **合计** | **28** | **172-238 天** |

按 10 人团队并行开发，P0+P1 约 **3-4 周**完成第一个里程碑，P0+P1+P2 约 **8-10 周**完成第二个里程碑，全部完成约 **14-18 周**。

---

## 执行检查清单

### 每日检查
- [ ] P0 任务是否有阻塞
- [ ] 代码是否已提交并推送
- [ ] 单元测试是否通过

### 每周检查
- [ ] P1 任务进度是否符合计划
- [ ] 跨团队依赖是否已对齐
- [ ] 技术债务是否有新增

### 里程碑检查
- [ ] 所有 P0 任务已完成
- [ ] 所有 P1 任务已完成并通过集成测试
- [ ] 性能基线是否达标
- [ ] 安全扫描是否通过

---

> 本文档由架构师于 2026-04-25 生成，根据 
ode-java-boundary-refactor.md 和 development-roadmap.md 综合整理。
> 执行过程中如遇阻塞，请立即升级至 P0 级别处理。
