import type { AgentRole, TaskPriority } from '@/types'

// Agent 角色配置
export const AGENT_ROLES: { value: AgentRole; label: string; icon: string; color: string }[] = [
  { value: 'director', label: '导演', icon: 'VideoCamera', color: '#722ed1' },
  { value: 'scrum_master', label: 'Scrum Master', icon: 'Management', color: '#13c2c2' },
  { value: 'tech_lead', label: '技术负责人', icon: 'Cpu', color: '#1890ff' },
  { value: 'backend_dev', label: '后端开发', icon: 'Monitor', color: '#52c41a' },
  { value: 'frontend_dev', label: '前端开发', icon: 'Picture', color: '#eb2f96' },
  { value: 'qa_engineer', label: 'QA工程师', icon: 'CircleCheck', color: '#fa8c16' },
  { value: 'devops_engineer', label: 'DevOps工程师', icon: 'Cloudy', color: '#f5222d' },
  { value: 'custom', label: '自定义', icon: 'User', color: '#8c8c8c' },
]

// Agent 状态配置
export const AGENT_STATUS = {
  idle: { label: '空闲', type: 'info' as const, color: '#909399' },
  starting: { label: '启动中', type: 'warning' as const, color: '#e6a23c' },
  working: { label: '工作中', type: 'primary' as const, color: '#409eff' },
  paused: { label: '已暂停', type: 'warning' as const, color: '#b1b3b8' },
  error: { label: '错误', type: 'danger' as const, color: '#f56c6c' },
  completed: { label: '已完成', type: 'success' as const, color: '#67c23a' },
}

// 任务优先级配置
export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: '低', color: '#909399' },
  { value: 'medium', label: '中', color: '#409eff' },
  { value: 'high', label: '高', color: '#e6a23c' },
  { value: 'critical', label: '紧急', color: '#f56c6c' },
]

// 任务状态配置
export const TASK_STATUS = {
  pending: { label: '待处理', type: 'info' as const },
  assigned: { label: '已分配', type: 'primary' as const },
  running: { label: '进行中', type: 'warning' as const },
  completed: { label: '已完成', type: 'success' as const },
  failed: { label: '失败', type: 'danger' as const },
  cancelled: { label: '已取消', type: 'info' as const },
}

// 侧边栏菜单
export const SIDEBAR_MENUS = [
  { path: '/', name: 'Dashboard', title: '仪表板', icon: 'Odometer' },
  { path: '/agents', name: 'Agents', title: 'Agent 管理', icon: 'UserFilled' },
  { path: '/tasks', name: 'Tasks', title: '任务看板', icon: 'List' },
  { path: '/sprints', name: 'Sprints', title: 'Sprint', icon: 'Calendar' },
  { path: '/code', name: 'Code', title: '代码查看', icon: 'Document' },
  { path: '/terminal', name: 'Terminal', title: '终端', icon: 'Monitor' },
  { path: '/chat', name: 'Chat', title: '对话', icon: 'ChatDotRound' },
]

// WebSocket 事件类型
export const WS_EVENTS = {
  // Agent 相关
  AGENT_STATE_CHANGE: 'agent:state_change',
  AGENT_REGISTERED: 'agent:registered',
  AGENT_UNREGISTERED: 'agent:unregistered',
  AGENT_HEARTBEAT: 'agent:heartbeat',
  
  // 任务相关
  TASK_CREATED: 'task:created',
  TASK_ASSIGNED: 'task:assigned',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_PROGRESS: 'task:progress',
  
  // 代码相关
  CODE_UPDATE: 'code:update',
  CODE_COMMIT: 'code:commit',
  CODE_PUSH: 'code:push',
  
  // 终端相关
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_ERROR: 'terminal:error',
  
  // 消息相关
  NEW_MESSAGE: 'message:new',
  TYPING_START: 'message:typing_start',
  TYPING_END: 'message:typing_end',
  
  // 系统相关
  SYSTEM_STATUS: 'system:status',
  SYSTEM_ERROR: 'system:error',
} as const

// 代码语言映射
export const CODE_LANGUAGES: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.vue': 'vue',
  '.go': 'go',
  '.py': 'python',
  '.java': 'java',
  '.rs': 'rust',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.xml': 'xml',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
}

// 默认代码内容（用于演示）
export const DEFAULT_CODE_CONTENT = `// Agent is analyzing the task...
// Waiting for instructions...

/**
 * AgentHive Cloud - AI Development Team
 * 
 * This is a real-time code editor showing what the AI Agent is writing.
 * All changes are synchronized via WebSocket.
 */

console.log('AgentHive Cloud initialized');
`

// 存储键名
export const STORAGE_KEYS = {
  TOKEN: 'agenthive_token',
  USER: 'agenthive_user',
  SETTINGS: 'agenthive_settings',
  THEME: 'agenthive_theme',
  SIDEBAR_COLLAPSED: 'agenthive_sidebar_collapsed',
} as const

// API 错误消息
export const API_ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权，请重新登录',
  403: '拒绝访问',
  404: '请求的资源不存在',
  408: '请求超时',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时',
}

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}

// 主题配置
export const THEMES = {
  light: {
    name: '浅色',
    icon: 'Sunny',
  },
  dark: {
    name: '深色',
    icon: 'Moon',
  },
  auto: {
    name: '跟随系统',
    icon: 'Monitor',
  },
}
