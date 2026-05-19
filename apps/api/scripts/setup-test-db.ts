// 为 CI 测试环境设置数据库表结构
// 读取所有 migration 文件，只执行 UP 部分（跳过 DOWN 部分）
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { Pool } = pg

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'agenthive',
  user: process.env.DB_USER || 'agenthive',
  password: process.env.DB_PASSWORD || 'dev',
})

const UP_MARKER = '${node-pg-migrate}-up'
const DOWN_MARKER = '${node-pg-migrate}-down'

function extractUpSQL(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8')

  const upIdx = content.indexOf(UP_MARKER)
  if (upIdx === -1) {
    // No marker found — treat entire file as up SQL
    return content
  }

  const afterUp = upIdx + UP_MARKER.length
  const downIdx = content.indexOf(DOWN_MARKER, afterUp)

  if (downIdx === -1) {
    // No down marker — everything after up marker is up SQL
    return content.slice(afterUp)
  }

  return content.slice(afterUp, downIdx)
}

async function setup() {
  const migrationsDir = join(__dirname, '..', 'src', 'db', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort() // 按文件名排序（时间戳顺序）

  console.log(`[setup-test-db] Found ${files.length} migration files`)

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = extractUpSQL(filePath).trim()

    if (!sql) {
      console.log(`[setup-test-db] Skipping ${file} (empty up section)`)
      continue
    }

    console.log(`[setup-test-db] Executing ${file}...`)
    try {
      await pool.query(sql)
      console.log(`[setup-test-db] ${file} ✓`)
    } catch (err: any) {
      // "already exists" 类错误可以忽略（幂等迁移）
      if (err.code === '42P07' || err.message?.includes('already exists')) {
        console.log(`[setup-test-db] ${file} (already exists, skipping)`)
        continue
      }
      // 权限错误可以忽略
      if (err.code === '42501') {
        console.warn(`[setup-test-db] ${file} permission error (non-critical):`, err.message)
        continue
      }
      throw err
    }
  }

  console.log('[setup-test-db] Database setup complete')
}

setup()
  .then(() => {
    // 不要关闭 pool — 后续测试需要它
    console.log('[setup-test-db] Done (pool kept open for tests)')
  })
  .catch(err => {
    console.error('[setup-test-db] Failed:', err)
    process.exit(1)
  })
