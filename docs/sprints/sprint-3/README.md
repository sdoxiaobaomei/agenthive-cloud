# Sprint 3: 云原生基础设施

**日期**: 2026-03-31 ~ 2026-04-14 (2周)  
**目标**: 建立云原生基础架构，实现3个核心Agent  
**Sprint目标**: 让Agent在K8s上跑起来，并通过Web UI可见

---

## 📋 Sprint Backlog

### P0 - 必须完成

| ID | Story | 故事点 | 负责人 | 验收标准 |
|----|-------|--------|--------|---------|
| S3-001 | Supervisor服务开发 | 5 | Backend Dev | Supervisor可调度Agent，提供REST API和WebSocket |
| S3-002 | Agent Runtime框架 | 5 | Backend Dev | Agent可作为K8s Pod运行，支持状态上报 |
| S3-003 | Web UI改造(对话+Agent面板) | 8 | Frontend Dev | 整合现有对话功能，新增Agent可视化面板 |
| S3-004 | K8s部署与Helm Chart | 5 | DevOps | 一键部署到K8s，包含所有依赖服务 |
| S3-005 | Agent角色配置系统 | 3 | Backend Dev | 通过YAML配置Agent角色和能力 |

**总计**: 26故事点

---

## 🎯 详细任务分解

### S3-001: Supervisor服务开发 (Backend Dev)

#### 任务
- [ ] 设计Supervisor API接口 (4h)
  - GET /api/v1/agents - 列出所有Agent
  - GET /api/v1/agents/:id - 获取Agent详情
  - POST /api/v1/agents - 创建Agent
  - DELETE /api/v1/agents/:id - 删除Agent
  - POST /api/v1/agents/:id/command - 发送指令
  - WS /ws - WebSocket实时状态流

- [ ] 实现Agent状态机 (6h)
  - 状态: idle, starting, working, error, completed
  - 状态转换逻辑
  - 状态持久化到Redis

- [ ] 实现任务调度器 (6h)
  - 任务队列设计
  - 任务分配给Agent
  - 任务状态跟踪

- [ ] 实现WebSocket Hub (4h)
  - 客户端连接管理
  - 事件广播机制
  - 心跳检测

- [ ] 集成测试 (4h)

**依赖**: Redis, PostgreSQL
**输出**: `apps/supervisor/`

---

### S3-002: Agent Runtime框架 (Backend Dev)

#### 任务
- [ ] 设计Agent运行时架构 (4h)
  - 生命周期管理
  - 与Supervisor通信
  - 任务执行框架

- [ ] 实现Agent客户端 (6h)
  - 注册到Supervisor
  - 心跳上报
  - 状态上报
  - 接收指令

- [ ] 实现任务执行器 (6h)
  - Git操作
  - 代码编辑
  - 命令执行
  - 结果上报

- [ ] LLM客户端集成 (4h)
  - Ollama/OpenAI调用
  - 流式响应处理
  - 提示词管理

- [ ] Dockerfile和容器化 (4h)
  - 多阶段构建
  - 工具链集成 (Go, Python, Node)
  - 镜像优化

**输出**: `apps/agent-runtime/`

---

### S3-003: Web UI改造 (Frontend Dev)

#### 任务
- [ ] 迁移现有对话功能 (6h)
  - 从旧项目迁移ChatView
  - 适配新API
  - 状态管理调整

- [ ] 设计Agent面板 (6h)
  - Agent卡片组件
  - 状态指示器 (idle/working/error)
  - 实时活动显示
  - 点击查看详情

- [ ] 实现实时通信 (6h)
  - WebSocket连接管理
  - 状态更新处理
  - 重连机制

- [ ] 代码编辑器集成 (4h)
  - Monaco Editor
  - 实时代码展示
  - 语法高亮

- [ ] Terminal日志流 (4h)
  - xterm.js集成
  - 实时日志输出
  - 历史记录

- [ ] 响应式布局 (2h)
  - 侧边栏Agent列表
  - 主区域对话+详情

**输出**: `apps/web/src/`

---

### S3-004: K8s部署与Helm Chart (DevOps)

#### 任务
- [ ] 创建Kind本地集群配置 (4h)
  - 多节点配置
  - 资源限制
  - 本地存储

- [ ] 编写Helm Chart (8h)
  - Chart.yaml
  - values.yaml (dev/prod)
  - templates/
    - deployment.yaml
    - service.yaml
    - ingress.yaml
    - configmap.yaml
    - secret.yaml
    - hpa.yaml

- [ ] 编写Skaffold配置 (4h)
  - 热重载开发
  - 文件同步
  - 端口转发

- [ ] Makefile脚本 (4h)
  - cluster-up/down
  - infra-up/down
  - dev-up/down
  - deploy

**输出**: `deploy/`, `Makefile`

---

### S3-005: Agent角色配置系统 (Backend Dev)

#### 任务
- [ ] 设计角色配置Schema (2h)
  - YAML结构定义
  - 验证规则

- [ ] 实现配置加载器 (4h)
  - 文件读取
  - 解析验证
  - 热重载支持

- [ ] 创建Director角色配置 (2h)
  - 职责定义
  - 能力列表
  - 提示词模板

- [ ] 创建Backend Dev角色配置 (2h)
  - 技术栈
  - 工作流步骤
  - 协作规则

- [ ] 创建Frontend Dev角色配置 (2h)

**输出**: `agents/roles/`

---

## 📅 Sprint日程

| 日期 | 事件 | 参与人 |
|------|------|--------|
| 03-31 | Sprint Planning | 全体 |
| 04-02 | 站会 | 全体 |
| 04-04 | 站会 + 中期检查 | 全体 |
| 04-07 | 站会 | 全体 |
| 04-09 | 站会 | 全体 |
| 04-11 | 站会 | 全体 |
| 04-13 | Sprint Review | 全体 |
| 04-14 | Retrospective | 全体 |

---

## ✅ 完成标准 (Definition of Done)

- [ ] 所有P0任务完成并通过测试
- [ ] 可以在本地K8s启动完整系统
- [ ] Web UI可以看到3个Agent状态
- [ ] 可以通过UI发送指令给Agent
- [ ] 代码Review通过
- [ ] 文档更新

---

## 🚧 风险与依赖

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| K8s学习曲线 | 中 | 中 | 提前准备Kind环境，准备教程 |
| WebSocket稳定性 | 中 | 高 | 做好重连机制，充分测试 |
| 前端改造复杂 | 低 | 中 | 复用现有代码，渐进式改造 |

---

## 📊 进度跟踪

| 任务 | 计划 | 实际 | 状态 |
|------|------|------|------|
| S3-001 | 03-31~04-04 | - | 🚧 |
| S3-002 | 04-01~04-05 | - | 📋 |
| S3-003 | 04-01~04-07 | - | 📋 |
| S3-004 | 04-02~04-06 | - | 📋 |
| S3-005 | 04-05~04-08 | - | 📋 |

---

## 📝 会议记录

### Sprint Planning (2026-03-31)

**出席**: PM, SM, Tech Lead, Backend Dev, Frontend Dev, DevOps

**决策**:
- 使用Kind作为本地K8s集群
- Web UI基于现有对话页面改造
- Agent Runtime使用Go编写
- 先实现3个Agent: Director, Backend Dev, Frontend Dev

**任务认领**:
- Backend Dev: S3-001, S3-002, S3-005
- Frontend Dev: S3-003
- DevOps: S3-004

---

**Sprint 3 Ready!** 🚀
