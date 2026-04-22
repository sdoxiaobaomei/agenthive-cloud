# CI / Build 已知问题 TODO

## 1. packages/ui build 失败 - 缺少 @element-plus/icons-vue 依赖
- **文件**: packages/ui/src/components/molecules/TicketCard.vue
- **错误**: [vite]: Rollup failed to resolve import "@element-plus/icons-vue"
- **根因**: packages/ui/package.json 的 dependencies 中没有声明 @element-plus/icons-vue
- **状态**: 待修复

## 2. landing typecheck 失败 - GSAP DOM 类型不兼容
- **文件**: pps/landing/components/AnimatedCharacters.vue
- **错误**: Argument of type '{ accessKey: string; ... }' is not assignable to parameter of type 'HTMLElement'
- **根因**: gsap.quickTo(ref.value, 'skewX', ...) 调用中，ef.value 的类型与 GSAP quickTo 期望的 HTMLElement 类型不匹配。这是 TypeScript 5.9 + vue-tsc 2.2 + GSAP 类型定义之间的兼容性问题。
- **状态**: 待修复（CI 中已暂时排除 landing typecheck）

## 3. apps/agent-runtime 存在大量类型错误
- **文件**: pps/agent-runtime/src/agent/QueryLoopEnhanced.ts, SubAgentEnhanced.ts, index-enhanced.ts 等
- **错误示例**:
  - Module '"../tools/ToolOrchestrator.js"' declares 'ToolExecutionResult' locally, but it is not exported
  - Parameter 'data' implicitly has an 'any' type
  - Object literal may only specify known properties, and 'error' does not exist in type 'SubAgentResult'
- **根因**: Enhanced 版本的 agent-runtime 代码缺少类型注解，模块导出不一致
- **当前 workaround**: CI 中 agent-runtime build 使用 || true，允许类型错误时仍生成 dist
- **状态**: 待修复（已记录 CI 日志中）

## 4. code-quality job 中 workspace 包需要先 build
- **说明**: packages/observability 和 pps/agent-runtime 的 	ypes 指向 ./dist/index.d.ts，
  但 code-quality job 之前只运行 	ypecheck 不运行 uild，导致 pps/api typecheck 找不到类型。
- **当前 workaround**: CI 中在 Type Check 前先 build 相关 workspace 包
- **长期方案**: 考虑将 workspace 包的 	ypes 指向源码，或使用 publishConfig 分离构建和开发类型路径
