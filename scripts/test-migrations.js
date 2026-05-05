#!/usr/bin/env node
/**
 * Migration Verification Test
 * ===========================
 * Validates that all migrations can run on a clean database and produce
 * a schema matching code expectations.
 *
 * Usage:
 *   node scripts/test-migrations.js
 *
 * Requires: PostgreSQL running locally (or via Docker)
 */

const { execSync } = require('child_process')
const { Client } = require('pg')
const path = require('path')

const TEST_DB = 'test_migrations_' + Date.now()
const MIGRATIONS_DIR = path.resolve(__dirname, '../apps/api/src/db/migrations')

// Schema assertions: table -> expected columns
const SCHEMA_ASSERTIONS = {
  projects: ['id', 'name', 'description', 'owner_id', 'status', 'type', 'tech_stack', 'git_url', 'git_branch', 'workspace_path', 'last_accessed_at', 'is_template', 'created_at', 'updated_at', 'workspace_id', 'repo_url'],
  users: ['id', 'username', 'email', 'phone', 'password_hash', 'role', 'status', 'created_at', 'updated_at', 'external_user_id', 'avatar'],
  agent_tasks: ['id', 'session_id', 'status', 'created_at', 'updated_at', 'project_id', 'ticket_id', 'worker_role', 'workspace_path', 'result', 'started_at', 'completed_at'],
  chat_messages: ['id', 'session_id', 'role', 'content', 'created_at', 'metadata', 'message_type', 'is_visible_in_history', 'version_id', 'parent_message_id'],
  chat_sessions: ['id', 'user_id', 'project_id', 'title', 'created_at', 'updated_at', 'workspace_id', 'session_type', 'current_version_id'],
  workspaces: ['id', 'user_id', 'name', 'settings', 'created_at', 'updated_at'],
  chat_versions: ['id', 'session_id', 'version_number', 'title', 'description', 'base_message_id', 'is_active', 'created_by', 'created_at', 'updated_at'],
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://agenthive:agenthive-dev-password-2026@localhost:5432/postgres'
  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()

    // 1. Create test database
    console.log(`[1/4] Creating test database: ${TEST_DB}`)
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await client.query(`CREATE DATABASE ${TEST_DB}`)
    await client.end()

    // 2. Run all migrations
    console.log('[2/4] Running migrations...')
    const testDbUrl = databaseUrl.replace(/\/[^/]*$/, `/${TEST_DB}`)
    execSync(
      `npx node-pg-migrate up --migrations-dir "${MIGRATIONS_DIR}" --migrations-table _migrations`,
      {
        env: { ...process.env, DATABASE_URL: testDbUrl },
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../apps/api'),
      }
    )

    // 3. Verify schema
    console.log('[3/4] Verifying schema...')
    const verifyClient = new Client({ connectionString: testDbUrl })
    await verifyClient.connect()

    let failures = 0
    for (const [table, expectedColumns] of Object.entries(SCHEMA_ASSERTIONS)) {
      const result = await verifyClient.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      )
      const actualColumns = result.rows.map(r => r.column_name)
      const missing = expectedColumns.filter(c => !actualColumns.includes(c))
      const extra = actualColumns.filter(c => !expectedColumns.includes(c))

      if (missing.length > 0) {
        console.error(`  ❌ ${table}: missing columns [${missing.join(', ')}]`)
        failures++
      } else if (extra.length > 0) {
        console.warn(`  ⚠️  ${table}: extra columns [${extra.join(', ')}]`)
      } else {
        console.log(`  ✅ ${table}: ${actualColumns.length} columns`)
      }
    }

    await verifyClient.end()

    if (failures > 0) {
      console.error(`\n[FAIL] ${failures} schema assertion(s) failed`)
      process.exitCode = 1
    } else {
      console.log('\n[PASS] All schema assertions passed')
    }
  } catch (err) {
    console.error('\n[FAIL]', err.message)
    process.exitCode = 1
  } finally {
    // 4. Cleanup
    console.log('[4/4] Cleaning up test database...')
    const cleanupClient = new Client({ connectionString: databaseUrl })
    await cleanupClient.connect()
    await cleanupClient.query(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await cleanupClient.end()
  }
}

main()
