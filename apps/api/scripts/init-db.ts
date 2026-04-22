// 数据库初始化脚本
import { pool } from '../src/config/database.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import logger from '../src/utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const initDatabase = async () => {
  try {
    console.log('[InitDB] Starting database initialization...')

    // 读取 SQL 文件
    const schemaPath = join(__dirname, '../src/db/schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')

    // Split into individual statements and execute safely
    const statements = schema
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    const errors: string[] = []
    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.code === '42P07' || err.message?.includes('already exists')) {
          continue
        }
        // Ignore permission errors for extensions/triggers but log them
        if (err.code === '42501') {
          errors.push(`Permission denied: ${stmt.split('\n')[0].trim()}`)
          continue
        }
        errors.push(`${err.message} (SQL: ${stmt.split('\n')[0].trim()})`)
      }
    }

    if (errors.length > 0) {
      console.warn('[InitDB] Some statements failed (non-critical):')
      for (const err of errors) {
        console.warn('  -', err)
      }
    }

    console.log('[InitDB] Database schema processed.')

    // 插入默认数据
    await insertDefaultData()
  } catch (error) {
    console.error('[InitDB] Failed to initialize database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

const insertDefaultData = async () => {
  const client = await pool.connect()

  try {
    // 检查是否已有数据
    const agentCount = await client.query('SELECT COUNT(*) FROM agents')
    if (parseInt(agentCount.rows[0].count) > 0) {
      console.log('[InitDB] Default data already exists, skipping...')
      return
    }

    console.log('[InitDB] Inserting default data...')

    // 插入默认用户
    const userResult = await client.query(`
      INSERT INTO users (id, username, email, phone, role, created_at, updated_at)
      VALUES
        ('11111111-1111-1111-1111-111111111111', 'admin', 'admin@agenthive.cloud', '13800138000', 'admin', NOW(), NOW())
      RETURNING id
    `)
    const adminUserId = userResult.rows[0].id

    // 插入默认项目
    await client.query(`
      INSERT INTO projects (id, name, description, owner_id, status, created_at, updated_at)
      VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AgentHive Cloud', 'AI驱动的智能开发团队管理平台', $1, 'active', NOW(), NOW()),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Demo Project', '演示项目', $1, 'active', NOW(), NOW())
    `, [adminUserId]).catch(() => {
      console.warn('[InitDB] Projects table may not exist, skipping project insertion.')
    })

    // 插入默认 Agents
    await client.query(`
      INSERT INTO agents (id, name, role, status, description, config, created_at, updated_at)
      VALUES
        ('11111111-1111-1111-1111-111111111111', 'Director', 'director', 'working', 'Project director agent', '{}', NOW(), NOW()),
        ('22222222-2222-2222-2222-222222222222', 'Frontend Dev', 'frontend_dev', 'idle', 'Frontend development specialist', '{}', NOW(), NOW()),
        ('33333333-3333-3333-3333-333333333333', 'Backend Dev', 'backend_dev', 'working', 'Backend development specialist', '{}', NOW(), NOW()),
        ('44444444-4444-4444-4444-444444444444', 'QA Engineer', 'qa_engineer', 'idle', 'Quality assurance specialist', '{}', NOW(), NOW())
      RETURNING id
    `)

    // 插入默认 Tasks
    await client.query(`
      INSERT INTO tasks (id, title, description, type, status, priority, progress, assigned_to, created_at)
      VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Design System Implementation', 'Implement the design system components', 'feature', 'running', 'high', 65, '33333333-3333-3333-3333-333333333333', NOW()),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Authentication Module', 'Implement user authentication', 'feature', 'pending', 'critical', 0, NULL, NOW()),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Code Review', 'Review pull requests', 'review', 'completed', 'medium', 100, '11111111-1111-1111-1111-111111111111', NOW())
    `)

    // 插入默认代码文件
    await client.query(`
      INSERT INTO code_files (path, name, content, language)
      VALUES
        ('/main.go', 'main.go', 'package main\n\nimport (\n    "fmt"\n    "log"\n    "net/http"\n)\n\nfunc main() {\n    fmt.Println("Starting AgentHive Cloud...")\n    \n    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n        fmt.Fprintf(w, "Welcome to AgentHive Cloud!")\n    })\n    \n    log.Fatal(http.ListenAndServe(":8080", nil))\n}', 'go'),
        ('/handlers/auth.go', 'auth.go', 'package handlers\n\nimport (\n    "net/http"\n    "github.com/gin-gonic/gin"\n)\n\nfunc Login(c *gin.Context) {\n    var req LoginRequest\n    if err := c.ShouldBindJSON(&req); err != nil {\n        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n        return\n    }\n    // Login logic here\n    c.JSON(http.StatusOK, gin.H{"token": "mock-token"})\n}', 'go'),
        ('/README.md', 'README.md', '# AgentHive Cloud\n\nAI-powered development team management platform.\n\n## Features\n\n- Multi-Agent System\n- Task Management\n- Real-time Code Editing\n- Terminal Access\n- Team Chat\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`', 'markdown')
    `)

    // 插入默认 Agent 日志
    await client.query(`
      INSERT INTO agent_logs (agent_id, message, level, created_at)
      VALUES
        ('11111111-1111-1111-1111-111111111111', 'Agent started', 'info', NOW() - INTERVAL '1 hour'),
        ('11111111-1111-1111-1111-111111111111', 'Initializing capabilities...', 'info', NOW() - INTERVAL '59 minutes'),
        ('11111111-1111-1111-1111-111111111111', 'Ready for tasks', 'info', NOW() - INTERVAL '58 minutes'),
        ('11111111-1111-1111-1111-111111111111', 'Assigned task: Code Review', 'info', NOW() - INTERVAL '30 minutes'),
        ('11111111-1111-1111-1111-111111111111', 'Task completed successfully', 'info', NOW() - INTERVAL '10 minutes'),
        ('33333333-3333-3333-3333-333333333333', 'Agent started', 'info', NOW() - INTERVAL '2 hours'),
        ('33333333-3333-3333-3333-333333333333', 'Working on API Development', 'info', NOW() - INTERVAL '90 minutes'),
        ('33333333-3333-3333-3333-333333333333', 'Progress: 30%', 'info', NOW() - INTERVAL '60 minutes'),
        ('33333333-3333-3333-3333-333333333333', 'Progress: 65%', 'info', NOW() - INTERVAL '30 minutes')
    `)

    console.log('[InitDB] Default data inserted successfully!')
  } catch (error) {
    console.error('[InitDB] Failed to insert default data:', error)
    throw error
  } finally {
    client.release()
  }
}

initDatabase()
