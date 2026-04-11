import { execSync } from 'child_process'
import path from 'path'

export function gitDiff(repoPath: string, target: string = 'HEAD'): string {
  try {
    return execSync(`git diff ${target}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return ''
  }
}

export function gitStatus(repoPath: string): string {
  try {
    return execSync('git status --short', {
      cwd: repoPath,
      encoding: 'utf-8',
    })
  } catch {
    return ''
  }
}

export function gitAdd(repoPath: string, filePattern = '.'): void {
  execSync(`git add "${filePattern}"`, { cwd: repoPath, encoding: 'utf-8' })
}

export function gitCommit(repoPath: string, message: string): void {
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
    cwd: repoPath,
    encoding: 'utf-8',
  })
}

export function gitBranchName(repoPath: string): string {
  return execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: repoPath,
    encoding: 'utf-8',
  }).trim()
}

export function gitHasChanges(repoPath: string): boolean {
  const status = gitStatus(repoPath)
  return status.trim().length > 0
}
