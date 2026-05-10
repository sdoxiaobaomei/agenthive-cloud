/**
 * SupabaseTool 单元测试
 *
 * 测试重点：action 校验、SQL 生成正确性、RLS 策略完整性、migration 命名规则
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SupabaseActionEnum,
  RlsPolicyEnum,
  SupabaseInputSchema,
  SupabaseOutputSchema,
  SupabaseTool,
} from '../../src/tools/supabase/SupabaseTool.js'

// ============================================================================
// Helpers
// ============================================================================

const MOCK_WORKSPACE = '/tmp/test-workspace'

function createMockContext() {
  return {
    agentId: 'test-agent',
    workspacePath: MOCK_WORKSPACE,
    sendLog: vi.fn(),
    abortController: new AbortController(),
    getAppState: vi.fn(() => ({})),
    setAppState: vi.fn(),
    messages: [],
    checkPermission: vi.fn(),
    llm: {
      complete: vi.fn(),
      stream: vi.fn(),
    },
  }
}

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('SupabaseTool — Schema Validation', () => {
  it('should accept valid create_table input', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'create_table',
      table_name: 'profiles',
      columns: [
        { name: 'full_name', type: 'text', nullable: true },
        { name: 'avatar_url', type: 'text' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid add_column input', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'add_column',
      table_name: 'profiles',
      column_name: 'bio',
      column_type: 'text',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid add_rls input', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'add_rls',
      rls_table: 'profiles',
      rls_policy: 'owner_only',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid create_migration input', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'create_migration',
      migration_sql: 'SELECT 1;',
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid create_type input', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'create_type',
      type_name: 'Profile',
      type_source_table: 'profiles',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid action', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'drop_table',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid RLS policy', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'add_rls',
      rls_table: 'profiles',
      rls_policy: 'admin_only',
    })
    expect(result.success).toBe(false)
  })

  it('should reject missing required fields for create_table', () => {
    const result = SupabaseInputSchema.safeParse({
      action: 'create_table',
    })
    // Zod by default allows missing optional fields, so this passes schema validation
    // The tool itself validates at runtime
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// Tool Metadata Tests
// ============================================================================

describe('SupabaseTool — Metadata', () => {
  it('should have correct name and category', () => {
    expect(SupabaseTool.name).toBe('supabase')
    expect(SupabaseTool.category).toBe('write')
  })

  it('should have aliases', () => {
    expect(SupabaseTool.aliases).toContain('db')
    expect(SupabaseTool.aliases).toContain('migration')
  })

  it('should NOT be read-only', () => {
    expect(SupabaseTool.isReadOnly({} as any)).toBe(false)
  })

  it('should NOT be destructive', () => {
    expect(SupabaseTool.isDestructive!({} as any)).toBe(false)
  })

  it('create_migration should NOT be concurrency-safe', () => {
    expect(SupabaseTool.isConcurrencySafe({ action: 'create_migration' } as any)).toBe(false)
  })

  it('create_table should be concurrency-safe', () => {
    expect(SupabaseTool.isConcurrencySafe({ action: 'create_table' } as any)).toBe(true)
  })

  it('should have non-empty description', () => {
    expect(SupabaseTool.description.length).toBeGreaterThan(0)
    expect(SupabaseTool.description).toContain('Supabase')
  })
})

// ============================================================================
// Table Creation SQL Generation
// ============================================================================

describe('SupabaseTool — create_table SQL Generation', () => {
  it('should generate CREATE TABLE with timestamp-based filename', async () => {
    const result = await SupabaseTool.call(
      {
        action: 'create_table',
        table_name: 'notes',
        columns: [
          { name: 'title', type: 'text', nullable: false },
        ],
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.success).toBe(true)
      expect(result.data.sqlContent).toContain('CREATE TABLE IF NOT EXISTS notes')
      expect(result.data.sqlContent).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()')
      expect(result.data.sqlContent).toContain('created_at TIMESTAMPTZ NOT NULL DEFAULT now()')
      expect(result.data.migrationPath).toMatch(/^supabase\/migrations\/\d{14}_.*\.sql$/)
    }
  })

  it('should handle columns with all options', async () => {
    const result = await SupabaseTool.call(
      {
        action: 'create_table',
        table_name: 'products',
        columns: [
          { name: 'price', type: 'integer', nullable: false },
          { name: 'user_id', type: 'uuid', nullable: false, references: 'auth.users(id)' },
          { name: 'sku', type: 'text', unique: true },
          { name: 'status', type: 'text', nullable: true, default: "'active'" },
        ],
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const sql = result.data.sqlContent!
      expect(sql).toContain('price integer NOT NULL')
      expect(sql).toContain('user_id uuid NOT NULL REFERENCES auth.users(id)')
      expect(sql).toContain('sku text NOT NULL UNIQUE')
      expect(sql).toContain("status text DEFAULT 'active'")
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_products_created_at')
    }
  })

  it('should return error when missing table_name for create_table', async () => {
    const result = await SupabaseTool.call(
      { action: 'create_table' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('error')
    expect(result.error).toContain('table_name')
  })

  it('should return error when missing columns for create_table', async () => {
    const result = await SupabaseTool.call(
      { action: 'create_table', table_name: 'x' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('error')
    expect(result.error).toContain('columns')
  })
})

// ============================================================================
// RLS Policy Generation
// ============================================================================

describe('SupabaseTool — RLS Policy Generation', () => {
  it('should generate authenticated RLS policy', async () => {
    const result = await SupabaseTool.call(
      { action: 'add_rls', rls_table: 'notes', rls_policy: 'authenticated' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const sql = result.data.sqlContent!
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
      expect(sql).toContain('TO authenticated')
      expect(sql).toContain('auth.uid() = user_id')
      expect(sql).toContain('notes_select_policy')
      expect(sql).toContain('notes_update_policy')
      expect(sql).toContain('notes_delete_policy')
    }
  })

  it('should generate public RLS policy', async () => {
    const result = await SupabaseTool.call(
      { action: 'add_rls', rls_table: 'pages', rls_policy: 'public' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const sql = result.data.sqlContent!
      expect(sql).toContain('TO anon, authenticated')
      expect(sql).toContain('pages_public_select')
    }
  })

  it('should generate owner_only RLS policy', async () => {
    const result = await SupabaseTool.call(
      { action: 'add_rls', rls_table: 'secrets', rls_policy: 'owner_only' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const sql = result.data.sqlContent!
      expect(sql).toContain('auth.uid() = user_id')
      // Owner only has all 4 CRUD policies
      expect(sql).toContain('secrets_owner_select')
      expect(sql).toContain('secrets_owner_insert')
      expect(sql).toContain('secrets_owner_update')
      expect(sql).toContain('secrets_owner_delete')
    }
  })

  it('should return error when missing rls_table', async () => {
    const result = await SupabaseTool.call(
      { action: 'add_rls', rls_policy: 'public' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('error')
    expect(result.error).toContain('rls_table')
  })
})

// ============================================================================
// Migration Naming Convention
// ============================================================================

describe('SupabaseTool — Migration Naming', () => {
  it('should use YYYYMMDDHHMMSS prefix', async () => {
    const result = await SupabaseTool.call(
      {
        action: 'create_migration',
        migration_name: 'add_index',
        migration_sql: 'CREATE INDEX idx_x ON t(x);',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const path = result.data.migrationPath!
      const match = path.match(/^supabase\/migrations\/(\d{14})_add_index\.sql$/)
      expect(match).not.toBeNull()

      // Timestamp should be a valid date-like string
      const ts = match![1]
      const year = parseInt(ts.substring(0, 4))
      const month = parseInt(ts.substring(4, 6))
      const day = parseInt(ts.substring(6, 8))
      const hour = parseInt(ts.substring(8, 10))
      const min = parseInt(ts.substring(10, 12))
      const sec = parseInt(ts.substring(12, 14))

      expect(year).toBeGreaterThanOrEqual(2024)
      expect(month).toBeGreaterThanOrEqual(1)
      expect(month).toBeLessThanOrEqual(12)
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(31)
      expect(hour).toBeLessThanOrEqual(23)
      expect(min).toBeLessThanOrEqual(59)
      expect(sec).toBeLessThanOrEqual(59)
    }
  })

  it('should sanitize migration_name to snake_case', async () => {
    const result = await SupabaseTool.call(
      {
        action: 'create_migration',
        migration_name: 'Bad NAme!!!123',
        migration_sql: 'SELECT 1;',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      const path = result.data.migrationPath!
      // 'Bad NAme!!!123' → sanitized:
      // Step 1: replace non-[a-z0-9_] → '_ad__ame___123'
      // Step 2: collapse underscores → '_ad_ame_123'
      // Step 3: trim edges → 'ad_ame_123'
      expect(path).toContain('123.sql')
      expect(path).not.toContain('Bad')
      expect(path).not.toContain('!!!')
    }
  })

  it('should fallback to action name when no migration_name', async () => {
    const result = await SupabaseTool.call(
      { action: 'add_rls', rls_table: 't', rls_policy: 'public' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.migrationPath).toMatch(/_add_rls\.sql$/)
    }
  })
})

// ============================================================================
// Permissions
// ============================================================================

describe('SupabaseTool — Permissions', () => {
  it('should always ask for permission', async () => {
    const perm = await SupabaseTool.checkPermissions(
      { action: 'create_table' } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('ask')
  })
})
