/**
 * Chat Controller - REST endpoints for chat sessions
 */

import type { Request, Response } from 'express'
import { z } from 'zod'
import { chatService } from './service.js'
import { checkBalance } from '../services/credits.js'
import logger from '../utils/logger.js'
import { isValidUuid } from '../utils/validators.js'

const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  sessionType: z.enum(['default', 'review', 'debug', 'template']).optional(),
})

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  messageType: z.enum(['message', 'think', 'task', 'recommend', 'system_event']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const approveTaskSchema = z.object({
  action: z.enum(['approve', 'decline']),
  reason: z.string().optional(),
})

const selectRecommendSchema = z.object({
  optionId: z.string().min(1),
})

const createVersionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  baseMessageId: z.string().uuid().optional(),
})

export const createSession = async (req: Request, res: Response) => {
  try {
    const parseResult = createSessionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权' , data: null })
    }

    const session = await chatService.createSession({
      userId,
      projectId: parseResult.data.projectId,
      workspaceId: parseResult.data.workspaceId,
      title: parseResult.data.title,
      sessionType: parseResult.data.sessionType,
    })

    res.status(201).json({ code: 201, message: 'success', data: session })
  } catch (error) {
    logger.error('Failed to create chat session', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '创建会话失败' , data: null })
  }
}

export const listSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权' , data: null })
    }

    const sessions = await chatService.listSessions(userId)
    res.json({ code: 200, message: 'success', data: { items: sessions, total: sessions.length } })
  } catch (error) {
    logger.error('Failed to list chat sessions', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取会话列表失败' , data: null })
  }
}

export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }
    res.json({ code: 200, message: 'success', data: session })
  } catch (error) {
    logger.error('Failed to get chat session', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取会话详情失败' , data: null })
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权' , data: null })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const { content, messageType, metadata } = parseResult.data
    const currentVersionId = session.currentVersionId || undefined

    await chatService.addMessage(id, 'user', content, {
      messageType: messageType || 'message',
      metadata,
      versionId: currentVersionId,
    })

    if (messageType === 'recommend') {
      const recommendMsg = await chatService.addMessage(id, 'assistant', '', {
        messageType: 'recommend',
        metadata: metadata?.recommendOptions
          ? { recommendOptions: metadata.recommendOptions as any }
          : undefined,
        versionId: currentVersionId,
        isVisibleInHistory: false,
      })

      return res.json({
        code: 200, message: 'success',
        data: { message: recommendMsg, messageType: 'recommend' },
      })
    }

    const { intent } = await chatService.classifyIntent(content)

    const thinkMsg = await chatService.addMessage(id, 'assistant', `思考中... 意图识别: ${intent}`, {
      messageType: 'think',
      metadata: { intent, thinkSummary: `检测到意图: ${intent}` },
      versionId: currentVersionId,
    })

    await chatService.addMessage(id, 'system', `检测到意图: ${intent}`, {
      messageType: 'system_event',
      versionId: currentVersionId,
    })

    let tasks: Awaited<ReturnType<typeof chatService.executeAgentTask>> = []
    let estimatedCost = 0
    if (intent !== 'chat' && intent !== 'explain') {
      const primaryRole = intent === 'code_review' || intent === 'run_tests' ? 'qa' : 'backend'
      const balanceResult = await checkBalance(userId, primaryRole)
      estimatedCost = balanceResult.estimatedCost

      if (!balanceResult.sufficient) {
        return res.status(402).json({
          code: 402,
          message: 'Credits 余额不足',
          data: { balance: balanceResult.balance, estimatedCost },
        })
      }
      tasks = await chatService.executeAgentTask(id, intent, content, userId, estimatedCost)
    }

    const responseContent = await chatService.generateReply(id, intent, content, tasks)
    const assistantMsg = await chatService.addMessage(id, 'assistant', responseContent, {
      messageType: 'message',
      metadata: { intent, estimatedCost, tickets: tasks.map((t) => ({ id: t.ticketId, role: t.workerRole, task: t.ticketId, status: t.status })) },
      versionId: currentVersionId,
    })

    if (tasks.length > 0) {
      await chatService.addMessage(id, 'assistant', '以下任务需要您的确认：', {
        messageType: 'task',
        metadata: {
          taskPayload: {
            title: 'Agent 任务待确认',
            description: tasks.map(t => `- ${t.workerRole}: ${t.ticketId}`).join('\n'),
            actions: [
              { id: 'approve', label: '确认执行', type: 'approve' as const },
              { id: 'decline', label: '取消', type: 'decline' as const },
            ],
          },
          approvalStatus: 'pending',
        },
        versionId: currentVersionId,
      })
    }

    res.json({
      code: 200, message: 'success',
      data: {
        message: assistantMsg,
        thinkMessage: thinkMsg,
        intent,
        tasks,
        estimatedCost,
      },
    })
  } catch (error) {
    logger.error('Failed to send message', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '发送消息失败' , data: null })
  }
}

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50))
    const versionId = req.query.versionId as string | undefined

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const { messages, total } = await chatService.getSessionMessages(id, page, pageSize, { versionId })
    res.json({ code: 200, message: 'success', data: {
        messages,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    logger.error('Failed to get messages', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取消息列表失败' , data: null })
  }
}

export const executeTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ code: 401, message: '未授权' , data: null })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const { intent } = await chatService.classifyIntent(parseResult.data.content)

    const primaryRole = intent === 'code_review' || intent === 'run_tests' ? 'qa' : 'backend'

    const balanceResult = await checkBalance(userId, primaryRole)
    if (!balanceResult.sufficient) {
      return res.status(402).json({
        code: 402,
        message: 'Credits 余额不足，请充值或赚取 Credits',
        data: { balance: balanceResult.balance, estimatedCost: balanceResult.estimatedCost },
      })
    }

    const tasks = await chatService.executeAgentTask(id, intent, parseResult.data.content, userId, balanceResult.estimatedCost)

    res.json({ code: 200, message: 'success', data: { intent, tasks, estimatedCost: balanceResult.estimatedCost } })
  } catch (error) {
    logger.error('Failed to execute task', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '执行任务失败' , data: null })
  }
}

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const tasks = await chatService.getSessionTasks(id)
    res.json({ code: 200, message: 'success', data: { tasks, total: tasks.length } })
  } catch (error) {
    logger.error('Failed to get tasks', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取任务列表失败' , data: null })
  }
}

export const getProgress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!isValidUuid(id)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${id}" 不是有效的 UUID`, data: null })
    }
    const progress = await chatService.getTaskProgress(id)
    res.json({ code: 200, message: 'success', data: progress })
  } catch (error) {
    logger.error('Failed to get progress', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取进度失败' , data: null })
  }
}

export const approveTask = async (req: Request, res: Response) => {
  try {
    const { id: sessionId, messageId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const parseResult = approveTaskSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) return res.status(401).json({ code: 401, message: '未授权', data: null })

    // Validate session ownership
    const session = await chatService.getSession(sessionId)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在', data: null })
    }

    const updated = await chatService.approveTask(messageId, sessionId, parseResult.data.action, parseResult.data.reason)
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error: any) {
    logger.error('Failed to approve task', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: error.message || '审批失败', data: null })
  }
}

export const selectRecommend = async (req: Request, res: Response) => {
  try {
    const { id: sessionId, messageId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const parseResult = selectRecommendSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) return res.status(401).json({ code: 401, message: '未授权', data: null })

    // Validate session ownership
    const session = await chatService.getSession(sessionId)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在', data: null })
    }

    const updated = await chatService.selectRecommend(messageId, sessionId, parseResult.data.optionId)
    res.json({ code: 200, message: 'success', data: updated })
  } catch (error: any) {
    logger.error('Failed to select recommend', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: error.message || '选择失败', data: null })
  }
}

export const dismissRecommend = async (req: Request, res: Response) => {
  try {
    const { id: sessionId, messageId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const userId = (req as any).userId as string | undefined
    if (!userId) return res.status(401).json({ code: 401, message: '未授权', data: null })

    // Validate session ownership
    const session = await chatService.getSession(sessionId)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在', data: null })
    }

    const dismissed = await chatService.dismissRecommend(messageId, sessionId)
    res.json({ code: 200, message: 'success', data: { dismissed } })
  } catch (error: any) {
    logger.error('Failed to dismiss recommend', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: error.message || '取消推荐失败', data: null })
  }
}

export const listVersions = async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const versions = await chatService.listVersions(sessionId)
    res.json({ code: 200, message: 'success', data: { versions, total: versions.length } })
  } catch (error) {
    logger.error('Failed to list versions', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取版本列表失败', data: null })
  }
}

export const createVersion = async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const parseResult = createVersionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) return res.status(401).json({ code: 401, message: '未授权', data: null })

    const version = await chatService.createVersion(sessionId, parseResult.data, userId)
    res.status(201).json({ code: 201, message: 'success', data: version })
  } catch (error: any) {
    logger.error('Failed to create version', error instanceof Error ? error : new Error(error?.message || 'unknown'))
    res.status(500).json({ code: 500, message: error.message || '创建版本失败', data: null })
  }
}

export const switchVersion = async (req: Request, res: Response) => {
  try {
    const { id: sessionId, versionId } = req.params
    if (!isValidUuid(sessionId)) {
      return res.status(400).json({ code: 400, message: `会话 ID 格式错误: "${sessionId}" 不是有效的 UUID`, data: null })
    }
    const { version, messages } = await chatService.switchVersion(sessionId, versionId)
    res.json({ code: 200, message: 'success', data: { version, messages } })
  } catch (error: any) {
    logger.error('Failed to switch version', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: error.message || '切换版本失败', data: null })
  }
}
