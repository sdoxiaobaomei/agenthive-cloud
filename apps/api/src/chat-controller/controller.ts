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
      title: parseResult.data.title,
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
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    // Add user message
    await chatService.addMessage(id, 'user', parseResult.data.content)

    // Classify intent
    const { intent } = await chatService.classifyIntent(parseResult.data.content)

    // Add system message about detected intent
    await chatService.addMessage(id, 'system', `检测到意图: ${intent}`, { intent })

    // Submit Agent tasks asynchronously via queue (does not wait for completion)
    let tasks: Awaited<ReturnType<typeof chatService.executeAgentTask>> = []
    if (intent !== 'chat' && intent !== 'explain') {
      tasks = await chatService.executeAgentTask(id, intent, parseResult.data.content)
    }

    // Generate assistant response (based on created tickets, not execution result)
    const responseContent = await chatService.generateReply(id, intent, parseResult.data.content, tasks)
    const assistantMsg = await chatService.addMessage(id, 'assistant', responseContent, {
      intent,
      tickets: tasks.map((t) => ({
        id: t.ticketId,
        role: t.workerRole,
        task: t.ticketId,
        status: t.status,
      })),
    })

    res.json({ code: 200, message: 'success', data: {
        message: assistantMsg,
        intent,
        tasks,
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50))

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const { messages, total } = await chatService.getSessionMessages(id, page, pageSize)
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
    const parseResult = sendMessageSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }

    const session = await chatService.getSession(id)
    if (!session) {
      return res.status(404).json({ code: 404, message: '会话不存在' , data: null })
    }

    const { intent } = await chatService.classifyIntent(parseResult.data.content)
    const tasks = await chatService.executeAgentTask(id, intent, parseResult.data.content)

    res.json({ code: 200, message: 'success', data: { intent, tasks } })
  } catch (error) {
    logger.error('Failed to execute task', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '执行任务失败' , data: null })
  }
}

export const getTasks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
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
    const progress = await chatService.getTaskProgress(id)
    res.json({ code: 200, message: 'success', data: progress })
  } catch (error) {
    logger.error('Failed to get progress', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取进度失败' , data: null })
  }
}


