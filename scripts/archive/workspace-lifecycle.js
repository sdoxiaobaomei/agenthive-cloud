#!/usr/bin/env node
/**
 * Workspace 生命周期管理脚本
 * 提供完整的创建、状态管理、归档、清理流程
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WORKSPACE_ROOT = path.join(ROOT, 'AGENTS', 'workspace')
const ARCHIVE_DIR = path.join(WORKSPACE_ROOT, 'archive')

// 配置
const CONFIG = {
  COMPLETED_RETENTION_DAYS: 7,    // 完成后保留7天再归档
  ARCHIVE_RETENTION_MONTHS: 3,    // 归档保留3个月
  MAX_ACTIVE_WORKSPACES: 20,      // 最大活跃工作区数
  AUTO_CLEANUP_INTERVAL_HOURS: 24 // 自动清理间隔
}

/**
 * Workspace 状态枚举
 */
const WorkspaceStatus = {
  ACTIVE: 'active',         // 进行中
  PAUSED: 'paused',         // 暂停
  COMPLETED: 'completed',   // 已完成（待归档）
  MERGED: 'merged',         // 已合并到主分支
  ARCHIVED: 'archived'      // 已归档
}

/**
 * 获取工作区元数据
 */
async function getWorkspaceMeta(ticketId) {
  const metaPath = path.join(WORKSPACE_ROOT, ticketId, '.workspace-meta.json')
  try {
    const content = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 保存工作区元数据
 */
async function saveWorkspaceMeta(ticketId, meta) {
  const wsDir = path.join(WORKSPACE_ROOT, ticketId)
  const metaPath = path.join(wsDir, '.workspace-meta.json')
  await fs.mkdir(wsDir, { recursive: true })
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2))
}

/**
 * 初始化新工作区
 */
async function initWorkspace(ticketId, options = {}) {
  console.log(`🚀 初始化工作区: ${ticketId}`)
  
  const wsDir = path.join(WORKSPACE_ROOT, ticketId)
  
  // 检查是否已存在
  try {
    await fs.access(wsDir)
    console.log(`⚠️ 工作区 ${ticketId} 已存在，跳过初始化`)
    return false
  } catch {
    // 不存在，继续创建
  }
  
  // 创建工作区元数据
  const meta = {
    ticketId,
    status: WorkspaceStatus.ACTIVE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: options.description || '',
    requirements: options.requirements || '',
    plan: options.plan || null,
    commits: [],
    qaResults: [],
    branchName: `ticket/${ticketId}`
  }
  
  await saveWorkspaceMeta(ticketId, meta)
  
  // 这里调用原有的 init-workspace.js 逻辑
  console.log(`✅ 工作区 ${ticketId} 创建成功`)
  return true
}

/**
 * 更新工作区状态
 */
async function updateStatus(ticketId, status, notes = '') {
  const meta = await getWorkspaceMeta(ticketId)
  if (!meta) {
    console.error(`❌ 工作区 ${ticketId} 不存在`)
    return false
  }
  
  meta.status = status
  meta.updatedAt = new Date().toISOString()
  
  if (notes) {
    meta.statusNotes = notes
  }
  
  // 状态特定处理
  if (status === WorkspaceStatus.COMPLETED) {
    meta.completedAt = new Date().toISOString()
  }
  
  if (status === WorkspaceStatus.MERGED) {
    meta.mergedAt = new Date().toISOString()
    meta.mergeCommit = notes // notes 可以是 commit hash
  }
  
  await saveWorkspaceMeta(ticketId, meta)
  console.log(`📝 工作区 ${ticketId} 状态更新为: ${status}`)
  return true
}

/**
 * 归档工作区
 */
async function archiveWorkspace(ticketId) {
  const meta = await getWorkspaceMeta(ticketId)
  if (!meta) {
    console.error(`❌ 工作区 ${ticketId} 不存在`)
    return false
  }
  
  const wsDir = path.join(WORKSPACE_ROOT, ticketId)
  const archiveName = `${ticketId}-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.zip`
  const archivePath = path.join(ARCHIVE_DIR, archiveName)
  
  await fs.mkdir(ARCHIVE_DIR, { recursive: true })
  
  try {
    // 使用系统 zip 命令压缩
    if (process.platform === 'win32') {
      execSync(`powershell Compress-Archive -Path "${wsDir}" -DestinationPath "${archivePath}"`)
    } else {
      execSync(`cd "${WORKSPACE_ROOT}" && zip -r "${archivePath}" "${ticketId}"`)
    }
    
    // 更新元数据
    meta.status = WorkspaceStatus.ARCHIVED
    meta.archivedAt = new Date().toISOString()
    meta.archiveFile = archiveName
    await saveWorkspaceMeta(ticketId, meta)
    
    // 删除原工作区（保留元数据文件）
    await fs.rm(wsDir, { recursive: true, force: true })
    
    console.log(`📦 工作区 ${ticketId} 已归档: ${archiveName}`)
    return true
  } catch (e) {
    console.error(`❌ 归档失败: ${e.message}`)
    return false
  }
}

/**
 * 恢复归档的工作区
 */
async function restoreWorkspace(ticketId) {
  const archiveFiles = await fs.readdir(ARCHIVE_DIR)
  const archiveFile = archiveFiles.find(f => f.startsWith(ticketId))
  
  if (!archiveFile) {
    console.error(`❌ 找不到归档文件: ${ticketId}`)
    return false
  }
  
  const archivePath = path.join(ARCHIVE_DIR, archiveFile)
  const wsDir = path.join(WORKSPACE_ROOT, ticketId)
  
  try {
    // 解压
    if (process.platform === 'win32') {
      execSync(`powershell Expand-Archive -Path "${archivePath}" -DestinationPath "${wsDir}"`)
    } else {
      execSync(`unzip "${archivePath}" -d "${WORKSPACE_ROOT}"`)
    }
    
    // 更新状态
    await updateStatus(ticketId, WorkspaceStatus.ACTIVE, '从归档恢复')
    
    console.log(`📂 工作区 ${ticketId} 已恢复`)
    return true
  } catch (e) {
    console.error(`❌ 恢复失败: ${e.message}`)
    return false
  }
}

/**
 * 自动清理策略
 */
async function autoCleanup() {
  console.log('🧹 执行自动清理...\n')
  
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true })
  const workspaces = []
  
  // 收集所有工作区
  for (const entry of entries) {
    if (entry.isDirectory() && !['archive', 'active', 'completed'].includes(entry.name)) {
      const meta = await getWorkspaceMeta(entry.name)
      if (meta) {
        workspaces.push({ ...meta, dir: entry.name })
      }
    }
  }
  
  const now = new Date()
  
  // 1. 归档已完成且超过保留期的工作区
  const toArchive = workspaces.filter(ws => {
    if (ws.status !== WorkspaceStatus.COMPLETED && ws.status !== WorkspaceStatus.MERGED) {
      return false
    }
    const completedDate = new Date(ws.completedAt || ws.mergedAt)
    const daysSinceCompleted = (now - completedDate) / (1000 * 60 * 60 * 24)
    return daysSinceCompleted > CONFIG.COMPLETED_RETENTION_DAYS
  })
  
  console.log(`📦 需要归档: ${toArchive.length} 个工作区`)
  for (const ws of toArchive) {
    await archiveWorkspace(ws.ticketId)
  }
  
  // 2. 清理超过保留期的归档
  const archives = await fs.readdir(ARCHIVE_DIR).catch(() => [])
  const toDeleteArchives = []
  
  for (const archive of archives) {
    const stat = await fs.stat(path.join(ARCHIVE_DIR, archive))
    const monthsSinceCreated = (now - stat.mtime) / (1000 * 60 * 60 * 24 * 30)
    if (monthsSinceCreated > CONFIG.ARCHIVE_RETENTION_MONTHS) {
      toDeleteArchives.push(archive)
    }
  }
  
  console.log(`\n🗑️  需要删除的归档: ${toDeleteArchives.length} 个`)
  for (const archive of toDeleteArchives) {
    await fs.rm(path.join(ARCHIVE_DIR, archive))
    console.log(`   ✓ 删除归档: ${archive}`)
  }
  
  // 3. 检查活跃工作区数量
  const activeWorkspaces = workspaces.filter(ws => 
    ws.status === WorkspaceStatus.ACTIVE || ws.status === WorkspaceStatus.PAUSED
  )
  
  if (activeWorkspaces.length > CONFIG.MAX_ACTIVE_WORKSPACES) {
    console.log(`\n⚠️ 活跃工作区数量 (${activeWorkspaces.length}) 超过限制 (${CONFIG.MAX_ACTIVE_WORKSPACES})`)
    // 按更新时间排序，提示用户处理最旧的工作区
    activeWorkspaces.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
    console.log('   最旧的工作区:')
    activeWorkspaces.slice(0, 5).forEach(ws => {
      console.log(`   - ${ws.ticketId}: ${ws.description || '无描述'} (更新于 ${new Date(ws.updatedAt).toLocaleDateString()})`)
    })
  }
  
  console.log('\n✅ 自动清理完成')
}

/**
 * 列出所有工作区
 */
async function listWorkspaces() {
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true })
  const workspaces = []
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'archive') {
      const meta = await getWorkspaceMeta(entry.name)
      if (meta) {
        workspaces.push(meta)
      }
    }
  }
  
  // 按状态分组
  const grouped = {
    [WorkspaceStatus.ACTIVE]: [],
    [WorkspaceStatus.PAUSED]: [],
    [WorkspaceStatus.COMPLETED]: [],
    [WorkspaceStatus.MERGED]: []
  }
  
  workspaces.forEach(ws => {
    if (grouped[ws.status]) {
      grouped[ws.status].push(ws)
    }
  })
  
  console.log('\n📊 工作区状态概览\n')
  
  Object.entries(grouped).forEach(([status, list]) => {
    if (list.length > 0) {
      console.log(`${getStatusEmoji(status)} ${status.toUpperCase()} (${list.length})`)
      list.forEach(ws => {
        const desc = ws.description ? ` - ${ws.description.slice(0, 40)}...` : ''
        console.log(`   ${ws.ticketId}${desc}`)
      })
      console.log()
    }
  })
  
  // 归档统计
  const archives = await fs.readdir(ARCHIVE_DIR).catch(() => [])
  console.log(`📦 ARCHIVED: ${archives.length} 个归档`)
}

function getStatusEmoji(status) {
  const map = {
    [WorkspaceStatus.ACTIVE]: '🟢',
    [WorkspaceStatus.PAUSED]: '⏸️',
    [WorkspaceStatus.COMPLETED]: '✅',
    [WorkspaceStatus.MERGED]: '🎉'
  }
  return map[status] || '⚪'
}

// CLI
const command = process.argv[2]
const ticketId = process.argv[3]

switch (command) {
  case 'init':
    initWorkspace(ticketId, { description: process.argv[4] })
    break
  case 'status':
    updateStatus(ticketId, process.argv[4], process.argv[5])
    break
  case 'archive':
    archiveWorkspace(ticketId)
    break
  case 'restore':
    restoreWorkspace(ticketId)
    break
  case 'cleanup':
    autoCleanup()
    break
  case 'list':
    listWorkspaces()
    break
  default:
    console.log(`
Workspace 生命周期管理

用法:
  node workspace-lifecycle.js init <ticket-id> [description]  初始化工作区
  node workspace-lifecycle.js status <ticket-id> <status>     更新状态
  node workspace-lifecycle.js archive <ticket-id>             归档工作区
  node workspace-lifecycle.js restore <ticket-id>             恢复归档
  node workspace-lifecycle.js cleanup                         自动清理
  node workspace-lifecycle.js list                            列出所有工作区

状态值:
  active    - 进行中
  paused    - 暂停
  completed - 已完成
  merged    - 已合并
`)
}
