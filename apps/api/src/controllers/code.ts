// Code 控制器
import type { Request, Response } from 'express'
import { z } from 'zod'
import { codeDb, delay } from '../utils/database.js'
import { readFile, writeFile, readdir, stat, mkdir, rm } from 'fs/promises'
import { join, dirname, relative, resolve } from 'path'
import logger from '../utils/logger.js'

// 工作区基础路径
const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/data/workspaces'

// 获取用户工作区路径
function getUserWorkspace(userId: string, projectId?: string): string {
  if (projectId) {
    return resolve(WORKSPACE_BASE, userId, projectId)
  }
  return resolve(WORKSPACE_BASE, userId, 'default')
}

// 确保路径在工作区内（安全检查）
function isPathSafe(workspacePath: string, targetPath: string): boolean {
  const resolved = resolve(targetPath)
  return resolved.startsWith(workspacePath)
}

/**
 * 获取文件列表
 * GET /api/code/files
 */
export const getFileList = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const files = await codeDb.findAll()
    res.json({
      success: true,
      data: { files, total: files.length, path: (req.query.path as string) || '/' },
    })
  } catch (error) {
    logger.error('Get file list error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取文件列表失败' })
  }
}

/**
 * 获取文件内容
 * GET /api/code/files/:path
 */
export const getFileContent = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const filePath = '/' + req.params[0]
    const file = await codeDb.findByPath(filePath)
    if (!file) {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    res.json({
      success: true,
      data: {
        path: file.path,
        content: file.content,
        language: file.language,
        lastModified: file.last_modified,
      },
    })
  } catch (error) {
    logger.error('Get file content error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取文件内容失败' })
  }
}

const updateFileSchema = z.object({
  content: z.string(),
})

/**
 * 更新文件
 * PUT /api/code/files/:path
 */
export const updateFile = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const filePath = '/' + req.params[0]
    const parseResult = updateFileSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const existingFile = await codeDb.findByPath(filePath)
    let file
    if (existingFile) {
      file = await codeDb.update(filePath, parseResult.data.content)
    } else {
      const fileName = filePath.split('/').pop() || 'untitled'
      const language = getLanguageFromFilename(fileName)
      file = await codeDb.create({
        path: filePath,
        name: fileName,
        content: parseResult.data.content,
        language,
      })
    }
    res.json({
      success: true,
      data: {
        path: file!.path,
        content: file!.content,
        language: file!.language,
        lastModified: file!.last_modified,
      },
    })
  } catch (error) {
    logger.error('Update file error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '更新文件失败' })
  }
}

/**
 * 删除文件
 * DELETE /api/code/files/:path
 */
export const deleteFile = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const filePath = '/' + req.params[0]
    const file = await codeDb.findByPath(filePath)
    if (!file) {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    await codeDb.delete(filePath)
    res.json({ success: true, message: '文件已删除' })
  } catch (error) {
    logger.error('Delete file error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '删除文件失败' })
  }
}

/**
 * 搜索文件
 * GET /api/code/search
 */
export const searchFiles = async (req: Request, res: Response) => {
  try {
    await delay(500)
    const { query } = req.query
    if (!query) {
      return res.status(400).json({ success: false, error: '搜索关键词不能为空' })
    }
    const files = await codeDb.search(query as string)
    res.json({
      success: true,
      data: { files, total: files.length, query: query as string },
    })
  } catch (error) {
    logger.error('Search files error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '搜索文件失败' })
  }
}

/**
 * 获取最近文件
 * GET /api/code/recent
 */
export const getRecentFiles = async (req: Request, res: Response) => {
  try {
    await delay(300)
    const limit = parseInt(req.query.limit as string) || 10
    const files = await codeDb.getRecent(limit)
    res.json({
      success: true,
      data: { files, total: files.length },
    })
  } catch (error) {
    logger.error('Get recent files error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取最近文件失败' })
  }
}

/**
 * 获取工作区文件列表
 * GET /api/code/workspace/files
 */
export const getWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const { projectId, path = '' } = req.query
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getUserWorkspace(userId, projectId as string)
    const targetPath = join(workspacePath, path as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({
        success: false,
        error: '访问被拒绝：路径超出工作区范围',
      })
    }
    const entries = await readdir(targetPath, { withFileTypes: true })
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(targetPath, entry.name)
        const relativePath = relative(workspacePath, fullPath)
        const stats = await stat(fullPath)
        return {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modifiedAt: stats.mtime,
        }
      })
    )
    res.json({
      success: true,
      data: { files, path: path as string, workspace: workspacePath },
    })
  } catch (error) {
    logger.error('Get workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取工作区文件失败' })
  }
}

/**
 * 获取工作区文件内容
 * GET /api/code/workspace/files/content
 */
export const getWorkspaceFileContent = async (req: Request, res: Response) => {
  try {
    const { projectId, filePath } = req.query
    const userId = (req as any).userId || 'anonymous'
    if (!filePath) {
      return res.status(400).json({ success: false, error: '文件路径不能为空' })
    }
    const workspacePath = getUserWorkspace(userId, projectId as string)
    const targetPath = join(workspacePath, filePath as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({
        success: false,
        error: '访问被拒绝：路径超出工作区范围',
      })
    }
    const content = await readFile(targetPath, 'utf-8')
    const stats = await stat(targetPath)
    const fileName = (filePath as string).split('/').pop() || ''
    const language = getLanguageFromFilename(fileName)
    res.json({
      success: true,
      data: {
        path: filePath,
        content,
        language,
        size: stats.size,
        modifiedAt: stats.mtime,
      },
    })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    logger.error('Get workspace file content error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '获取文件内容失败' })
  }
}

const saveWorkspaceFileSchema = z.object({
  projectId: z.string().optional(),
  filePath: z.string().min(1),
  content: z.string(),
})

/**
 * 保存工作区文件
 * POST /api/code/workspace/files/save
 */
export const saveWorkspaceFile = async (req: Request, res: Response) => {
  try {
    const parseResult = saveWorkspaceFileSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const { projectId, filePath, content } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getUserWorkspace(userId, projectId)
    const targetPath = join(workspacePath, filePath)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({
        success: false,
        error: '访问被拒绝：路径超出工作区范围',
      })
    }
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, content, 'utf-8')
    const stats = await stat(targetPath)
    const fileName = filePath.split('/').pop() || ''
    res.json({
      success: true,
      data: {
        path: filePath,
        size: stats.size,
        modifiedAt: stats.mtime,
        language: getLanguageFromFilename(fileName),
      },
    })
  } catch (error) {
    logger.error('Save workspace file error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '保存文件失败' })
  }
}

/**
 * 删除工作区文件
 * DELETE /api/code/workspace/files
 */
export const deleteWorkspaceFile = async (req: Request, res: Response) => {
  try {
    const { projectId, filePath } = req.query
    const userId = (req as any).userId || 'anonymous'
    if (!filePath) {
      return res.status(400).json({ success: false, error: '文件路径不能为空' })
    }
    const workspacePath = getUserWorkspace(userId, projectId as string)
    const targetPath = join(workspacePath, filePath as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({
        success: false,
        error: '访问被拒绝：路径超出工作区范围',
      })
    }
    await rm(targetPath, { recursive: true, force: true })
    res.json({ success: true, message: '文件已删除' })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: '文件不存在' })
    }
    logger.error('Delete workspace file error', error instanceof Error ? error : undefined)
    res.status(500).json({ success: false, error: '删除文件失败' })
  }
}

// 辅助函数：根据文件名获取语言
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    vue: 'vue',
    go: 'go',
    py: 'python',
    java: 'java',
    rb: 'ruby',
    php: 'php',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
  }
  return languageMap[ext || ''] || 'text'
}
