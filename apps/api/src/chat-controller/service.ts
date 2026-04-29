/**
 * Chat Service
 *
 * - Creates and manages chat sessions
 * - Classifies user intent using LLM
 * - Submits agent tasks to Redis Stream queue
 * - Tracks task progress via Redis
 */

import { pool } from '../config/database.js'
import redis, { key } from '../config/redis.js'
import { getLLMService } from '../services/llm.js'
import logger from '../utils/logger.js'
import { enqueueTask } from '../services/taskQueue.js'
import { getChatWorkspacePath } from '../config/workspace.js'
import type {
  ChatSession,
  ChatMessage,
  AgentTask,
  ChatIntent,
  CreateSessionInput,
  IntentClassificationResult,
} from './types.js'
import type { LLMMessage } from '../services/llm.js'

// Prompt template for intent classification (from docs/architecture/chat-controller.md)
const INTENT_CLASSIFICATION_PROMPT = `分析用户输入的意图，从以下选项中选择最匹配的一个：
- create_project: 用户想要创建一个新的软件项目或功能
- modify_code: 用户想要修改、添加或删除代码
- code_review: 用户想要审查代码质量
- run_tests: 用户想要运行测试用例
- fix_bug: 用户想要修复一个错误
- deploy: 用户想要部署应用
- explain: 用户想要理解某段代码或概念
- chat: 普通聊天，不涉及具体开发任务

用户输入: {userInput}

请只返回意图标识符，不要解释。`

function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}



export const chatService = {
  // ========== Session Management ==========

  async createSession(input: CreateSessionInput): Promise<ChatSession> {
    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id, project_id, title, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.userId, input.projectId || null, input.title || '新会话', 'active']
    )
    const session = dbRowToSession(result.rows[0])
    logger.info('Chat session created', { sessionId: session.id, userId: input.userId })
    return session
  },

  async getSession(id: string): Promise<ChatSession | undefined> {
    const result = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [id])
    return result.rows[0] ? dbRowToSession(result.rows[0]) : undefined
  },

  async listSessions(userId: string): Promise<ChatSession[]> {
    const result = await pool.query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 AND status = $2 ORDER BY updated_at DESC',
      [userId, 'active']
    )
    return result.rows.map(dbRowToSession)
  },

  async archiveSession(id: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE chat_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['archived', id]
    )
    return (result.rowCount ?? 0) > 0
  },

  // ========== Message Management ==========

  async addMessage(sessionId: string, role: ChatMessage['role'], content: string, metadata?: ChatMessage['metadata']): Promise<ChatMessage> {
    const result = await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sessionId, role, content, metadata ? JSON.stringify(metadata) : '{}']
    )

    // Update session updated_at
    await pool.query(
      'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [sessionId]
    )

    // Cache recent messages in Redis
    const msgKey = key('chat:session', sessionId)
    await redis.lpush(msgKey, JSON.stringify(result.rows[0]))
    await redis.ltrim(msgKey, 0, 99)
    await redis.expire(msgKey, 86400)

    return dbRowToMessage(result.rows[0])
  },

  async getSessionMessages(sessionId: string, page = 1, pageSize = 50): Promise<{ messages: ChatMessage[]; total: number }> {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM chat_messages WHERE session_id = $1',
      [sessionId]
    )
    const total = parseInt(countResult.rows[0].count)

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, pageSize, (page - 1) * pageSize]
    )

    return {
      messages: result.rows.reverse().map(dbRowToMessage),
      total,
    }
  },

  // ========== Intent Classification ==========

  async classifyIntent(content: string): Promise<IntentClassificationResult> {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{userInput}', content)
    const llmService = getLLMService()

    try {
      const result = await llmService.complete(
        [
          { role: 'system', content: '你是一个意图分类器。只返回意图标识符，不要解释。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.1, maxTokens: 64 }
      )

      const rawIntent = result.content.trim().toLowerCase()
      const intent = parseIntent(rawIntent)

      logger.info('Intent classified', { rawIntent, intent })
      return { intent, confidence: 0.9 }
    } catch (error) {
      logger.error('Intent classification failed', error instanceof Error ? error : undefined, { content })
      return { intent: 'chat', confidence: 0 }
    }
  },

  // ========== Agent Task Execution ==========

  async executeAgentTask(
    sessionId: string,
    intent: ChatIntent,
    content: string,
    userId?: string,
    estimatedCost?: number
  ): Promise<AgentTask[]> {
    // Create workspace for this session
    const workspacePath = getChatWorkspacePath(sessionId)
    await redis.setex(key('chat:workspace', sessionId), 86400, workspacePath)

    // Create tickets based on intent
    const tickets = await createTicketsForIntent(sessionId, intent, content, workspacePath)

    // Submit task to Redis Stream queue (async, returns immediately)
    const taskId = generateId('task')
    await enqueueTask({
      taskId,
      sessionId,
      intent,
      content,
      workspacePath,
      ticketIds: tickets.map(t => t.ticketId),
      createdAt: Date.now(),
      userId,
      estimatedCost,
    })

    // Store taskId → sessionId mapping for progress lookups
    await redis.setex(key('chat:task', sessionId), 86400, taskId)

    // Store userId mapping for billing
    if (userId) {
      await redis.setex(key('chat:task:user', taskId), 86400, userId)
    }

    logger.info('Task queued', { taskId, sessionId, intent, ticketCount: tickets.length, userId, estimatedCost })

    return tickets
  },

  async getSessionTasks(sessionId: string): Promise<AgentTask[]> {
    const result = await pool.query(
      'SELECT * FROM agent_tasks WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    )
    return result.rows.map(dbRowToAgentTask)
  },

  async getTaskProgress(sessionId: string): Promise<{ status: string; logs: string[] }> {
    const [status, logs] = await Promise.all([
      redis.get(key('chat:status', sessionId)),
      redis.lrange(key('chat:logs', sessionId), 0, 99),
    ])
    return { status: status || 'unknown', logs: logs.reverse() }
  },

  // ========== LLM Reply Generation ==========

  async generateReply(
    sessionId: string,
    intent: ChatIntent,
    content: string,
    tasks: AgentTask[]
  ): Promise<string> {
    const llmService = getLLMService()

    // Build conversation context from recent messages
    const { messages } = await this.getSessionMessages(sessionId, 1, 20)
    const conversationMessages: LLMMessage[] = messages.map((m) => ({
      role: m.role === 'agent' ? 'assistant' : m.role,
      content: m.content,
    }))

    const systemPrompt = buildReplySystemPrompt(intent, tasks)

    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
      { role: 'user', content },
    ]

    try {
      const result = await llmService.complete(llmMessages, {
        temperature: 0.7,
        maxTokens: 2048,
      })
      return result.content.trim()
    } catch (error) {
      logger.error('LLM reply generation failed', error instanceof Error ? error : undefined, { sessionId, intent })
      // Fallback to static response
      return buildStaticResponse(intent, tasks)
    }
  },
}

// ========== Helpers ==========

function buildReplySystemPrompt(intent: ChatIntent, tasks: AgentTask[]): string {
  const roleNames: Record<string, string> = {
    frontend: '小花 (前端开发)',
    backend: '阿铁 (后端开发)',
    qa: '阿镜 (QA 工程师)',
  }

  const taskList = tasks.length > 0
    ? tasks.map((t) => `- ${roleNames[t.workerRole] || t.workerRole}: ${t.ticketId}`).join('\n')
    : '无'

  return `你是 AgentHive AI 助手，一个多 Agent 协作的 AI 蜂群协作平台的智能助手。

你的职责：
- 理解用户的软件开发需求
- 调用 Multi-Agent 团队（阿铁-后端、小花-前端、阿镜-QA）并行执行任务
- 用简洁、专业、友好的中文回复用户

当前意图：${intent}
已创建任务：
${taskList}

回复要求：
- 如果用户只是闲聊，自然友好地回应
- 如果涉及开发任务，确认收到请求并简要说明后续步骤
- 如有任务已创建，列出任务清单和负责人
- 语气专业但亲切，像一位经验丰富的 Tech Lead`
}

function buildStaticResponse(intent: ChatIntent, tasks: AgentTask[]): string {
  if (tasks.length === 0) {
    switch (intent) {
      case 'explain':
        return '我来为您解释这个问题...'
      case 'chat':
        return '好的，请继续说。'
      default:
        return '已收到您的请求，正在处理中...'
    }
  }

  const roleNames: Record<string, string> = {
    frontend: '小花 (前端开发)',
    backend: '阿铁 (后端开发)',
    qa: '阿镜 (QA 工程师)',
  }

  const taskList = tasks.map((t) => `- ${roleNames[t.workerRole] || t.workerRole}: ${t.ticketId}`).join('\n')

  return `已为您创建以下任务:\n${taskList}\n\nAgent 团队正在并行执行，您可以通过 WebSocket 实时查看进度。`
}

function parseIntent(raw: string): ChatIntent {
  const validIntents: ChatIntent[] = [
    'create_project',
    'modify_code',
    'code_review',
    'run_tests',
    'fix_bug',
    'deploy',
    'explain',
    'chat',
  ]
  for (const intent of validIntents) {
    if (raw.includes(intent)) return intent
  }
  return 'chat'
}

async function createTicketsForIntent(
  sessionId: string,
  intent: ChatIntent,
  content: string,
  workspacePath: string
): Promise<AgentTask[]> {
  const ticketConfigs: Array<{ ticketId: string; workerRole: AgentTask['workerRole']; task: string }> = []

  switch (intent) {
    case 'create_project':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-BE`, workerRole: 'backend', task: `创建后端项目: ${content}` },
        { ticketId: `T-${Date.now()}-FE`, workerRole: 'frontend', task: `创建前端项目: ${content}` },
        { ticketId: `T-${Date.now()}-QA`, workerRole: 'qa', task: `审查新项目: ${content}` }
      )
      break
    case 'modify_code':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-BE`, workerRole: 'backend', task: `修改代码: ${content}` },
        { ticketId: `T-${Date.now()}-QA`, workerRole: 'qa', task: `代码审查: ${content}` }
      )
      break
    case 'fix_bug':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-BE`, workerRole: 'backend', task: `修复Bug: ${content}` },
        { ticketId: `T-${Date.now()}-QA`, workerRole: 'qa', task: `验证修复: ${content}` }
      )
      break
    case 'code_review':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-QA`, workerRole: 'qa', task: `代码审查: ${content}` }
      )
      break
    case 'run_tests':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-QA`, workerRole: 'qa', task: `运行测试: ${content}` }
      )
      break
    case 'deploy':
      ticketConfigs.push(
        { ticketId: `T-${Date.now()}-BE`, workerRole: 'backend', task: `部署应用: ${content}` }
      )
      break
    default:
      // chat/explain: no tickets
      return []
  }

  // 获取 session 的 project_id
  const sessionResult = await pool.query(
    'SELECT project_id FROM chat_sessions WHERE id = $1',
    [sessionId]
  )
  const projectId = sessionResult.rows[0]?.project_id

  const tasks: AgentTask[] = []
  for (const cfg of ticketConfigs) {
    const result = await pool.query(
      `INSERT INTO agent_tasks (session_id, project_id, ticket_id, worker_role, status, workspace_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sessionId, projectId || null, cfg.ticketId, cfg.workerRole, 'pending', workspacePath]
    )
    tasks.push(dbRowToAgentTask(result.rows[0]))
  }

  return tasks
}

function dbRowToSession(row: any): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function dbRowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    createdAt: row.created_at,
  }
}

function dbRowToAgentTask(row: any): AgentTask {
  return {
    id: row.id,
    sessionId: row.session_id,
    ticketId: row.ticket_id,
    workerRole: row.worker_role,
    status: row.status,
    workspacePath: row.workspace_path,
    result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}
