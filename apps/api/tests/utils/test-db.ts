// 测试数据库工具
import { agentDb, taskDb, userDb } from '../../src/db/index'

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
  
  // 创建默认测试用户（测试环境用简单哈希，不走 bcrypt 原生模块）
  const passwordHash = '$2b$10$testhash_not_for_production'
  await userDb.create({
    id: 'user-001',
    username: 'admin',
    email: 'admin@test.local',
    phone: '13800138000',
    role: 'admin',
    password_hash: passwordHash,
  })
  
  // 创建默认测试任务
  await taskDb.create({
    id: 'task-001',
    title: 'Test Task',
    type: 'feature',
    status: 'pending',
    priority: 'medium'
  })
}

// 完全重置到初始状态
export async function resetData() {
  await clearAllData()
  await initTestData()
}
