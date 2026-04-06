// API 服务器入口
import app from './app.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`
🚀 AgentHive API Server started!

📡 Server: http://localhost:${PORT}
📚 API Docs: http://localhost:${PORT}/api/health

Available endpoints:
  - POST /api/auth/sms/send      发送短信验证码
  - POST /api/auth/login/sms     短信验证码登录
  - POST /api/auth/login         用户名密码登录
  - POST /api/auth/register      用户注册
  - POST /api/auth/logout        用户登出
  - POST /api/auth/refresh       刷新 Token
  - GET  /api/auth/me            获取当前用户
  
  - GET  /api/agents             Agent 列表
  - POST /api/agents             创建 Agent
  - GET  /api/agents/:id         Agent 详情
  - PATCH /api/agents/:id        更新 Agent
  - DELETE /api/agents/:id       删除 Agent
  - POST /api/agents/:id/start   启动 Agent
  - POST /api/agents/:id/stop    停止 Agent
  - POST /api/agents/:id/pause   暂停 Agent
  - POST /api/agents/:id/resume  恢复 Agent
  - POST /api/agents/:id/command 发送命令
  - GET  /api/agents/:id/logs    获取日志
  
  - GET  /api/tasks              任务列表
  - POST /api/tasks              创建任务
  - GET  /api/tasks/:id          任务详情
  - PATCH /api/tasks/:id         更新任务
  - DELETE /api/tasks/:id        删除任务
  - POST /api/tasks/:id/cancel   取消任务
  - GET  /api/tasks/:id/subtasks 获取子任务
  
  - GET  /api/code/files         文件列表
  - GET  /api/code/files/*       文件内容
  - PUT  /api/code/files/*       更新文件
  - DELETE /api/code/files/*     删除文件
  - GET  /api/code/search        搜索文件
  - GET  /api/code/recent        最近文件
  
  - GET  /api/demo/plan          示例计划
  - GET  /api/demo/agents        示例 Agents
  - GET  /api/demo/tasks         示例任务
  - GET  /api/demo/visitor-status 访客状态
  
  - GET  /api/health             健康检查
  `)
})
