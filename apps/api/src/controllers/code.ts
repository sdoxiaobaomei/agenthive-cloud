// Code 控制器
import type { Request, Response } from 'express'
import { z } from 'zod'
// Workspace file operations only - database-backed code files removed
import { readFile, writeFile, readdir, stat, mkdir, rm, rename, access } from 'fs/promises'
import { createReadStream } from 'fs'
import { join, dirname, relative, resolve } from 'path'
import { exec } from 'child_process'
import multer from 'multer'
import logger from '../utils/logger.js'
import { getWorkspacePath } from '../config/workspace.js'

// 确保路径在工作区内（安全检查）
function isPathSafe(workspacePath: string, targetPath: string): boolean {
  const resolvedWorkspace = resolve(workspacePath)
  const resolvedTarget = resolve(targetPath)
  // Windows: 不同盘符直接拒绝
  if (process.platform === 'win32') {
    const w = resolvedWorkspace.charAt(0).toUpperCase()
    const t = resolvedTarget.charAt(0).toUpperCase()
    if (w !== t) return false
  }
  const rel = relative(resolvedWorkspace, resolvedTarget)
  return !rel.startsWith('..') && rel !== '..'
}

/**
 * 获取工作区文件列表
 * GET /api/code/workspace/files
 */
export const getWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const { projectId, path = '' } = req.query
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId as string)
    const targetPath = join(workspacePath, path as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
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
    res.json({ code: 200, message: 'success', data: { files, path: path as string, workspace: workspacePath },
    })
  } catch (error) {
    logger.error('Get workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取工作区文件失败' , data: null })
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
      return res.status(400).json({ code: 400, message: '文件路径不能为空' , data: null })
    }
    const workspacePath = getWorkspacePath(userId, projectId as string)
    const targetPath = join(workspacePath, filePath as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    const content = await readFile(targetPath, 'utf-8')
    const stats = await stat(targetPath)
    const fileName = (filePath as string).split('/').pop() || ''
    const language = getLanguageFromFilename(fileName)
    res.json({ code: 200, message: 'success', data: {
        path: filePath,
        content,
        language,
        size: stats.size,
        modifiedAt: stats.mtime,
      },
    })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ code: 404, message: '文件不存在' , data: null })
    }
    logger.error('Get workspace file content error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '获取文件内容失败' , data: null })
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
      return res.status(400).json({ code: 400, message: '参数校验失败',
        details: parseResult.error.format(),
      })
    }
    const { projectId, filePath, content } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)
    const targetPath = join(workspacePath, filePath)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, content, 'utf-8')
    const stats = await stat(targetPath)
    const fileName = filePath.split('/').pop() || ''
    res.json({ code: 200, message: 'success', data: {
        path: filePath,
        size: stats.size,
        modifiedAt: stats.mtime,
        language: getLanguageFromFilename(fileName),
      },
    })
  } catch (error) {
    logger.error('Save workspace file error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '保存文件失败' , data: null })
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
      return res.status(400).json({ code: 400, message: '文件路径不能为空' , data: null })
    }
    const workspacePath = getWorkspacePath(userId, projectId as string)
    const targetPath = join(workspacePath, filePath as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    await rm(targetPath, { recursive: true, force: true })
    res.json({ code: 200, message: '文件已删除', data: null })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ code: 404, message: '文件不存在' , data: null })
    }
    logger.error('Delete workspace file error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '删除文件失败' , data: null })
  }
}

// ============ Multer 上传配置 ============
const BLOCKED_EXTS = ['.exe', '.bat', '.cmd', '.sh', '.dll', '.so']

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 单文件 10MB
  },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
    if (BLOCKED_EXTS.includes(ext)) {
      return cb(new Error(`禁止上传可执行文件: ${ext}`))
    }
    cb(null, true)
  },
})

// ============ Workspace Mkdir ============
const mkdirSchema = z.object({
  projectId: z.string().optional(),
  path: z.string().min(1),
})

export const mkdirWorkspace = async (req: Request, res: Response) => {
  try {
    const parseResult = mkdirSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }
    const { projectId, path: dirPath } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)
    const targetPath = join(workspacePath, dirPath)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    await mkdir(targetPath, { recursive: true })
    logger.info('Workspace directory created', { userId, projectId, path: dirPath })
    res.json({ code: 200, message: '目录已创建', data: { path: dirPath } })
  } catch (error) {
    logger.error('Create workspace directory error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '创建目录失败', data: null })
  }
}

// ============ Workspace Rename ============
const renameSchema = z.object({
  projectId: z.string().optional(),
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
})

export const renameWorkspace = async (req: Request, res: Response) => {
  try {
    const parseResult = renameSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }
    const { projectId, oldPath, newPath } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)
    const oldFullPath = join(workspacePath, oldPath)
    const newFullPath = join(workspacePath, newPath)
    if (!isPathSafe(workspacePath, oldFullPath) || !isPathSafe(workspacePath, newFullPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    // 目标已存在时返回 409
    try {
      await stat(newFullPath)
      return res.status(409).json({ code: 409, message: '目标路径已存在', data: null })
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
    await rename(oldFullPath, newFullPath)
    logger.info('Workspace renamed', { userId, projectId, oldPath, newPath })
    res.json({ code: 200, message: '重命名成功', data: { oldPath, newPath } })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ code: 404, message: '源路径不存在', data: null })
    }
    logger.error('Rename workspace error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '重命名失败', data: null })
  }
}

// ============ Workspace Move ============
const moveSchema = z.object({
  projectId: z.string().optional(),
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
})

export const moveWorkspace = async (req: Request, res: Response) => {
  try {
    const parseResult = moveSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }
    const { projectId, sourcePath, targetPath: destPath } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)
    const sourceFullPath = join(workspacePath, sourcePath)
    const destFullPath = join(workspacePath, destPath)
    if (!isPathSafe(workspacePath, sourceFullPath) || !isPathSafe(workspacePath, destFullPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    // 目标已存在时返回 409
    try {
      await stat(destFullPath)
      return res.status(409).json({ code: 409, message: '目标路径已存在', data: null })
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
    await rename(sourceFullPath, destFullPath)
    logger.info('Workspace moved', { userId, projectId, sourcePath, destPath })
    res.json({ code: 200, message: '移动成功', data: { sourcePath, targetPath: destPath } })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ code: 404, message: '源路径不存在', data: null })
    }
    logger.error('Move workspace error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '移动失败', data: null })
  }
}

// ============ Workspace Upload ============
export const uploadWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const { projectId, path: uploadPath = '' } = req.body
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)
    const targetDir = join(workspacePath, uploadPath)
    if (!isPathSafe(workspacePath, targetDir)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    await mkdir(targetDir, { recursive: true })

    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ code: 400, message: '未上传任何文件', data: null })
    }

    const results = []
    for (const file of files) {
      const destPath = join(targetDir, file.originalname)
      if (!isPathSafe(workspacePath, destPath)) {
        return res.status(403).json({ code: 403, message: `文件路径不安全: ${file.originalname}`, data: null })
      }
      await writeFile(destPath, file.buffer)
      results.push({
        name: file.originalname,
        path: join(uploadPath, file.originalname).replace(/\\/g, '/'),
        size: file.size,
      })
    }
    logger.info('Workspace files uploaded', { userId, projectId, count: results.length })
    res.json({ code: 200, message: '上传成功', data: { files: results, count: results.length } })
  } catch (error) {
    logger.error('Upload workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '上传失败', data: null })
  }
}

// ============ Workspace Batch Delete ============
const batchDeleteSchema = z.object({
  projectId: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).max(100),
})

export const batchDeleteWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const parseResult = batchDeleteSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }
    const { projectId, paths } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)

    const succeeded: string[] = []
    const failed: Array<{ path: string; error: string }> = []

    for (const p of paths) {
      const targetPath = join(workspacePath, p)
      if (!isPathSafe(workspacePath, targetPath)) {
        failed.push({ path: p, error: '路径超出工作区范围' })
        continue
      }
      try {
        await rm(targetPath, { recursive: true, force: true })
        succeeded.push(p)
      } catch (e: any) {
        failed.push({ path: p, error: e.code === 'ENOENT' ? '文件不存在' : e.message })
      }
    }

    logger.info('Workspace batch delete', { userId, projectId, succeeded: succeeded.length, failed: failed.length })
    res.json({
      code: 200,
      message: 'success',
      data: { succeeded, failed, total: paths.length },
    })
  } catch (error) {
    logger.error('Batch delete workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '批量删除失败', data: null })
  }
}

// ============ Workspace Batch Move ============
const batchMoveSchema = z.object({
  projectId: z.string().optional(),
  operations: z.array(
    z.object({
      sourcePath: z.string().min(1),
      targetPath: z.string().min(1),
    })
  ).min(1).max(50),
})

export const batchMoveWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const parseResult = batchMoveSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ code: 400, message: '参数校验失败', details: parseResult.error.format() })
    }
    const { projectId, operations } = parseResult.data
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId)

    const succeeded: Array<{ sourcePath: string; targetPath: string }> = []
    const failed: Array<{ sourcePath: string; targetPath: string; error: string }> = []

    for (const op of operations) {
      const sourceFullPath = join(workspacePath, op.sourcePath)
      const targetFullPath = join(workspacePath, op.targetPath)

      if (!isPathSafe(workspacePath, sourceFullPath) || !isPathSafe(workspacePath, targetFullPath)) {
        failed.push({ ...op, error: '路径超出工作区范围' })
        continue
      }

      // 目标已存在则跳过
      try {
        await stat(targetFullPath)
        failed.push({ ...op, error: '目标路径已存在' })
        continue
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          failed.push({ ...op, error: e.message })
          continue
        }
      }

      try {
        await rename(sourceFullPath, targetFullPath)
        succeeded.push(op)
      } catch (e: any) {
        failed.push({ ...op, error: e.code === 'ENOENT' ? '源路径不存在' : e.message })
      }
    }

    logger.info('Workspace batch move', { userId, projectId, succeeded: succeeded.length, failed: failed.length })
    res.json({
      code: 200,
      message: 'success',
      data: { succeeded, failed, total: operations.length },
    })
  } catch (error) {
    logger.error('Batch move workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '批量移动失败', data: null })
  }
}

// ============ Workspace Search ============
async function searchWorkspaceRecursive(
  dir: string,
  workspacePath: string,
  query: string,
  results: Array<{ name: string; path: string; type: string; size: number; modifiedAt: Date }>
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  const lowerQuery = query.toLowerCase()

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    const relPath = relative(workspacePath, fullPath).replace(/\\/g, '/')
    const nameMatch = entry.name.toLowerCase().includes(lowerQuery)

    if (entry.isDirectory()) {
      if (nameMatch) {
        const stats = await stat(fullPath)
        results.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          size: 0,
          modifiedAt: stats.mtime,
        })
      }
      await searchWorkspaceRecursive(fullPath, workspacePath, query, results)
    } else if (nameMatch) {
      const stats = await stat(fullPath)
      results.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size: stats.size,
        modifiedAt: stats.mtime,
      })
    }
  }
}

export const searchWorkspaceFiles = async (req: Request, res: Response) => {
  try {
    const { projectId, query } = req.query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ code: 400, message: '搜索关键词不能为空', data: null })
    }
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId as string)

    const results: Array<{ name: string; path: string; type: string; size: number; modifiedAt: Date }> = []
    try {
      await searchWorkspaceRecursive(workspacePath, workspacePath, query.trim(), results)
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ code: 404, message: '工作区不存在', data: null })
      }
      throw e
    }

    logger.info('Workspace search', { userId, projectId, query: query.trim(), results: results.length })
    res.json({
      code: 200,
      message: 'success',
      data: { files: results, total: results.length, query: query.trim() },
    })
  } catch (error) {
    logger.error('Search workspace files error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '搜索失败', data: null })
  }
}

// ============ Workspace Download ============
export const downloadWorkspaceFile = async (req: Request, res: Response) => {
  try {
    const { projectId, path: filePath } = req.query
    if (!filePath) {
      return res.status(400).json({ code: 400, message: '文件路径不能为空', data: null })
    }
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId as string)
    const targetPath = join(workspacePath, filePath as string)
    if (!isPathSafe(workspacePath, targetPath)) {
      return res.status(403).json({ code: 403, message: '访问被拒绝：路径超出工作区范围', data: null })
    }
    const fileStats = await stat(targetPath)
    if (fileStats.isDirectory()) {
      return res.status(400).json({ code: 400, message: '不能下载目录', data: null })
    }
    const fileName = (filePath as string).split('/').pop() || 'download'
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Type', 'application/octet-stream')
    createReadStream(targetPath).pipe(res)
    logger.info('Workspace file downloaded', { userId, projectId, path: filePath })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ code: 404, message: '文件不存在', data: null })
    }
    logger.error('Download workspace file error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '下载失败', data: null })
  }
}

// ============ Workspace Git Status ============

interface GitStatusResult {
  branch: string
  commit: string
  modified: string[]
  untracked: string[]
  staged: string[]
  ahead: number | null
  behind: number | null
  isGitRepo: boolean
}

function execAsync(command: string, options?: { cwd?: string; timeout?: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      const out = typeof stdout === 'string' ? stdout : stdout.toString()
      const err = typeof stderr === 'string' ? stderr : stderr.toString()
      if (error) reject(error)
      else resolve({ stdout: out.replace(/\r?\n$/, ''), stderr: err.replace(/\r?\n$/, '') })
    })
  })
}

function parseGitStatusPorcelain(stdout: string): Pick<GitStatusResult, 'modified' | 'untracked' | 'staged'> {
  const modified: string[] = []
  const untracked: string[] = []
  const staged: string[] = []

  for (const line of stdout.split('\n')) {
    if (line.length < 4) continue
    const x = line[0]
    const y = line[1]
    const pathPart = line.slice(3)

    if (x === '?' && y === '?') {
      untracked.push(pathPart)
      continue
    }

    const isStaged = x !== ' ' && x !== '?'
    const isModified = y === 'M' || y === 'D'
    const isStagedChange = x === 'M' || x === 'A' || x === 'D' || x === 'R'

    if (isStaged && isStagedChange) {
      staged.push(pathPart)
    }
    if (isModified) {
      modified.push(pathPart)
    } else if (x === 'M' || x === 'D') {
      // 已暂存的修改也视为 modified
      if (!modified.includes(pathPart)) modified.push(pathPart)
    }
  }

  return { modified, untracked, staged }
}

export const getWorkspaceGitStatus = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query
    const userId = (req as any).userId || 'anonymous'
    const workspacePath = getWorkspacePath(userId, projectId as string)

    // 检查是否是 git 仓库
    const gitDir = join(workspacePath, '.git')
    try {
      await access(gitDir)
    } catch {
      return res.status(400).json({ code: 400, message: '工作区不是 Git 仓库', data: null })
    }

    // 获取当前分支
    let branch = ''
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: workspacePath, timeout: 10000 })
      branch = stdout
    } catch {
      branch = ''
    }

    // 获取当前 commit
    let commit = ''
    try {
      const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: workspacePath, timeout: 10000 })
      commit = stdout
    } catch {
      commit = ''
    }

    // 获取文件状态
    let modified: string[] = []
    let untracked: string[] = []
    let staged: string[] = []
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: workspacePath, timeout: 10000 })
      const parsed = parseGitStatusPorcelain(stdout)
      modified = parsed.modified
      untracked = parsed.untracked
      staged = parsed.staged
    } catch {
      // ignore
    }

    // 获取 ahead/behind
    let ahead: number | null = null
    let behind: number | null = null
    try {
      const { stdout: aheadStr } = await execAsync('git rev-list --count HEAD..@{upstream}', { cwd: workspacePath, timeout: 10000 })
      behind = parseInt(aheadStr, 10) || 0
    } catch {
      behind = null
    }
    try {
      const { stdout: behindStr } = await execAsync('git rev-list --count @{upstream}..HEAD', { cwd: workspacePath, timeout: 10000 })
      ahead = parseInt(behindStr, 10) || 0
    } catch {
      ahead = null
    }

    const result: GitStatusResult = {
      branch,
      commit,
      modified,
      untracked,
      staged,
      ahead,
      behind,
      isGitRepo: true,
    }

    logger.info('Workspace git status queried', { userId, projectId, branch, commit })
    res.json({ code: 200, message: 'success', data: result })
  } catch (error) {
    logger.error('Get workspace git status error', error instanceof Error ? error : undefined)
    res.status(500).json({ code: 500, message: '查询 Git 状态失败', data: null })
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
