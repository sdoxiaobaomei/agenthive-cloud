// 测试数据库工具
import { agentDb, taskDb, userDb, codeDb, smsDb } from '../../src/utils/database.js'

// 清理所有数据
export async function clearAllData() {
  // 清理 Agents
  const agents = await agentDb.findAll()
  for (const a of agents) await agentDb.delete(a.id)
  
  // 清理 Tasks
  const tasks = await taskDb.findAll()
  for (const t of tasks) await taskDb.delete(t.id)
  
  // 清理 Users
  const users = await userDb.getAll()
  for (const u of users) await userDb.delete(u.id)
  
  // 清理 Files
  const files = await codeDb.findAll()
  for (const f of files) await codeDb.delete(f.path)
  
  // 清理 SMS codes
  await smsDb.cleanExpired()
}

// 初始化默认测试数据
export async function initTestData() {
  // 创建默认测试 Agent
  await agentDb.create({
    id: 'agent-001',
    name: 'Test Agent',
    role: 'coder',
    status: 'idle',
    description: 'A test agent'
  })
  
  // 创建默认测试用户
  await userDb.create({
    id: 'user-001',
    username: 'admin',
    phone: '13800138000',
    role: 'admin'
  })
  
  // 创建默认测试任务
  await taskDb.create({
    id: 'task-001',
    title: 'Test Task',
    type: 'feature',
    status: 'pending',
    priority: 'medium'
  })
  
  // 创建默认测试文件
  await codeDb.create({
    path: '/README.md',
    name: 'README.md',
    content: '# Test Project',
    language: 'markdown'
  })
  await codeDb.create({
    path: '/main.go',
    name: 'main.go',
    content: 'package main\n\nfunc main() {}',
    language: 'go'
  })
}

// 完全重置到初始状态
export async function resetData() {
  await clearAllData()
  await initTestData()
}
