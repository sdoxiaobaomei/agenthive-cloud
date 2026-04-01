/**
 * 测试数据生成器
 * 用于生成测试所需的各种 mock 数据
 */

// Agent 角色类型
export type AgentRole = 'director' | 'frontend' | 'backend' | 'devops' | 'qa' | 'designer'

// Agent 状态类型
export type AgentStatus = 'idle' | 'working' | 'paused' | 'error' | 'offline'

// 任务状态类型
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'

// Agent 接口
export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  description: string
  podIp?: string
  createdAt: string
  updatedAt: string
}

// Task 接口
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  sprintId?: string
  createdAt: string
  updatedAt: string
}

// Agent 角色选项
export const AGENT_ROLES: AgentRole[] = [
  'director',
  'frontend',
  'backend',
  'devops',
  'qa',
  'designer',
]

// Agent 状态选项
export const AGENT_STATUSES: AgentStatus[] = [
  'idle',
  'working',
  'paused',
  'error',
  'offline',
]

// 任务状态选项
export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'assigned',
  'running',
  'completed',
  'failed',
  'cancelled',
]

// 随机 ID 生成器
export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}${timestamp}-${random}`
}

// 随机名称生成器
export const generateName = (type: 'agent' | 'task' | 'sprint' = 'agent'): string => {
  const prefixes: Record<string, string[]> = {
    agent: ['Dev', 'Coder', 'Bot', 'AI', 'Worker', 'Helper', 'Assistant'],
    task: ['Implement', 'Fix', 'Update', 'Create', 'Review', 'Test', 'Deploy'],
    sprint: ['Sprint', 'Iteration', 'Phase', 'Milestone', 'Cycle'],
  }
  
  const suffixes: Record<string, string[]> = {
    agent: ['1', '2', 'Alpha', 'Beta', 'Pro', 'Lite', 'Prime'],
    task: ['Feature', 'Bug', 'Refactor', 'Docs', 'Tests', 'UI', 'API'],
    sprint: ['2026-Q1', '2026-Q2', 'v1.0', 'v2.0', 'Alpha', 'Beta'],
  }
  
  const prefix = prefixes[type][Math.floor(Math.random() * prefixes[type].length)]
  const suffix = suffixes[type][Math.floor(Math.random() * suffixes[type].length)]
  
  return `${prefix} ${suffix}`
}

// 随机描述生成器
export const generateDescription = (): string => {
  const templates = [
    '负责处理 {area} 相关的开发工作',
    '专注于 {area} 功能的实现和优化',
    '协助团队完成 {area} 任务',
    '处理 {area} 模块的代码编写',
    '{area} 领域的技术专家',
  ]
  
  const areas = [
    '前端界面', '后端服务', '数据库', 'API接口', '测试验证',
    '部署运维', 'UI设计', '项目管理', '代码审查', '性能优化',
  ]
  
  const template = templates[Math.floor(Math.random() * templates.length)]
  const area = areas[Math.floor(Math.random() * areas.length)]
  
  return template.replace('{area}', area)
}

// Agent 角色标签映射
export const ROLE_LABELS: Record<AgentRole, string> = {
  director: '项目总监',
  frontend: '前端开发',
  backend: '后端开发',
  devops: 'DevOps',
  qa: '测试工程师',
  designer: 'UI设计师',
}

// Agent 状态标签映射
export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: '空闲',
  working: '工作中',
  paused: '已暂停',
  error: '异常',
  offline: '离线',
}

// 生成 Mock Agent 的选项接口
export interface MockAgentOptions {
  id?: string
  name?: string
  role?: AgentRole
  status?: AgentStatus
  description?: string
  createdAt?: string
}

// 生成 Mock Agent
export const generateMockAgent = (options: MockAgentOptions = {}): Agent => {
  const role = options.role || AGENT_ROLES[Math.floor(Math.random() * AGENT_ROLES.length)]
  
  return {
    id: options.id || generateId('agent-'),
    name: options.name || generateName('agent'),
    role,
    status: options.status || AGENT_STATUSES[Math.floor(Math.random() * AGENT_STATUSES.length)],
    description: options.description || generateDescription(),
    podIp: `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// 生成多个 Mock Agents
export const generateMockAgents = (count: number = 5): Agent[] => {
  return Array.from({ length: count }, () => generateMockAgent())
}

// 生成 Mock Task 的选项接口
export interface MockTaskOptions {
  id?: string
  title?: string
  description?: string
  status?: TaskStatus
  priority?: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  sprintId?: string
  createdAt?: string
}

// 生成 Mock Task
export const generateMockTask = (options: MockTaskOptions = {}): Task => {
  const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical']
  
  return {
    id: options.id || generateId('task-'),
    title: options.title || generateName('task'),
    description: options.description || generateDescription(),
    status: options.status || TASK_STATUSES[Math.floor(Math.random() * TASK_STATUSES.length)],
    priority: options.priority || priorities[Math.floor(Math.random() * 4)],
    assignedTo: options.assignedTo,
    sprintId: options.sprintId,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// 生成多个 Mock Tasks
export const generateMockTasks = (count: number = 5): Task[] => {
  return Array.from({ length: count }, () => generateMockTask())
}

// Mock WebSocket 消息接口
export interface MockWebSocketMessage {
  event: string
  data: unknown
  timestamp: string
}

// 生成 Mock WebSocket 消息
export const generateMockWebSocketMessage = (
  event: string = 'message',
  data: unknown = {}
): MockWebSocketMessage => {
  return {
    event,
    data,
    timestamp: new Date().toISOString(),
  }
}

// 生成 Agent 状态变更消息
export const generateAgentStateChangeMessage = (
  agentId: string,
  oldState: AgentStatus,
  newState: AgentStatus,
  progress?: number
): MockWebSocketMessage => {
  return generateMockWebSocketMessage('agent:state_change', {
    agentId,
    oldState,
    newState,
    progress: progress ?? Math.floor(Math.random() * 101),
    message: `Agent ${agentId} 状态从 ${STATUS_LABELS[oldState]} 变为 ${STATUS_LABELS[newState]}`,
  })
}

// 生成任务更新消息
export const generateTaskUpdateMessage = (
  taskId: string,
  status: TaskStatus,
  progress?: number
): MockWebSocketMessage => {
  return generateMockWebSocketMessage('task:progress', {
    taskId,
    status,
    progress: progress ?? Math.floor(Math.random() * 101),
  })
}

// 生成代码更新消息
export const generateCodeUpdateMessage = (
  agentId: string,
  file: string = 'main.ts',
  language: string = 'typescript'
): MockWebSocketMessage => {
  const codeSnippets: Record<string, string> = {
    typescript: 'function example() {\n  return "Hello World";\n}',
    javascript: 'const example = () => {\n  return "Hello World";\n};',
    python: 'def example():\n    return "Hello World"',
    go: 'func example() string {\n    return "Hello World"\n}',
    rust: 'fn example() -> String {\n    String::from("Hello World")\n}',
  }
  
  return generateMockWebSocketMessage('code:update', {
    agentId,
    file,
    content: codeSnippets[language] || codeSnippets.typescript,
    language,
  })
}

// 生成终端输出消息
export const generateTerminalOutputMessage = (
  agentId: string,
  isError: boolean = false
): MockWebSocketMessage => {
  const outputs = [
    '> npm install',
    '> Building project...',
    '> Tests passed: 42/42',
    '> Deploy completed successfully',
    '> Starting development server...',
  ]
  
  const errorOutputs = [
    'Error: Module not found',
    'Error: Build failed',
    'Error: Test failed',
    'Error: Connection timeout',
  ]
  
  return generateMockWebSocketMessage('terminal:output', {
    agentId,
    data: isError 
      ? errorOutputs[Math.floor(Math.random() * errorOutputs.length)]
      : outputs[Math.floor(Math.random() * outputs.length)],
    isError,
  })
}

// 生成系统状态消息
export const generateSystemStatusMessage = (
  status: 'healthy' | 'degraded' | 'error' = 'healthy'
): MockWebSocketMessage => {
  const messages: Record<string, string> = {
    healthy: '系统运行正常',
    degraded: '系统性能下降',
    error: '系统出现错误',
  }
  
  return generateMockWebSocketMessage('system:status', {
    status,
    message: messages[status],
  })
}

// 测试用户信息
export const TEST_USERS = {
  valid: {
    username: 'admin',
    password: 'password123',
  },
  invalid: {
    username: 'invalid_user',
    password: 'wrong_password',
  },
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
  },
}

// 测试 API 响应
export const generateMockApiResponse = <T>(data: T, success: boolean = true) => {
  return {
    success,
    data,
    message: success ? '操作成功' : '操作失败',
    timestamp: new Date().toISOString(),
  }
}

// 错误响应
export const generateMockErrorResponse = (message: string = '请求失败', code: number = 500) => {
  return {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  }
}

// 默认导出
export default {
  generateId,
  generateName,
  generateDescription,
  generateMockAgent,
  generateMockAgents,
  generateMockTask,
  generateMockTasks,
  generateMockWebSocketMessage,
  generateAgentStateChangeMessage,
  generateTaskUpdateMessage,
  generateCodeUpdateMessage,
  generateTerminalOutputMessage,
  generateSystemStatusMessage,
  generateMockApiResponse,
  generateMockErrorResponse,
  AGENT_ROLES,
  AGENT_STATUSES,
  TASK_STATUSES,
  ROLE_LABELS,
  STATUS_LABELS,
  TEST_USERS,
}
