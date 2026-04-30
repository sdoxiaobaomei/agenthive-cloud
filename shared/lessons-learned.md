# Lessons Learned

## 2026-04-30 — k8s 日志排查最佳实践
**来源**: PLATFORM-021
**Lesson**: CrashLoopBackOff Deployment 做 kubectl logs deployment/xxx 可能返回 terminating old pod 的日志。应通过 kubectl get pods --sort-by=.metadata.creationTimestamp 找到最新 pod，再 kubectl logs <pod-name>。
**Action**: 将此实践加入 k8s 运维 checklist。

## 2026-04-30 — Agent 输出验证教训
**来源**: PLATFORM-023 follow-up
**Lesson**: platform-agent 返回 confidence=0.98，但输出包含幻觉（声称修改了不存在的 k8s/base/02-postgres.yaml），且遗漏了关键的 kubectl apply 步骤。高置信度 ≠ 正确执行。必须独立验证文件系统状态和集群状态。
**Action**: Lead 审查流程增加 "文件存在性验证" 和 "集群 spec 一致性检查" 两个步骤。

## 2026-04-30 — 数据库架构审计: Polyglot Persistence 反模式
**来源**: 用户报告 sys_user vs users 不一致
**Lesson**: 微服务架构中不同技术栈（Java + Node.js）必须使用统一的数据契约，尤其是主键类型和表命名。Java 用 BIGINT + Database Per Service，Node.js 用 UUID + 共享数据库，导致 user_id 完全无法关联，系统功能割裂。
**Action**: 新系统启动时必须定义统一的 ID 生成策略（推荐 UUIDv7）和跨服务数据同步协议（API Composition / Saga）。架构审计应在开发早期执行，而非部署后。
**Reference**: docs/database-architecture-audit.md

