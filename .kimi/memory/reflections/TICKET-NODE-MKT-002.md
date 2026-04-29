# Reflection: TICKET-NODE-MKT-002 — 网站托管部署与流量统计上报

## 实现概述

为 Project 模块增加了 Hosting & Traffic 能力：
- 一键部署 workspace 到托管环境（生成 Dockerfile / Nginx config）
- 公开托管路由 `/h/:projectId/*` 的 PV/UV 追踪
- 每 5 分钟批量上报到 Java `/hosted-websites/:id/traffic`
- Dashboard APIs：7 天趋势 + 实时流量
- Mock 模式：Java API 不可用时返回静态数据

## 技术决策

1. **Mock 模式通过 module-level const 控制** — 简单但测试时需要小心模块加载顺序。
   后续改进：改用运行时配置对象，便于测试动态切换。

2. **UV 去重使用 Redis Set + 1h TTL** — 精确度高，但 Redis Set 内存占用随 UV 增长。
   若 UV > 10万/小时，建议降级为 HyperLogLog。

3. **批量上报使用内存队列** — 简单高效，但进程重启会丢失待上报数据。
   生产环境可升级为 Redis Stream 持久化队列。

4. **部署配置生成在 Node 层** — 当前 focus 是"配置生成"，实际容器部署由 Platform 后续完善。
   因此代码中明确区分了 config generation 和 actual deployment。

## 踩坑记录

- **Module-level const 测试陷阱**：`MOCK_JAVA_API` 在模块加载时求值，测试中用 `process.env.MOCK_JAVA_API = 'true'` 无效。
  解法：mock `fetch` 本身，或改用 `vi.doMock` / `vi.resetModules`。

- **Vitest vi.mock hoisting**：`vi.mock` factory 中不能引用顶层变量，否则出现 "Cannot access before initialization"。
  解法：mock 对象直接内联在 factory 中。

## 安全考量

- 公开托管路由未挂载 rate limiter，存在被刷 PV 的风险。
- UV fingerprint 使用 SHA256(ip:ua)，建议增加 salt。
- 部署配置字符串中可能包含 workspace 绝对路径，需确保不泄露敏感目录结构。

## 后续优化

1. 为 `/h/:projectId` 增加专用 rate limiter
2. 用 Redis Stream 替换内存队列做上报缓冲
3. 补充 Swagger/OpenAPI 文档
4. 添加集成测试（supertest）验证路由行为
