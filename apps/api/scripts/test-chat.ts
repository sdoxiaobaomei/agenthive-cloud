/**
 * End-to-end Chat Controller test
 *
 * Run: cd apps/api && npx tsx scripts/test-chat.ts
 */

import { pool } from '../src/config/database.js'
import { chatService } from '../src/chat-controller/service.js'
import { jwt } from '../src/utils/jwt.js'
import { userDb } from '../src/utils/database.js'

async function main() {
  console.log('[TestChat] Starting end-to-end chat test...')

  // Ensure we have a test user
  let user = await userDb.findByUsername('test_chat_user')
  if (!user) {
    user = await userDb.create({
      username: 'test_chat_user',
      role: 'user',
    })
    console.log('[TestChat] Created test user:', user.id)
  }

  // 1. Create session
  console.log('[TestChat] 1. Creating session...')
  const session = await chatService.createSession({
    userId: user.id,
    title: 'E2E Test Session',
  })
  console.log('[TestChat] Session created:', session.id)

  // 2. Send message "create a todo app"
  console.log('[TestChat] 2. Sending message: "create a todo app"...')
  await chatService.addMessage(session.id, 'user', 'create a todo app')

  // 3. Classify intent
  const { intent } = await chatService.classifyIntent('create a todo app')
  console.log('[TestChat] Intent classified:', intent)

  if (intent !== 'create_project') {
    console.warn('[TestChat] Expected intent create_project, got:', intent)
  }

  // 4. Execute agent task
  console.log('[TestChat] 3. Executing agent task...')
  const tasks = await chatService.executeAgentTask(session.id, intent, 'create a todo app')
  console.log('[TestChat] Tasks created:', tasks.length)
  for (const t of tasks) {
    console.log(`  - ${t.ticketId} (${t.workerRole}): ${t.status}`)
  }

  // 5. Verify tasks are persisted
  const dbTasks = await chatService.getSessionTasks(session.id)
  console.log('[TestChat] 4. Tasks from DB:', dbTasks.length)

  // 6. Check progress
  const progress = await chatService.getTaskProgress(session.id)
  console.log('[TestChat] 5. Progress status:', progress.status)

  // 7. Verify messages
  const { messages } = await chatService.getSessionMessages(session.id)
  console.log('[TestChat] 6. Messages count:', messages.length)

  // Cleanup
  await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [session.id])
  await pool.query('DELETE FROM agent_tasks WHERE session_id = $1', [session.id])
  await pool.query('DELETE FROM chat_sessions WHERE id = $1', [session.id])

  console.log('[TestChat] ✅ Test completed successfully!')
  await pool.end()
}

main().catch((err) => {
  console.error('[TestChat] Test failed:', err)
  process.exit(1)
})
