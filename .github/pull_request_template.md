## 变更摘要
<!-- 用一句话说明这个 PR 做了什么 -->

## 关联 Ticket
<!-- 如 T-001，无则写 N/A -->

## 检查清单（合并前必须全部勾选）

- [ ] 我的变更遵循 [Agent 协作规范](../AGENT_COLLABORATION_SPEC.md)
- [ ] 遵循 5 条不可违背架构决策（ADR-1 ~ ADR-5）
- [ ] 未在代码中硬编码密钥、密码、Token
- [ ] Commit message 符合 `type(scope): description` 格式
- [ ] 相关测试通过（`pnpm test` 或 `npm test`）
- [ ] `pnpm run build` 无错误（如有代码变更）
- [ ] 涉及 K8s 的已验证 `helm template` 正常

## 影响范围

- [ ] 仅前端（landing/web）
- [ ] 仅 Node.js API
- [ ] 仅 Java 服务
- [ ] Agent 运行时 / AI 引擎
- [ ] 基础设施 / K8s / Helm

## 风险说明
<!-- 如有破坏性变更、配置变更、依赖升级，请说明 -->
