// 测试数据库工具
import { agentDb, taskDb, userDb, codeDb, smsDb } from '../../src/utils/database.js'

// 保存初始数据状态
const initialAgents = JSON.stringify(agentDb.findAll())
const initialTasks = JSON.stringify(taskDb.findAll())
const initialUsers = JSON.stringify(userDb.getAll())
const initialFiles = JSON.stringify(codeDb.findAll())

// 清理所有数据
export function clearAllData() {
  // 清理 Agents
  const agents = agentDb.findAll()
  agents.forEach(a => agentDb.delete(a.id))
  
  // 清理 Tasks
  const tasks = taskDb.findAll()
  tasks.forEach(t => taskDb.delete(t.id))
  
  // 清理 Users
  const users = userDb.getAll()
  users.forEach(u => userDb.delete(u.id))
  
  // 清理 Files
  const files = codeDb.findAll()
  files.forEach(f => codeDb.delete(f.path))
  
  // 清理 SMS codes
  smsDb.cleanExpired()
}

// 初始化测试数据
export function initTestData() {
  // 恢复初始数据
  const agents = JSON.parse(initialAgents)
  agents.forEach((a: any) => agentDb.create({ ...a, id: a.id }))
  
  const tasks = JSON.parse(initialTasks)
  tasks.forEach((t: any) => taskDb.create({ ...t, id: t.id }))
  
  const users = JSON.parse(initialUsers)
  users.forEach((u: any) => userDb.create({ ...u, id: u.id }))
  
  const files = JSON.parse(initialFiles)
  files.forEach((f: any) => codeDb.create({ ...f, path: f.path }))
}

// 完全重置到初始状态
export function resetData() {
  clearAllData()
  initTestData()
}
