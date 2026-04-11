import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Simple async mutex for serializing git operations on the target repo
class Mutex {
  private promise: Promise<void> = Promise.resolve()

  async acquire(): Promise<() => void> {
    let release: () => void = () => {}
    const newPromise = new Promise<void>((resolve) => {
      release = resolve
    })
    const oldPromise = this.promise
    this.promise = oldPromise.then(() => newPromise)
    await oldPromise
    return release
  }
}

const stagingMutex = new Mutex()

function execGit(cwd: string, command: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function branchExists(repoPath: string, branch: string): boolean {
  try {
    execGit(repoPath, `git rev-parse --verify ${branch}`)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure a `staging` branch exists from `master` and check it out.
 * Resets `staging` to `master` for a clean start.
 */
export function initStagingBranch(targetRepoPath: string): void {
  if (!branchExists(targetRepoPath, 'staging')) {
    execGit(targetRepoPath, 'git branch staging master')
  }
  execGit(targetRepoPath, 'git checkout staging')
  execGit(targetRepoPath, 'git reset --hard master')
}

/**
 * Create a ticket branch from `staging`, copy the ticket's modified files
 * into the target repo working tree, commit, then merge into `staging`.
 * Returns the list of changed file paths (relative to repo root).
 */
export async function applyTicketToStaging(
  ticketRepoPath: string,
  targetRepoPath: string,
  ticketId: string
): Promise<string[]> {
  const release = await stagingMutex.acquire()
  try {
    const ticketBranch = `ticket/${ticketId}`

    // Ensure we are on staging
    execGit(targetRepoPath, 'git checkout staging')

    // Clean up old ticket branch if it exists
    if (branchExists(targetRepoPath, ticketBranch)) {
      execGit(targetRepoPath, `git branch -D ${ticketBranch}`)
    }

    // Create ticket branch from staging
    execGit(targetRepoPath, `git checkout -b ${ticketBranch}`)

    // Copy changed files from ticket repo to target repo
    const statusOutput = execGit(ticketRepoPath, 'git status --short').trim()
    const lines = statusOutput.split('\n').filter(Boolean)
    const changed: string[] = []

    for (const line of lines) {
      const file = line.slice(3).trim()
      changed.push(file)
      const src = path.join(ticketRepoPath, file)
      const dest = path.join(targetRepoPath, file)

      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
      } else if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
    }

    if (changed.length === 0) {
      execGit(targetRepoPath, 'git checkout staging')
      if (branchExists(targetRepoPath, ticketBranch)) {
        execGit(targetRepoPath, `git branch -D ${ticketBranch}`)
      }
      return []
    }

    // Commit on ticket branch
    execGit(targetRepoPath, 'git add -A')
    execGit(targetRepoPath, `git commit -m "feat: apply ${ticketId}"`)

    // Merge ticket branch into staging
    execGit(targetRepoPath, 'git checkout staging')
    try {
      execGit(targetRepoPath, `git merge --no-ff ${ticketBranch} -m "merge ${ticketId} into staging"`)
    } catch {
      // Rollback on merge failure
      try {
        execGit(targetRepoPath, 'git merge --abort')
      } catch {}
      if (branchExists(targetRepoPath, ticketBranch)) {
        execGit(targetRepoPath, `git branch -D ${ticketBranch}`)
      }
      throw new Error(`Failed to merge ${ticketId} into staging. Rollback performed.`)
    }

    // Clean up ticket branch
    if (branchExists(targetRepoPath, ticketBranch)) {
      execGit(targetRepoPath, `git branch -D ${ticketBranch}`)
    }

    return changed
  } finally {
    release()
  }
}

/**
 * Fast-forward `master` to `staging` after QA approval.
 */
export function syncStagingToMaster(targetRepoPath: string): void {
  execGit(targetRepoPath, 'git checkout master')
  execGit(targetRepoPath, 'git merge --ff-only staging')
}
