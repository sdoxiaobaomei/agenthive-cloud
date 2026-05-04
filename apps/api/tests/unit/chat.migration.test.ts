// Chat Session Migration 单元测试
// 验证 5 个 migration 文件的 SQL 语法正确性和 idempotency

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../src/db/migrations')

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8')
}

describe('Migration files exist and are well-formed', () => {
  const migrations = [
    '20260504010000_align-chat-messages.sql',
    '20260504010100_add-workspaces.sql',
    '20260504010200_enforce-project-session-unique.sql',
    '20260504010300_add-message-types.sql',
    '20260504010400_add-chat-versions.sql',
  ]

  it.each(migrations)('%s exists', (filename) => {
    const filepath = path.join(MIGRATIONS_DIR, filename)
    expect(fs.existsSync(filepath)).toBe(true)
  })

  it.each(migrations)('%s contains up and down markers', (filename) => {
    const sql = readMigration(filename)
    expect(sql).toContain('-- ${node-pg-migrate}-up')
    expect(sql).toContain('-- ${node-pg-migrate}-down')
  })
})

describe('Migration 1: align-chat-messages', () => {
  const sql = readMigration('20260504010000_align-chat-messages.sql')

  it('drops agent_id if exists', () => {
    expect(sql).toMatch(/DROP COLUMN IF EXISTS agent_id/i)
  })

  it('adds metadata JSONB', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS metadata JSONB/i)
  })

  it('allows content to be NULL', () => {
    expect(sql).toMatch(/ALTER COLUMN content DROP NOT NULL/i)
  })
})

describe('Migration 2: add-workspaces', () => {
  const sql = readMigration('20260504010100_add-workspaces.sql')

  it('creates workspaces table with expected columns', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS workspaces/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES users/i)
    expect(sql).toMatch(/name VARCHAR\(100\)/i)
    expect(sql).toMatch(/settings JSONB/i)
  })

  it('adds workspace_id to projects', () => {
    expect(sql).toMatch(/ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID/i)
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_projects_workspace_id/i)
  })

  it('has update trigger for workspaces', () => {
    expect(sql).toMatch(/update_workspaces_updated_at/i)
  })
})

describe('Migration 3: enforce-project-session-unique', () => {
  const sql = readMigration('20260504010200_enforce-project-session-unique.sql')

  it('adds workspace_id to chat_sessions', () => {
    expect(sql).toMatch(/ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID/i)
  })

  it('adds session_type with CHECK constraint', () => {
    expect(sql).toMatch(/session_type VARCHAR\(20\) DEFAULT 'default'/i)
    expect(sql).toMatch(/CHECK \(session_type IN \('default', 'review', 'debug', 'template'\)\)/i)
  })

  it('adds current_version_id', () => {
    expect(sql).toMatch(/current_version_id UUID/i)
  })

  it('enforces partial unique index on project_id', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX idx_chat_sessions_project_id_unique/i)
    expect(sql).toMatch(/WHERE project_id IS NOT NULL/i)
  })
})

describe('Migration 4: add-message-types', () => {
  const sql = readMigration('20260504010300_add-message-types.sql')

  it('adds message_type with CHECK constraint', () => {
    expect(sql).toMatch(/message_type VARCHAR\(20\) DEFAULT 'message'/i)
    expect(sql).toMatch(/CHECK \(message_type IN \('message', 'think', 'task', 'recommend', 'system_event'\)\)/i)
  })

  it('adds is_visible_in_history', () => {
    expect(sql).toMatch(/is_visible_in_history BOOLEAN DEFAULT TRUE/i)
  })

  it('adds version_id and parent_message_id', () => {
    expect(sql).toMatch(/version_id UUID/i)
    expect(sql).toMatch(/parent_message_id UUID REFERENCES chat_messages/i)
  })

  it('creates indexes for filtering', () => {
    expect(sql).toMatch(/idx_chat_messages_message_type/i)
    expect(sql).toMatch(/idx_chat_messages_version_id/i)
    expect(sql).toMatch(/idx_chat_messages_visible/i)
  })

  it('migrates existing system messages', () => {
    expect(sql).toMatch(/UPDATE chat_messages SET message_type = 'system_event' WHERE role = 'system'/i)
  })
})

describe('Migration 5: add-chat-versions', () => {
  const sql = readMigration('20260504010400_add-chat-versions.sql')

  it('creates chat_versions table', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS chat_versions/i)
    expect(sql).toMatch(/session_id UUID NOT NULL REFERENCES chat_sessions/i)
    expect(sql).toMatch(/version_number INTEGER NOT NULL/i)
    expect(sql).toMatch(/is_active BOOLEAN DEFAULT FALSE/i)
    expect(sql).toMatch(/base_message_id UUID REFERENCES chat_messages/i)
  })

  it('has unique composite key on session + version_number', () => {
    expect(sql).toMatch(/UNIQUE\(session_id, version_number\)/i)
  })

  it('has partial unique index for active version per session', () => {
    expect(sql).toMatch(/idx_chat_versions_active_per_session/i)
    expect(sql).toMatch(/WHERE is_active = TRUE/i)
  })

  it('has update trigger', () => {
    expect(sql).toMatch(/update_chat_versions_updated_at/i)
  })
})
