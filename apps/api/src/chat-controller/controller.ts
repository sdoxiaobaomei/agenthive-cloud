/**
 * Chat Controller - REST endpoints for chat sessions
 */

import type { Request, Response } from 'express'
import { z } from 'zod'
import { chatService } from './service.js'
import logger from '../utils/logger.js'

const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
})

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const createSession = async (req: Request, res: Response) => {
  try {
    const parseResult = createSessionSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' })
    }

    const session = await chatService.createSession({
      userId,
      projectId: parseResult.data.projectId,
      title: parseResult.data.title,
    })

    res.status(201).json({ success: true, data: session })
  } catch (error) {
    logger.error('Failed to create chat session', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '创建会话失败' })
  }
}

export const listSessions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' })
    }

    const sessions = await chatService.listSessions(userId)
    res.json({ success: true, data: { items: sessions, total: sessions.length } })
  } catch (error) {
    logger.error('Failed to list chat sessions', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取会话列表失败' })
  }
}

export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' })
    }
    res.json({ success: true, data: session })
  } catch (error) {
    logger.error('Failed to get chat session', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取会话详情失败' })
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' })
    }

    // Add user message
    await chatService.addMessage(id, 'user', parseResult.data.content)

    // Classify intent
    const { intent } = await chatService.classifyIntent(parseResult.data.content)

    // Add system message about detected intent
    await chatService.addMessage(id, 'system', `检测到意图: ${intent}`, { intent })

    // If intent is actionable, spawn agent tasks
    let tasks: Awaited<ReturnType<typeof chatService.executeAgentTask>> = []
    if (intent !== 'chat' && intent !== 'explain') {
      tasks = await chatService.executeAgentTask(id, intent, parseResult.data.content)
    }

    // Add assistant response
    const responseContent = buildResponse(intent, tasks)
    const assistantMsg = await chatService.addMessage(id, 'assistant', responseContent, {
      intent,
      tickets: tasks.map((t) => ({
        id: t.ticketId,
        role: t.workerRole,
        task: t.ticketId,
        status: t.status,
      })),
    })

    res.json({
      success: true,
      data: {
        message: assistantMsg,
        intent,
        tasks,
      },
    })
  } catch (error) {
    logger.error('Failed to send message', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '发送消息失败' })
  }
}

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50))

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' })
    }

    const { messages, total } = await chatService.getSessionMessages(id, page, pageSize)
    res.json({
      success: true,
      data: {
        messages,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    logger.error('Failed to get messages', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取消息列表失败' })
  }
}

export const executeTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' })
    }

    const { intent } = await chatService.classifyIntent(parseResult.data.content)
    const tasks = await chatService.executeAgentTask(id, intent, parseResult.data.content)

    res.json({ success: true, data: { intent, tasks } })
  } catch (error) {
    logger.error('Failed to execute task', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '执行任务失败' })
  }
}

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' })
    }

    const tasks = await chatService.getSessionTasks(id)
    res.json({ success: true, data: { tasks, total: tasks.length } })
  } catch (error) {
    logger.error('Failed to get tasks', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取任务列表失败' })
  }
}

export const getProgress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const progress = await chatService.getTaskProgress(id)
    res.json({ success: true, data: progress })
  } catch (error) {
    logger.error('Failed to get progress', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取进度失败' })
  }
}

function buildResponse(intent: string, tasks: Array<{ ticketId: string; workerRole: string; status: string }>): string {
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
