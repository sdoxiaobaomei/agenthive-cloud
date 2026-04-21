/**
 * AgentHive AI Semantic Conventions
 * 
 * 自定义属性键，用于在 OpenTelemetry Spans/Metrics/Logs 中描述
 * AI Agent、LLM 调用、Tool 执行等 AgentHive 特有概念。
 * 
 * 命名规范：以 `agenthive.` 为前缀，避免与 OTel 标准语义冲突。
 */

export const AI_ATTRIBUTES = {
  // LLM 相关
  LLM_PROVIDER: 'llm.provider',
  LLM_MODEL: 'llm.model',
  LLM_MODEL_VERSION: 'llm.model.version',
  LLM_TOKENS_INPUT: 'llm.tokens.input',
  LLM_TOKENS_OUTPUT: 'llm.tokens.output',
  LLM_TOKENS_TOTAL: 'llm.tokens.total',
  LLM_LATENCY_MS: 'llm.latency_ms',
  LLM_COST_USD: 'llm.cost_usd',
  LLM_CACHE_HIT: 'llm.cache_hit',
  LLM_STREAMING: 'llm.streaming',
  LLM_TEMPERATURE: 'llm.temperature',
  LLM_MAX_TOKENS: 'llm.max_tokens',
  LLM_REQUEST_ID: 'llm.request_id',
  LLM_FALLBACK_USED: 'llm.fallback_used',
  LLM_ERROR_TYPE: 'llm.error_type',

  // Agent 相关
  AGENT_ID: 'agent.id',
  AGENT_TYPE: 'agent.type',
  AGENT_NAME: 'agent.name',
  AGENT_STATUS: 'agent.status',
  AGENT_VERSION: 'agent.version',
  AGENT_CAPABILITIES: 'agent.capabilities',

  // Task 相关
  TASK_ID: 'task.id',
  TASK_TYPE: 'task.type',
  TASK_STATUS: 'task.status',
  TASK_PRIORITY: 'task.priority',
  TASK_RETRY_COUNT: 'task.retry_count',
  TASK_MAX_ITERATIONS: 'task.max_iterations',

  // Tool 相关
  TOOL_NAME: 'tool.name',
  TOOL_CATEGORY: 'tool.category',
  TOOL_DURATION_MS: 'tool.duration_ms',
  TOOL_RESULT_STATUS: 'tool.result_status',
  TOOL_ARGUMENTS_COUNT: 'tool.arguments_count',

  // Query Loop 相关
  QUERY_LOOP_ITERATION: 'query_loop.iteration',
  QUERY_LOOP_TOTAL_ITERATIONS: 'query_loop.total_iterations',
  QUERY_LOOP_THINKING_DURATION_MS: 'query_loop.thinking_duration_ms',

  // SubAgent 相关
  SUB_AGENT_ID: 'sub_agent.id',
  SUB_AGENT_PARENT_ID: 'sub_agent.parent_id',
  SUB_AGENT_DEPTH: 'sub_agent.depth',

  // Workspace / Orchestrator
  WORKSPACE_ID: 'workspace.id',
  WORKSPACE_PATH: 'workspace.path',
  ORCHESTRATOR_PLAN_ID: 'orchestrator.plan_id',
  ORCHESTRATOR_TICKET_ID: 'orchestrator.ticket_id',
  ORCHESTRATOR_WORKER_ROLE: 'orchestrator.worker_role',

  // Cost / Budget
  COST_DAILY_USD: 'cost.daily_usd',
  COST_MONTHLY_USD: 'cost.monthly_usd',
  BUDGET_DAILY_USD: 'budget.daily_usd',
  BUDGET_ALERT_THRESHOLD: 'budget.alert_threshold',

  // WebSocket / 传输
  WS_EVENT_TYPE: 'websocket.event_type',
  WS_ROOM: 'websocket.room',
  WS_CONNECTION_ID: 'websocket.connection_id',
  WS_RECONNECT_ATTEMPT: 'websocket.reconnect_attempt',
  WS_MESSAGE_SIZE_BYTES: 'websocket.message_size_bytes',
} as const;

export type AiAttributeKey = (typeof AI_ATTRIBUTES)[keyof typeof AI_ATTRIBUTES];

/**
 * Span 名称常量
 */
export const AI_SPAN_NAMES = {
  ORCHESTRATOR_PLAN: 'agenthive.orchestrator.plan',
  ORCHESTRATOR_EXECUTE_TICKETS: 'agenthive.orchestrator.execute_tickets',
  WORKER_EXECUTE: 'agenthive.worker.execute',
  WORKER_APPLY_CHANGES: 'agenthive.worker.apply_changes',
  RUNTIME_TASK: 'agenthive.runtime.task',
  RUNTIME_INITIALIZE: 'agenthive.runtime.initialize',
  RUNTIME_HEARTBEAT: 'agenthive.runtime.heartbeat',
  QUERY_LOOP_EXECUTE: 'agenthive.query_loop.execute',
  QUERY_LOOP_ITERATION: 'agenthive.query_loop.iteration',
  LLM_COMPLETION: 'agenthive.llm.completion',
  LLM_STREAM: 'agenthive.llm.stream',
  TOOL_EXECUTE: 'agenthive.tool.execute',
  SUB_AGENT_SPAWN: 'agenthive.sub_agent.spawn',
  SUB_AGENT_EXECUTE: 'agenthive.sub_agent.execute',
  WS_CONNECT: 'agenthive.websocket.connect',
  WS_SEND: 'agenthive.websocket.send',
  WS_RECEIVE: 'agenthive.websocket.receive',
  WS_HEARTBEAT: 'agenthive.websocket.heartbeat',
  API_REQUEST: 'agenthive.api.request',
  API_WEBSOCKET_EVENT: 'agenthive.api.websocket_event',
  TASK_EXECUTE: 'agenthive.task.execute',
  TASK_PROGRESS: 'agenthive.task.progress',
  TASK_LOG: 'agenthive.task.log',
} as const;

export type AiSpanName = (typeof AI_SPAN_NAMES)[keyof typeof AI_SPAN_NAMES];

/**
 * Metric 名称常量
 */
export const AI_METRICS = {
  LLM_REQUESTS_TOTAL: 'agenthive.llm.requests.total',
  LLM_TOKENS_TOTAL: 'agenthive.llm.tokens.total',
  LLM_LATENCY: 'agenthive.llm.latency',
  LLM_COST_TOTAL: 'agenthive.llm.cost.total',
  LLM_CACHE_HIT_RATIO: 'agenthive.llm.cache.hit_ratio',
  LLM_ERRORS_TOTAL: 'agenthive.llm.errors.total',
  AGENT_TASKS_TOTAL: 'agenthive.agent.tasks.total',
  AGENT_TASK_DURATION: 'agenthive.agent.task.duration',
  AGENT_TASK_SUCCESS_RATE: 'agenthive.agent.task.success_rate',
  TOOL_EXECUTIONS_TOTAL: 'agenthive.tool.executions.total',
  TOOL_EXECUTION_DURATION: 'agenthive.tool.execution.duration',
  QUERY_LOOP_ITERATIONS_TOTAL: 'agenthive.query_loop.iterations.total',
  WS_CONNECTIONS_TOTAL: 'agenthive.websocket.connections.total',
  WS_MESSAGES_TOTAL: 'agenthive.websocket.messages.total',
  WS_RECONNECTS_TOTAL: 'agenthive.websocket.reconnects.total',
  COST_DAILY_USD: 'agenthive.cost.daily_usd',
  COST_BUDGET_REMAINING: 'agenthive.cost.budget_remaining',
} as const;
