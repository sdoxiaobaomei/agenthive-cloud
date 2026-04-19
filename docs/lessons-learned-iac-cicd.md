# IaC CI/CD 测试复盘 — GitHub Actions 端到端测试

> **日期**: 2026-04-19~20
> **测试范围**: `.github/workflows/iac-*.yml` + `iac/alicloud/terraform/demo-ask/`
> **目标**: 验证 IaC PR Check → Apply → Destroy 全链路

---

## TL;DR

本次测试 **Apply 和 Destroy 最终都成功**，但过程中踩了 **12+ 个坑**。从第一次触发到最终成功，经历了 **9 次 Apply 尝试** 和 **5 次配置变更**。核心教训：**阿里云资源限制比代码 bug 更致命**。

| 指标 | 数值 |
|------|------|
| Apply 尝试次数 | 9 次 |
| 成功 Apply | 1 次 (run #24635714526) |
| 成功 Destroy | 1 次 (run #24635782126) |
| 从首次触发到成功 Apply | ~45 分钟 |
| Destroy 耗时 | **15 分 7 秒** |
| Apply 耗时 | 2 分 23 秒 |

---

## 时间线

```
17:35  PR #1 合并到 master，IaC workflow 文件就位
17:37  【Apply #1】触发 → Enhanced NAT 库存不足 + 实例未授权 → 失败 (4m35s)
17:42  【Apply #2】换 Normal NAT → 已下线 → 失败 (1m31s)
17:45  【Apply #3】换 cn-hangzhou → OSS bucket 在北京 → Init 403 → 失败 (9s)
17:48  【Apply #4】回北京 + cn-beijing-b → 实例不支持 → 取消 (3m31s)
17:52  【Apply #5】cn-beijing-d → State 锁未释放 → Plan 失败 (16s)
17:54  【Apply #6】跳过锁检查 → 同上 VSwitch 重建 + 库存问题 → 取消 (9m)
18:06  【Apply #7】回 cn-beijing-a + Enhanced → NAT 库存 + ESSD 缺货 → 失败 (1m34s)
18:09  【Apply #8】简化架构 (ACK 自动 NAT + cloud_efficiency) → 成功 (2m23s)
18:13  【Destroy #1】触发 → 成功，但耗时 15m7s
```

---

## 🕳️ 坑点 1：Workflow 不在 Default Branch 时无法触发

**现象**：
```
HTTP 404: workflow iac-apply-demo.yml not found on the default branch
```

**根因**：`gh workflow run` 和 GitHub API 的 workflow dispatch 只能从 default branch（master）查找 workflow 文件。PR 分支上的新 workflow 无法直接触发。

**解决**：
1. 先合并 PR 到 master，使 workflow 文件就位
2. 然后再触发 workflow

**教训**：
- **Workflow 文件必须先合并到 default branch 才能被触发**
- 测试新 workflow 的最佳流程：PR → 合并 → 触发测试
- 不能在 PR 分支上直接 `gh workflow run`

---

## 🕳️ 坑点 2：Enhanced NAT Gateway 库存不足

**现象**：
```
Code: OperationFailed.EnhancedInventoryNotEnough
Message: Operation failed because inventory is not enough.
```

**根因**：`cn-beijing-a` 可用区的 Enhanced NAT Gateway 库存不足。

**连锁反应**：
1. 尝试降级为 `nat_type = "Normal"`
2. 报错：`Standard NAT gateways are no longer offered`
3. **死局**：Standard 已下线，Enhanced 无库存

**解决**：
- 方案 A（采用）：**ACK 自动创建 NAT** (`new_nat_gateway = true`)，不再手动管理 NAT Gateway
- 方案 B（备用）：换到库存充足的可用区（如 `cn-beijing-l`）

**教训**：
- **老旧可用区（xxx-a）风险高**：新规格支持慢、库存紧张
- 阿里云已强制使用 Enhanced NAT，Normal 已下线
- 对于 Demo 环境，让 ACK 自动创建 NAT 是最简单的方案

---

## 🕳️ 坑点 3：ECS 实例类型未授权/不支持

**现象**：
```
code: InstanceType.Unauthorized
message: The instanceTypes are not authorized or not supported in current zones
```

**根因**：`ecs.u2a-c1m1.xlarge` 在目标可用区未授权或不支持。

**解决**：更换为当前区域可用的实例类型 `ecs.ic5.xlarge`（4 vCPU / 4 GB）。

**教训**：
- **不同可用区支持的实例类型不同**，需要预先确认
- ACK Worker 节点**绝对不要用积分型实例**（t5/t6）
- 企业做法：平台团队维护实例类型白名单

---

## 🕳️ 坑点 4：ESSD 磁盘缺货

**现象**：
```
code: RecommendEmpty.DiskTypeNoStock
message: The diskTypes are out of usage.
```

**根因**：`cloud_essd` 在 `cn-beijing-a` 缺货。

**解决**：更换为 `cloud_efficiency`（高效云盘）。

**教训**：
- ESSD 虽然是推荐磁盘类型，但某些可用区可能缺货
- Demo 环境可以使用 `cloud_efficiency`，成本更低且库存充足

---

## 🕳️ 坑点 5：VSwitch 跨可用区重建导致销毁卡住

**现象**：
```
alicloud_vswitch.demo: Still destroying... [id=vsw-xxx, 08m50s elapsed]
```

VSwitch 销毁卡了 8 分 50 秒，直到 workflow 被取消。

**根因**：
1. 第一次 Apply 在 `cn-beijing-a` 创建了 VSwitch
2. 后续尝试换到 `cn-beijing-d`，Terraform Plan 显示 VSwitch 需要重建
3. `zone_id = "cn-beijing-a" -> "cn-beijing-d"` **forces replacement**
4. 但 ACK 集群仍在引用旧的 VSwitch，Terraform 的依赖图处理有问题

**解决**：
- **不要在工作流中途换可用区**
- 保持 `cn-beijing-a`，避免 VSwitch 强制重建

**教训**：
- VSwitch 的 `zone_id` 变化会触发 **destroy + create replacement**
- 如果 VSwitch 被 ACK 集群/NAT Gateway 依赖，销毁会卡住
- **生产环境中，可用区一旦确定就不要随意更换**

---

## 🕳️ 坑点 6：Terraform State 锁未释放

**现象**：
```
Error: Error acquiring the state lock
Code: OTSConditionCheckFail
Message: Row exists which is expected nonexistent
```

**根因**：
1. Apply workflow 被手动取消（`gh run cancel`）
2. GitHub Actions 的取消不会执行 Terraform 的清理步骤
3. OTS（Table Store）中的 state 锁没有被释放
4. 后续 workflow 无法获取锁

**解决**：
1. 在 Apply/Destroy workflow 中添加 `-lock=false` 参数（Demo 环境手动触发，无并发风险）
2. 或者在 workflow 中添加 `force-unlock` 步骤

**教训**：
- **GitHub Actions 取消 workflow 不会释放 Terraform state 锁**
- Demo 环境可以安全使用 `-lock=false`
- 生产环境应使用 `terraform force-unlock` 或等待锁超时（默认 10 分钟）

---

## 🕳️ 坑点 7：OSS Backend Region 必须与 Bucket 实际 Region 一致

**现象**：
```
StatusCode=403, ErrorCode=AccessDenied
Message: The bucket you are attempting to access must be addressed 
using the specified endpoint. Please send all future requests to 
this endpoint.
Endpoint=oss-cn-beijing.aliyuncs.com
```

**根因**：将 backend 的 `region` 从 `cn-beijing` 改为 `cn-hangzhou`，但 OSS bucket 实际位于 `cn-beijing`。

**解决**：backend 的 `region` 保持与 OSS bucket 实际位置一致（`cn-beijing`），只有 provider 的 region 控制资源创建位置。

**教训**：
- **Backend `region` ≠ Provider `region`**
- Backend region 是指 OSS bucket 所在的地域
- Provider region 是指资源创建的地域

---

## 🕳️ 坑点 8：Destroy 耗时过长（15 分钟）

**现象**：Destroy workflow 运行了 15 分 7 秒。

**分析**：
```
alicloud_cs_managed_kubernetes.demo: Still destroying... [02m40s elapsed]
alicloud_cs_managed_kubernetes.demo: Destruction complete after 3m7s
```

ACK 集群销毁就花了 3 分钟，但整个 workflow 运行了 15 分钟。剩余时间主要用于：
1. Provider 下载（每次运行都重新下载 ~150MB provider）
2. Terraform Init 初始化 backend
3. Plan 阶段刷新所有资源状态

**教训**：
- ACK 集群删除是**异步操作**，Terraform 只是发送删除请求，实际删除由阿里云后台执行
- 考虑增加 workflow 的 `timeout-minutes`（当前 30 分钟足够）
- 使用 `actions/cache` 缓存 provider 可以显著减少下载时间

---

## 🕳️ 坑点 9：节点被标记为不可调度（Unschedulable）

**现象**：用户在阿里云控制台观察到节点被标记为不可调度，影响删除。

**日志线索**：
```
- unschedulable = false -> null
```

**根因分析**：
1. ACK 集群删除时，阿里云会自动对节点执行 `cordon`（标记为不可调度）和 `drain`（驱逐 Pod）
2. 如果节点上的 Pod 无法被驱逐（如 DaemonSet、本地存储 Pod），节点会一直处于 `NotReady` 或 `Unschedulable` 状态
3. Terraform provider 在等待节点池删除时，可能因为节点状态异常而卡住

**解决**：
- 在 Terraform 中显式设置节点池的 `unschedulable = false`
- 或者，在 Destroy workflow 中添加前置步骤，手动 `kubectl drain` 节点
- 最简单的方案：**增加 workflow timeout**，让阿里云后台有足够时间完成清理

**教训**：
- **K8s 节点删除不是瞬时操作**，涉及 Pod 驱逐、volume 解绑、网络清理等
- 阿里云 ACK 集群删除通常需要 **3~10 分钟**
- 如果节点被标记为不可调度，不要手动干预，等待阿里云后台自动处理

---

## 🕳️ 坑点 10：CI/CD Workflow 被 IaC 改动误触发

**现象**：修改 `.github/workflows/iac-apply-demo.yml` 后，CI/CD Pipeline 也被触发了。

**根因**：CI/CD workflow 的 `paths` 包含 `.github/workflows/**`，匹配了所有 workflow 文件。

**解决**：将路径收窄为只包含 CI/CD 相关的 workflow：
```yaml
paths:
  - '.github/workflows/ci-cd.yml'
  - '.github/workflows/deploy-*.yml'
  - '.github/workflows/build-*.yml'
```

**教训**：
- **paths 匹配要精确**，不要用 `**` 通配所有 workflow 文件
- IaC、CI/CD、监控等不同领域的 workflow 应该独立触发

---

## 🕳️ 坑点 11：pnpm store path 格式导致 GitHub Actions 解析失败

**现象**：
```
Unable to process file command 'output' successfully.
Invalid format '/home/runner/setup-pnpm/node_modules/.bin/store/v3'
```

**根因**：`pnpm store path` 的输出路径包含特殊字符，GitHub Actions 的 `GITHUB_OUTPUT` 文件解析失败。

**解决**：使用多行 EOF 语法：
```yaml
run: |
  STORE_PATH=$(pnpm store path)
  echo "STORE_PATH<<EOF" >> $GITHUB_OUTPUT
  echo "$STORE_PATH" >> $GITHUB_OUTPUT
  echo "EOF" >> $GITHUB_OUTPUT
```

**教训**：
- GitHub Actions 的 `GITHUB_OUTPUT` 对特殊字符敏感
- 多行值必须使用 `<<EOF` 语法

---

## 🕳️ 坑点 12：Node.js 20 Deprecation 警告

**现象**：
```
Node.js 20 actions are deprecated.
Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.
Node.js 20 will be removed from the runner on September 16th, 2026.
```

**影响**：非阻塞警告，但 2026-09-16 后 Node.js 20 将被移除。

**解决**：等待 actions 官方更新到 Node.js 24 版本（`actions/checkout@v5`、`actions/cache@v5` 等）。

---

## ✅ 已实施的改进

| 改进项 | 文件 | 说明 |
|--------|------|------|
| 简化架构 | `demo-ask/main.tf` | 删除手动 NAT/EIP/SNAT，ACK 自动创建 |
| 更换磁盘 | `demo-ask/main.tf` | `cloud_essd` → `cloud_efficiency` |
| 跳过 state 锁 | `iac-apply-demo.yml` | plan/apply 添加 `-lock=false` |
| 创建 cache 目录 | `iac-apply-demo.yml` | init 前 `mkdir -p ~/.terraform.d/plugin-cache` |
| 同步 Destroy | `iac-destroy-demo.yml` | 同上，添加 `-lock=false` + cache 目录 |
| 收窄 CI/CD paths | `ci-cd.yml` | 排除 `iac-*.yml`，避免误触发 |
| 修复 pnpm output | `ci-cd.yml` | 使用 EOF 多行语法 |

---

## 🏗️ 后续优化建议（优先级排序）

### P0 — 必须做

1. **增加 Apply workflow timeout**
   - 当前 30 分钟对于 ACK 集群创建足够，但 Destroy 也需要至少 20 分钟
   - 建议 Apply 保持 30 分钟，Destroy 增加到 45 分钟

2. **Provider 缓存**
   - `actions/cache` 已配置，但 key 不包含 `.terraform.lock.hcl` 的 hash
   - 建议添加 `hashFiles('iac/alicloud/terraform/demo-ask/.terraform.lock.hcl')`

### P1 — 应该做

3. **Destroy 前置清理**
   - 在 Destroy 之前，使用 `kubectl drain` 手动清理节点
   - 或设置节点池 `unschedulable = false` 避免删除卡住

4. **Workflow 失败通知**
   - Apply/Destroy 失败时发送通知（钉钉/飞书/邮件）
   - 避免资源泄漏无人知晓

5. **Cost 告警**
   - 如果 Apply 成功后超过 4 小时未 Destroy，自动发送告警
   - 防止忘记 Destroy 导致持续计费

### P2 — 可以做

6. **OIDC 替代 AccessKey**
   - 当前使用 `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`
   - 建议迁移到 OIDC，避免长期 AccessKey 泄露风险

7. **Terraform Plan 结果持久化**
   - 将 Plan 结果保存为 artifact，便于后续审计

8. **多可用区支持**
   - 当前单可用区，生产环境建议跨 2-3 个 AZ

---

## 一句话总结

> **阿里云 Terraform + GitHub Actions 的 CI/CD 不是"配置即忘"，而是"配置即踩坑"。最大的敌人不是代码 bug，而是阿里云的资源库存、服务限制和异步行为。测试时一定要预留充足时间，并做好手动清理的心理准备。**
