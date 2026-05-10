/**
 * SupabaseTool — 生成 Supabase PostgreSQL migrations、RLS policies 和 TypeScript 类型
 *
 * 对应 spec/002-agent-runtime.md §3
 */

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError, type ToolResult } from '../ToolV2.js'
import type { ToolUseContext, CanUseToolFn } from '../ToolV2.js'

// ── Helper: wrap createToolError to match expected output type ─────────────

/** Wrap createToolError with proper output type for this tool */
function fail(msg: string): ToolResult<SupabaseOutput> {
  return createToolError(msg) as unknown as ToolResult<SupabaseOutput>
}

// ── Input Schema ──────────────────────────────────────────────────────────

export const SupabaseActionEnum = z.enum([
  'create_table',
  'add_column',
  'add_rls',
  'create_migration',
  'create_type',
])

export const RlsPolicyEnum = z.enum([
  'authenticated',
  'public',
  'owner_only',
])

export const SupabaseInputSchema = z.object({
  action: SupabaseActionEnum.describe('The Supabase operation to perform'),
  migration_name: z.string().optional()
    .describe('Descriptive name for the migration file (snake_case)'),
  table_name: z.string().optional()
    .describe('Name of the table to create (snake_case)'),
  columns: z.array(z.object({
    name: z.string().describe('Column name (snake_case)'),
    type: z.string().describe('PostgreSQL type, e.g. text, uuid, timestamptz, integer, boolean, jsonb'),
    nullable: z.boolean().optional(),
    default: z.string().optional().describe('SQL default expression'),
    unique: z.boolean().optional(),
    references: z.string().optional().describe('Foreign key reference, e.g. auth.users(id)'),
  })).optional().describe('Columns for create_table'),
  column_name: z.string().optional().describe('Column to add'),
  column_type: z.string().optional().describe('PostgreSQL type'),
  column_nullable: z.boolean().optional(),
  column_default: z.string().optional(),
  rls_policy: RlsPolicyEnum.optional().describe('RLS policy type to apply'),
  rls_table: z.string().optional().describe('Table to apply RLS to'),
  migration_sql: z.string().optional()
    .describe('Raw SQL content for the migration file'),
  type_name: z.string().optional()
    .describe('Name of the TypeScript type to generate'),
  type_source_table: z.string().optional()
    .describe('Source table to derive the type from'),
})

export type SupabaseInput = z.infer<typeof SupabaseInputSchema>

// ── Output Schema ─────────────────────────────────────────────────────────

export const SupabaseOutputSchema = z.object({
  success: z.boolean(),
  migrationPath: z.string().optional(),
  error: z.string().optional(),
  sqlContent: z.string().optional(),
})

export type SupabaseOutput = z.infer<typeof SupabaseOutputSchema>

// ── RLS Policy Templates ──────────────────────────────────────────────────

const RLS_TEMPLATES: Record<z.infer<typeof RlsPolicyEnum>, (tableName: string) => string> = {
  authenticated: (tableName: string) => `
-- Enable RLS
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for authenticated users
CREATE POLICY "${tableName}_select_policy"
  ON ${tableName} FOR SELECT
  TO authenticated
  USING (true);

-- Allow INSERT for authenticated users
CREATE POLICY "${tableName}_insert_policy"
  ON ${tableName} FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow UPDATE only for the owner
CREATE POLICY "${tableName}_update_policy"
  ON ${tableName} FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow DELETE only for the owner
CREATE POLICY "${tableName}_delete_policy"
  ON ${tableName} FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
`,

  public: (tableName: string) => `
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "${tableName}_public_select"
  ON ${tableName} FOR SELECT
  TO anon, authenticated
  USING (true);
`,

  owner_only: (tableName: string) => `
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "${tableName}_owner_select"
  ON ${tableName} FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "${tableName}_owner_insert"
  ON ${tableName} FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "${tableName}_owner_update"
  ON ${tableName} FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "${tableName}_owner_delete"
  ON ${tableName} FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
`,
}

// ── Tool Implementation ───────────────────────────────────────────────────

export const SupabaseTool = buildToolV2({
  name: 'supabase',
  description:
    'Generate Supabase PostgreSQL migrations, RLS policies, and TypeScript types. ' +
    'All migrations follow the naming convention YYYYMMDDHHMMSS_description.sql.',
  category: 'write',
  aliases: ['db', 'migration'],

  inputSchema: SupabaseInputSchema,
  outputSchema: SupabaseOutputSchema,

  isReadOnly: () => false,
  isDestructive: () => false,
  isConcurrencySafe: (input) => (input as any).action !== 'create_migration',

  async call(
    rawInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _assistantMessage,
  ) {
    const input = rawInput as SupabaseInput
    try {
      const now = new Date()
      const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
      ].join('')

      const migrationName = input.migration_name
        ?.replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        ?? input.action

      const fileName = `${timestamp}_${migrationName}.sql`

      const { join } = await import('path')
      const { existsSync, mkdirSync, writeFileSync } = await import('fs')

      const supabaseDir = join(context.workspacePath, 'supabase', 'migrations')
      if (!existsSync(supabaseDir)) {
        mkdirSync(supabaseDir, { recursive: true })
      }

      let sqlContent = ''

      switch (input.action) {
        case 'create_table': {
          if (!input.table_name || !input.columns) {
            return fail('table_name and columns are required for create_table action')
          }
          const cols = input.columns.map((col) => {
            let def = `  ${col.name} ${col.type}`
            if (!(col.nullable ?? false)) def += ' NOT NULL'
            if (col.default) def += ` DEFAULT ${col.default}`
            if (col.unique ?? false) def += ' UNIQUE'
            if (col.references) def += ` REFERENCES ${col.references}`
            return def
          }).join(',\n')

          sqlContent = `-- Migration: ${migrationName}\n-- Generated: ${now.toISOString()}\n\n` +
            `CREATE TABLE IF NOT EXISTS ${input.table_name} (\n` +
            `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
            `${cols},\n` +
            `  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n` +
            `  updated_at TIMESTAMPTZ\n` +
            `);\n\n` +
            `-- Indexes\n` +
            `CREATE INDEX IF NOT EXISTS idx_${input.table_name}_created_at ON ${input.table_name}(created_at);\n`
          break
        }

        case 'add_column': {
          if (!input.table_name || !input.column_name || !input.column_type) {
            return fail('table_name, column_name, and column_type are required for add_column')
          }
          const nullableClause = (input.column_nullable ?? true) ? '' : ' NOT NULL'
          const defaultClause = input.column_default ? ` DEFAULT ${input.column_default}` : ''
          sqlContent = `ALTER TABLE ${input.table_name}\n` +
            `  ADD COLUMN IF NOT EXISTS ${input.column_name} ${input.column_type}${nullableClause}${defaultClause};\n`
          break
        }

        case 'add_rls': {
          if (!input.rls_table || !input.rls_policy) {
            return fail('rls_table and rls_policy are required for add_rls action')
          }
          const templateFn = RLS_TEMPLATES[input.rls_policy]
          if (!templateFn) {
            return fail(`Unknown RLS policy: ${input.rls_policy}`)
          }
          sqlContent = templateFn(input.rls_table)
          break
        }

        case 'create_migration': {
          if (!input.migration_sql) {
            return fail('migration_sql is required for create_migration action')
          }
          sqlContent = `-- Migration: ${migrationName}\n-- Generated: ${now.toISOString()}\n\n${input.migration_sql}\n`
          break
        }

        case 'create_type': {
          if (!input.type_name || !input.type_source_table) {
            return fail('type_name and type_source_table are required for create_type action')
          }
          sqlContent = `-- Migration: ${migrationName}\n-- Generated: ${now.toISOString()}\n\n` +
            `-- This migration adds a COMMENT that triggers type generation\n` +
            `COMMENT ON TABLE ${input.type_source_table} IS 'TypeScript type: ${input.type_name}';\n`
          break
        }
      }

      const filePath = join(supabaseDir, fileName)
      writeFileSync(filePath, sqlContent, 'utf-8')

      context.sendLog(`Generated migration: supabase/migrations/${fileName}`)

      return createToolResult<SupabaseOutput>(
        {
          success: true,
          migrationPath: `supabase/migrations/${fileName}`,
          sqlContent,
        },
        {
          resultForAssistant: `Supabase migration created at supabase/migrations/${fileName}\n\`\`\`sql\n${sqlContent}\`\`\``,
        }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return fail(`SupabaseTool error: ${msg}`)
    }
  },

  async checkPermissions(input, _context) {
    return { behavior: 'ask', prompt: `Generate Supabase migration: ${(input as any).action}?` }
  },

  renderToolUseMessage(input) {
    return `Supabase: ${(input as any).action}${(input as any).table_name ? ` on ${(input as any).table_name}` : ''}`
  },

  toAutoClassifierInput(input) {
    return `supabase ${(input as any).action} ${(input as any).table_name ?? ''}`
  },

  userFacingName() {
    return 'Supabase Migration'
  },
})

export default SupabaseTool
