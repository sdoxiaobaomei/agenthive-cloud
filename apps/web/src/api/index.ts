// API 统一导出
export { http, default as client } from './client'
export { agentsApi } from './agents'
export { tasksApi } from './tasks'
export { codeApi } from './code'
export { authApi } from './auth'

// 导出 LocalStorage API
export { localStorageApi } from './localStorage'

// 类型导出
export type { 
  AgentsResponse, 
  AgentDetailResponse, 
  CreateAgentRequest, 
  UpdateAgentRequest,
  CommandRequest 
} from './agents'

export type { 
  TasksResponse, 
  CreateTaskRequest, 
  UpdateTaskRequest 
} from './tasks'

export type { 
  FileListResponse, 
  FileContentResponse 
} from './code'

export type { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse 
} from './auth'
