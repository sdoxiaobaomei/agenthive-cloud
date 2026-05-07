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


## 2026-05-06 — RabbitMQ CrashLoopBackOff + 镜像拉取雪崩 + ArgoCD 失踪三连击
**来源**: 日常同步时 ArgoCD sync 卡死，排查发现 RabbitMQ Init:CrashLoopBackOff，进而引发连锁故障
**Lesson**: 
1. **RabbitMQ Erlang Cookie 权限死锁**: PVC 保留的旧 `.erlang.cookie` 文件权限错误。initContainer 试图 `chmod 600` + `chown 1000:1000`，但 `runAsUser: 0` 与 podSecurityContext `runAsNonRoot: true` 冲突，导致 `Operation not permitted`。最简修复不是改权限，而是直接 `rm -f` 删除 cookie 文件——RabbitMQ 启动时会自动生成正确权限的新文件。initContainer 无需 root。
2. **镜像 Tag 漂移 ≠ 镜像存在**: GitHub Actions 自动将 `values.dev.yaml` 的 api tag 更新为 `v1.2.0-22-ga510e7d`，但对应镜像从未成功推送到 ACR。同时 k3d 节点的 `registries.yaml` 认证配置失效（`dockerauth.cn-hangzhou.aliyuncs.com` IPv6 不可达），任何不在节点缓存中的镜像都会 `ImagePullBackOff`。
3. **Helm env patch 陷阱**: 当 Deployment 的 env 变量从 `value` 改为 `valueFrom`（或反之）时，Helm upgrade 的 strategic merge patch 会报 `valueFrom: may not be specified when value is not empty`。必须删除 Deployment 重新创建。
4. **ArgoCD 可能"凭空消失"**: 排查到最后发现 k3d-agenthive-dev 集群中根本没有 ArgoCD（无 namespace、无 pod、无 CRD）。之前能访问到的 `100.73.49.93:30443` 可能是另一台机器上的 ArgoCD 实例，因网络可达而被误认为是本集群的。GitOps 自动同步早已失效。
5. **db-migrate Job 模板隐患**: `db-migrate-job.yaml` 硬编码了 `NODE_ENV: production`，同时又通过 `{{- range .Values.api.envFromConfigMap }}` 循环引入了 `NODE_ENV`（来自 ConfigMap），导致同一 env 变量在 YAML 中出现两次。Kubernetes 目前容忍此重复，但属于隐患。
6. **k3d 节点缓存是 develop 断网时的救命稻草**: 当外部 registry 不可达时，`docker exec <k3d-node> ctr images ls | grep <image>` 可快速确认节点缓存中可用的镜像标签。`develop-latest` 这类浮动标签在缓存中存活概率最高。
**Action**: 
- rabbitmq-deployment.yaml 中 initContainer 命令固定为 `rm -f /var/lib/rabbitmq/.erlang.cookie`，不再尝试 chmod/chown
- CI pipeline 增加"镜像推送成功后才能更新 values.dev.yaml tag"的校验门
- 修复 db-migrate-job.yaml：移除硬编码的 `NODE_ENV: production`（ConfigMap 已提供）
- 重建 ArgoCD 到 develop 集群，或建立每日 helm-health-check 告警
- 建立 `scripts/dev/check-node-cache.ps1` 脚本，在 values.dev.yaml 更新前验证镜像在节点缓存中的存在性
**Reference**: `docs/project/2026-05-06-daily-sync.md`, `chart/agenthive/templates/rabbitmq-deployment.yaml` (commit b48f11c)
