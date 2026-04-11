#!/usr/bin/env node
/**
 * 工作区清理脚本
 * 自动清理旧ticket的工作区，保留最近 N 个
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_DIR = path.join(__dirname, '..', 'AGENTS', 'workspace')

const KEEP_COUNT = 10  // 保留最近10个ticket

async function cleanupWorkspaces() {
  console.log('🧹 开始清理工作区...\n')
  
  try {
    const entries = await fs.readdir(WORKSPACE_DIR, { withFileTypes: true })
    const workspaces = []
    
    // 收集所有工作区
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const stat = await fs.stat(path.join(WORKSPACE_DIR, entry.name))
        workspaces.push({
          name: entry.name,
          mtime: stat.mtime
        })
      }
    }
    
    // 按修改时间排序（最新的在前）
    workspaces.sort((a, b) => b.mtime - a.mtime)
    
    console.log(`📊 发现 ${workspaces.length} 个工作区`)
    console.log(`💾 保留策略: 最近 ${KEEP_COUNT} 个\n`)
    
    // 保留的
    const keepList = workspaces.slice(0, KEEP_COUNT)
    console.log('✅ 保留的工作区:')
    keepList.forEach(w => console.log(`   - ${w.name} (${w.mtime.toLocaleDateString()})`))
    
    // 删除的
    const deleteList = workspaces.slice(KEEP_COUNT)
    if (deleteList.length > 0) {
      console.log(`\n🗑️  删除的工作区 (${deleteList.length} 个):`)
      
      for (const ws of deleteList) {
        const wsPath = path.join(WORKSPACE_DIR, ws.name)
        try {
          await fs.rm(wsPath, { recursive: true, force: true })
          console.log(`   ✓ ${ws.name}`)
        } catch (e) {
          console.log(`   ✗ ${ws.name} - ${e.message}`)
        }
      }
    } else {
      console.log('\n✨ 没有需要清理的工作区')
    }
    
    console.log('\n🎉 清理完成!')
    
  } catch (e) {
    console.error('❌ 清理失败:', e.message)
    process.exit(1)
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupWorkspaces()
}

export { cleanupWorkspaces }
