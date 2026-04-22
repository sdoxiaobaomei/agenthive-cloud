// Services - Agent Runtime 核心服务
export { BaseAgentRuntime } from './BaseAgentRuntime.js'
export { AgentRuntime } from './agent-runtime.js'

// AgentRuntimeV2 / AgentRuntimeV3 可通过直接文件路径引用：
//   import { AgentRuntimeV2 } from './services/agent-runtime-v2.js'
//   import { AgentRuntimeV3, type AgentRuntimeV3Config } from './services/agent-runtime-v3.js'
// 未在索引中统一导出，因为 tsconfig.json 排除了 **/*-v2.ts / **/*-v3.ts 以避免
// task-executor-v2.ts / task-executor-v3.ts 中预存类型错误的干扰。
