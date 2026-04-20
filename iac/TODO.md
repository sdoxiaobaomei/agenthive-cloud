# AgentHive IaC 演进 TODO

> 记录 IaC 基础设施的技术债务和演进计划。按优先级排序，做完一项勾掉一项。

---

## 🔴 高优先级（1-2 个月内）

### [ ] 1. Terraform State 灾难恢复能力
- [ ] 学习 `terraform state` 子命令：`mv`, `rm`, `pull`, `push`, `replace-provider`
- [ ] 配置 OSS State 自动备份（每日备份到另一个 bucket / 版本控制）
- [ ] 练习一次完整的手动修复：`terraform import` 把现有资源重新纳入 state
- [ ] 文档化：`docs/state-recovery-playbook.md`

### [ ] 2. Drift Detection（漂移检测）
- [ ] 新建 `.github/workflows/iac-drift-detection.yml`
- [ ] 每日定时触发（cron: `0 2 * * *`）
- [ ] 跑 `terraform plan` 检测 state 与实际资源的差异
- [ ] 检测到 drift 时：发送通知（企业微信/钉钉/邮件）
- [ ] 参考：`iac/TERRAFORM-GUIDE.md` "Drift Detection" 章节

### [ ] 3. Checkov 硬阻断 + 自定义规则
- [ ] 修改 `iac-pr-check.yml`：删除 `continue-on-error: true`，改为强制失败
- [ ] 编写 3-5 条团队规范规则：
  - [ ] 所有 VPC 必须打 `Environment` 标签
  - [ ] 所有 ECS/ACK 资源必须打 `Project` 和 `ManagedBy` 标签
  - [ ] 禁止在 dev/staging 环境使用生产级实例规格
- [ ] 规则文件：`iac/checkov-rules/`（或 `.checkov.yaml`）

---

## 🟡 中优先级（3-6 个月内）

### [ ] 4. 模块版本管理
- [ ] 学习 Terraform 模块的 `source` 引用方式：`git::...?ref=v1.0.0`
- [ ] 给现有模块打语义化版本标签（`modules/vpc/v1.0.0`, `modules/k8s/v1.0.0`）
- [ ] 修改 `demo-ask/` 和 `environments/` 的模块引用，从相对路径改为带版本号的 git 引用
- [ ] 建立模块变更发布流程：PR → Review → Tag → 消费方升级

### [ ] 5. Infracost 成本估算
- [ ] 在 `iac-pr-check.yml` 中集成 Infracost
- [ ] PR 评论中展示变更带来的月度成本影响
- [ ] 设置成本基线告警：dev 环境月度成本不超过 ¥1000

### [ ] 6. CODEOWNERS + Branch Protection 治理
- [ ] 新建 `.github/CODEOWNERS`，指定 IaC 文件必须由特定人员 review
- [ ] 配置 GitHub Branch Protection：`iac/**` 路径变更必须 1 人以上 approve
- [ ] 配置 Environment Protection：`prod` workspace 需手动审批

---

## ✅ 已完成（回顾成就感）

| 完成时间 | 任务 | Commit |
|---------|------|--------|
| 2026-04-20 | OIDC 联邦认证迁移（替代静态 AccessKey） | `08d4ecd` → `987f3fb` |
| 2026-04-20 | 修复 github-oidc-role/outputs.tf broken data source | `838e14a` |
| 2026-04-20 | 删除 workflow `-lock=false`（恢复 state locking） | `838e14a` |
| 2026-04-20 | PR Check 增加 github-oidc-role 模块验证 | `838e14a` |
| 2026-04-20 | 创建 bootstrap/ 目录 IaC 化 OIDC Provider + Role | `838e14a` |
| 2026-04-20 | 更新 TERRAFORM-GUIDE.md OIDC 状态为已完成 | `838e14a` |

---

## 🟢 低优先级（有闲暇或换工作时）

- [ ] **Terraform Cloud / Atlantis**：小团队 GitHub Actions 够用，团队 >10 人再考虑
- [ ] **Terratest（Go 测试 Terraform 模块）**：模块作者才需要
- [ ] **多云 Provider（AWS/Azure）**：除非业务需要跨云
- [ ] **Terraform Provider 开发**：除非需要对接自研系统
