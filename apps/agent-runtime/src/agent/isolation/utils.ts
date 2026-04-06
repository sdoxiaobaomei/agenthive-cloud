/**
 * Isolation Utilities
 * 
 * 文件复制、路径解析、Git 操作等工具函数
 */

import { promises as fs } from 'fs'
import { resolve, relative, join, isAbsolute } from 'path'
import { spawn } from 'child_process'

/**
 * 检查路径是否在父目录内
 */
export function isPathWithinParent(childPath: string, parentPath: string): boolean {
  const resolvedChild = resolve(childPath)
  const resolvedParent = resolve(parentPath)
  return resolvedChild.startsWith(resolvedParent) || resolvedChild === resolvedParent
}

/**
 * 解析完整路径
 */
export function resolveFullPath(inputPath: string, basePath: string): string {
  if (isAbsolute(inputPath)) {
    return inputPath
  }
  return resolve(basePath, inputPath)
}

/**
 * 检查目录是否为 Git 仓库
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    const gitDir = join(path, '.git')
    const stats = await fs.stat(gitDir)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * 执行 Git 命令
 */
export function execGit(
  args: string[],
  cwd: string,
  timeout = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      shell: true,
      timeout
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code: number | null) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      })
    })

    child.on('error', (error: Error) => {
      reject(error)
    })
  })
}

/**
 * 递归复制目录
 */
export async function copyDirectory(
  src: string,
  dest: string,
  options: {
    include?: string[]
    exclude?: string[]
    preserveSymlinks?: boolean
  } = {}
): Promise<void> {
  const { exclude = [], preserveSymlinks = false } = options

  // 检查是否应该排除
  const shouldExclude = (name: string): boolean => {
    return exclude.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        return regex.test(name)
      }
      return name === pattern || name.includes(pattern)
    })
  }

  async function copyRecursive(currentSrc: string, currentDest: string): Promise<void> {
    const stats = await fs.lstat(currentSrc)
    const relativePath = relative(src, currentSrc)
    const name = relativePath.split(/[/\\]/).pop() || ''

    if (shouldExclude(name)) {
      return
    }

    if (stats.isDirectory()) {
      await fs.mkdir(currentDest, { recursive: true })
      const entries = await fs.readdir(currentSrc)
      for (const entry of entries) {
        await copyRecursive(join(currentSrc, entry), join(currentDest, entry))
      }
    } else if (stats.isSymbolicLink()) {
      if (preserveSymlinks) {
        const linkTarget = await fs.readlink(currentSrc)
        await fs.symlink(linkTarget, currentDest)
      } else {
        const targetStats = await fs.stat(currentSrc)
        if (targetStats.isDirectory()) {
          await fs.mkdir(currentDest, { recursive: true })
          const entries = await fs.readdir(currentSrc)
          for (const entry of entries) {
            await copyRecursive(join(currentSrc, entry), join(currentDest, entry))
          }
        } else {
          await fs.copyFile(currentSrc, currentDest)
        }
      }
    } else {
      await fs.copyFile(currentSrc, currentDest)
    }
  }

  await copyRecursive(src, dest)
}

/**
 * 安全删除目录
 */
export async function safeRemoveDir(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true })
  } catch (error) {
    // 忽略删除错误
    console.warn(`Failed to remove directory: ${path}`, error)
  }
}

/**
 * 生成唯一的分支/工作树名称
 */
export function generateWorktreeName(prefix = 'agent'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * 验证目录存在且可访问
 */
export async function validateDirectory(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}
