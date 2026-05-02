#!/usr/bin/env tsx
/**
 * 数据库迁移管理脚本（企业级）
 * 
 * 功能：
 * - 管理版本化迁移
 * - 支持事务性执行
 * - 记录迁移历史
 * - 支持回滚
 * - 锁机制防止并发
 */

import { pool } from '../src/config/database.js'
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import logger from '../src/utils/logger.js'

const MIGRATIONS_DIR = join(__dirname, '../src/db/migrations')
const MIGRATION_LOCK_TIMEOUT = 30000 // 30 秒锁超时

interface MigrationRecord {
  id: number
  name: string
  applied_at: Date
  applied_by: string
  checksum: string
  execution_time_ms: number
  success: boolean
  error_message?: string
}

/**
 * 确保迁移管理表存在
 */
async function ensureMigrationTables(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(`
      -- 迁移记录表
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_by VARCHAR(100),
        checksum VARCHAR(64),
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT
      );

      -- 迁移锁表（防止并发迁移）
      CREATE TABLE IF NOT EXISTS _migration_lock (
        id INTEGER PRIMARY KEY DEFAULT 1,
        locked_at TIMESTAMPTZ,
        locked_by VARCHAR(100),
        CONSTRAINT single_row CHECK (id = 1)
      );

      -- 确保锁表有一行
      INSERT INTO _migration_lock (id, locked_at, locked_by)
      VALUES (1, NULL, NULL)
      ON CONFLICT (id) DO NOTHING;
    `)
  } finally {
    client.release()
  }
}

/**
 * 获取迁移锁
 */
async function acquireLock(): Promise<boolean> {
  const client = await pool.connect()
  try {
    // 检查是否已锁定
    const lockResult = await client.query<{ locked_at: Date; locked_by: string }>(`
      SELECT locked_at, locked_by FROM _migration_lock WHERE id = 1
    `)

    if (lockResult.rows[0].locked_at) {
      const lockedAt = lockResult.rows[0].locked_at
      const lockedBy = lockResult.rows[0].locked_by
      const lockAge = Date.now() - lockedAt.getTime()

      if (lockAge < MIGRATION_LOCK_TIMEOUT) {
        console.error(`迁移被锁定，由 ${lockedBy} 在 ${lockedAt.toISOString()} 锁定`)
        return false
      }

      console.warn(`检测到过期的迁移锁（${Math.round(lockAge / 1000)}秒），自动清理`)
    }

    // 获取锁
    await client.query(`
      UPDATE _migration_lock
      SET locked_at = NOW(), locked_by = current_user
      WHERE id = 1
    `)

    return true
  } finally {
    client.release()
  }
}

/**
 * 释放迁移锁
 */
async function releaseLock(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(`
      UPDATE _migration_lock SET locked_at = NULL, locked_by = NULL WHERE id = 1
    `)
  } finally {
    client.release()
  }
}

/**
 * 获取已执行的迁移列表
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(`
    SELECT name FROM _migrations WHERE success = TRUE ORDER BY name
  `)
  return new Set(result.rows.map(r => r.name))
}

/**
 * 获取待执行的迁移文件列表
 */
function getPendingMigrations(applied: Set<string>): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return []
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .filter(f => !applied.has(f.replace('.sql', '')))
    .sort()

  return files
}

/**
 * 计算 SQL 文件的校验和
 */
function calculateChecksum(content: string): string {
  const crypto = await import('crypto')
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}

/**
 * 执行单个迁移
 */
async function executeMigration(filename: string): Promise<{ success: boolean; timeMs: number; error?: string }> {
  const filepath = join(MIGRATIONS_DIR, filename)
  const content = readFileSync(filepath, 'utf-8')
  const checksum = calculateChecksum(content)
  const migrationName = filename.replace('.sql', '')

  const startTime = Date.now()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 分割 SQL 语句（支持多语句）
    const statements = content
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    // 执行每条语句
    for (const stmt of statements) {
      try {
        await client.query(stmt)
      } catch (err: any) {
        // 忽略 "already exists" 类错误
        if (err.code === '42P07' || err.message?.includes('already exists')) {
          console.warn(`  [WARN] ${err.message}`)
          continue
        }
        throw err
      }
    }

    // 记录迁移
    const executionTime = Date.now() - startTime
    await client.query(`
      INSERT INTO _migrations (name, applied_by, checksum, execution_time_ms, success)
      VALUES ($1, current_user, $2, $3, TRUE)
    `, [migrationName, checksum, executionTime])

    await client.query('COMMIT')

    return { success: true, timeMs: executionTime }
  } catch (err: any) {
    await client.query('ROLLBACK')

    const executionTime = Date.now() - startTime

    // 记录失败
    try {
      await client.query(`
        INSERT INTO _migrations (name, applied_by, checksum, execution_time_ms, success, error_message)
        VALUES ($1, current_user, $2, $3, FALSE, $4)
      `, [migrationName, checksum, executionTime, err.message])
    } catch (insertErr) {
      // 忽略插入错误
    }

    return { success: false, timeMs: executionTime, error: err.message }
  } finally {
    client.release()
  }
}

/**
 * 执行回滚（最后 N 个迁移）
 */
async function rollback(count: number = 1): Promise<void> {
  const client = await pool.connect()

  try {
    // 获取最近成功的迁移
    const result = await client.query<{ name: string }>(`
      SELECT name FROM _migrations
      WHERE success = TRUE
      ORDER BY applied_at DESC
      LIMIT $1
    `, [count])

    if (result.rows.length === 0) {
      console.log('没有可回滚的迁移')
      return
    }

    for (const row of result.rows) {
      console.log(`回滚迁移: ${row.name}`)

      // 删除迁移记录（实际生产环境应该执行 down 脚本）
      await client.query(`
        DELETE FROM _migrations WHERE name = $1
      `, [row.name])

      console.log(`  ✓ 已删除迁移记录 ${row.name}`)
    }
  } finally {
    client.release()
  }
}

/**
 * 显示迁移状态
 */
async function showStatus(): Promise<void> {
  const applied = await getAppliedMigrations()
  const pending = getPendingMigrations(applied)

  console.log('\n=== 迁移状态 ===\n')

  // 已执行的迁移
  const result = await pool.query<MigrationRecord>(`
    SELECT * FROM _migrations ORDER BY applied_at DESC LIMIT 20
  `)

  if (result.rows.length > 0) {
    console.log('已执行的迁移（最近 20 个）：')
    console.log('─'.repeat(80))
    for (const row of result.rows) {
      const status = row.success ? '✓' : '✗'
      const time = new Date(row.applied_at).toISOString()
      console.log(`  ${status} ${row.name.padEnd(40)} ${time} (${row.execution_time_ms}ms)`)
      if (row.error_message) {
        console.log(`    ERROR: ${row.error_message}`)
      }
    }
  } else {
    console.log('暂无已执行的迁移')
  }

  // 待执行的迁移
  if (pending.length > 0) {
    console.log('\n待执行的迁移：')
    console.log('─'.repeat(80))
    for (const f of pending) {
      console.log(`  ○ ${f}`)
    }
  } else {
    console.log('\n所有迁移已执行完毕')
  }

  console.log('')
}

/**
 * 创建新迁移文件
 */
function createMigration(name: string): void {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14)
  const filename = `${timestamp}_${name}.sql`
  const filepath = join(MIGRATIONS_DIR, filename)

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Author: <your-name>
-- Ticket: <ticket-number>

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

BEGIN;

-- TODO: 在此编写迁移 SQL

-- 记录迁移
INSERT INTO _migrations (name, applied_at)
VALUES ('${timestamp}_${name}', NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (回滚时使用)
-- ============================================================================

--ROLLBACK;

--BEGIN;
-- TODO: 在此编写回滚 SQL
--DELETE FROM _migrations WHERE name = '${timestamp}_${name}';
--COMMIT;
`

  if (!existsSync(MIGRATIONS_DIR)) {
    const { mkdirSync } = await import('fs')
    mkdirSync(MIGRATIONS_DIR, { recursive: true })
  }

  writeFileSync(filepath, template)
  console.log(`✓ 创建迁移文件: ${filepath}`)
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const command = process.argv[2]
  const arg = process.argv[3]

  console.log('\n🚀 AgentHive 数据库迁移工具\n')

  try {
    await ensureMigrationTables()

    switch (command) {
      case 'up':
      case 'migrate': {
        // 获取锁
        if (!(await acquireLock())) {
          console.error('无法获取迁移锁，可能另一个迁移正在执行')
          process.exit(1)
        }

        try {
          const applied = await getAppliedMigrations()
          const pending = getPendingMigrations(applied)

          if (pending.length === 0) {
            console.log('所有迁移已执行完毕\n')
            break
          }

          console.log(`发现 ${pending.length} 个待执行的迁移：\n`)

          for (const file of pending) {
            console.log(`执行: ${file}`)
            const result = await executeMigration(file)

            if (result.success) {
              console.log(`  ✓ 成功 (${result.timeMs}ms)\n`)
            } else {
              console.error(`  ✗ 失败: ${result.error}\n`)
              console.error('迁移执行中断，请修复错误后重试')
              process.exit(1)
            }
          }

          console.log('✓ 所有迁移执行完成\n')
        } finally {
          await releaseLock()
        }
        break
      }

      case 'down':
      case 'rollback': {
        const count = arg ? parseInt(arg, 10) : 1
        if (isNaN(count) || count < 1) {
          console.error('无效的回滚数量')
          process.exit(1)
        }

        if (!(await acquireLock())) {
          console.error('无法获取迁移锁')
          process.exit(1)
        }

        try {
          await rollback(count)
        } finally {
          await releaseLock()
        }
        break
      }

      case 'status': {
        await showStatus()
        break
      }

      case 'create': {
        if (!arg) {
          console.error('用法: migrate create <migration-name>')
          process.exit(1)
        }
        createMigration(arg)
        break
      }

      default:
        console.log(`
用法: migrate <command> [args]

命令:
  up, migrate    执行所有待执行的迁移
  down [n]       回滚最近 n 个迁移（默认 1）
  status         显示迁移状态
  create <name>  创建新的迁移文件

示例:
  migrate up
  migrate down 2
  migrate status
  migrate create add-agent-ownership
        `)
    }
  } catch (err) {
    console.error('错误:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
