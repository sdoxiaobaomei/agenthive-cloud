# Agent Runtime Specification — Code Blueprint

**Version**: 2.2.0-dev
**Status**: Draft
**Source files**: `apps/agent-runtime/src/`

---

## 1. Agent Type Extension

### 1.1 New AgentType Enum Values

Add four new agent types to the existing `AgentType` enum defined in
`apps/agent-runtime/src/agent/AgentSystem.ts:29`:

```typescript
// File: apps/agent-runtime/src/agent/AgentSystem.ts (modify line 29)

export type AgentType =
  | 'explore'       // existing — read-only codebase exploration
  | 'plan'          // existing — implementation planning
  | 'coder'         // existing — code implementation
  | 'general'       // existing — general-purpose
  | 'custom'        // existing — user-defined
  | 'frontend_gen'  // NEW — frontend code generation (Nuxt/Vue)
  | 'supabase_gen'  // NEW — Supabase schema & migration generation
  | 'qa_verifier'   // NEW — QA verification against project specs
  | 'deploy_gen'    // NEW — deployment configuration generation
```

### 1.2 Agent Definitions

```typescript
// Add to BUILTIN_AGENTS record at apps/agent-runtime/src/agent/AgentSystem.ts:121

export const AGENT_DEFINITIONS_EXTENDED: Record<AgentType, AgentDefinition> = {
  // ... (existing entries unchanged) ...

  frontend_gen: {
    agentType: 'frontend_gen',
    name: 'Frontend Generator',
    description:
      'Generates Nuxt 3 / Vue 3 frontend code from templates. ' +
      'Locked to the project UI framework, no unauthorized libraries.',
    allowedTools: [
      'file_read', 'file_write', 'file_edit',
      'glob', 'grep', 'bash',
      'preview', 'template', 'web_fetch',
    ],
    disallowedTools: ['supabase', 'deploy', 'http'],
    systemPrompt: '', // Replaced at runtime by the template-bound prompt (Section 2)
    maxIterations: 30,
    readOnly: false,
    model: 'claude-sonnet-4-20250514',
    defaultIsolation: 'worktree',
  },

  supabase_gen: {
    agentType: 'supabase_gen',
    name: 'Supabase Generator',
    description:
      'Generates PostgreSQL migrations, RLS policies, and TypeScript types for Supabase.',
    allowedTools: [
      'file_read', 'file_write', 'file_edit',
      'glob', 'grep', 'supabase',
    ],
    disallowedTools: ['bash', 'http', 'preview', 'deploy'],
    systemPrompt: '', // Injected at runtime
    maxIterations: 20,
    readOnly: false,
    model: 'claude-sonnet-4-20250514',
    defaultIsolation: 'none',
  },

  qa_verifier: {
    agentType: 'qa_verifier',
    name: 'QA Verifier',
    description:
      'Validates generated code against system prompts, accessibility rules, ' +
      'and project conventions. Produces a VerificationReport.',
    allowedTools: [
      'file_read', 'glob', 'grep', 'bash', 'preview',
    ],
    disallowedTools: ['file_write', 'file_edit', 'supabase', 'deploy'],
    systemPrompt: '', // Injected at runtime
    maxIterations: 15,
    readOnly: true,
    model: 'claude-sonnet-4-20250514',
    defaultIsolation: 'none',
  },

  deploy_gen: {
    agentType: 'deploy_gen',
    name: 'Deploy Generator',
    description:
      'Generates Helm charts, K8s manifests, and Dockerfiles from project config.',
    allowedTools: [
      'file_read', 'file_write', 'file_edit',
      'glob', 'grep', 'bash',
    ],
    disallowedTools: ['supabase', 'preview', 'template', 'web_fetch'],
    systemPrompt: '', // Injected at runtime
    maxIterations: 20,
    readOnly: false,
    model: 'claude-sonnet-4-20250514',
    defaultIsolation: 'worktree',
  },
}
```

---

## 2. System Prompt Design for `frontend_gen`

### 2.1 Prompt Template Function

```typescript
// File: apps/agent-runtime/src/agent/prompts/frontend-gen.ts

import type { GenerationContext } from '../../context/ConversationContextV3.js'

export function buildFrontendGenSystemPrompt(ctx: GenerationContext): string {
  const { templateId, templateConfig } = ctx

  return `You are an expert Nuxt 3 / Vue 3 frontend developer. Generate production-quality code
for template "${templateId}" using ONLY the prescribed technology stack.

## CRITICAL CONSTRAINTS — VIOLATION MEANS REJECTION

### 1. UI Library Lockdown
You MUST use ONLY the UI framework specified by the template:
  - Template UI framework: ${templateConfig.uiFramework}
  - Template CSS approach: ${templateConfig.cssApproach}
  - DO NOT import or reference any other UI library (no Vuetify, no Ant Design, no Bootstrap, etc.)
  - DO NOT add new npm dependencies unless explicitly listed in templateConfig.allowedDeps.

### 2. File Structure Conventions
The project is a Nuxt 3 application. Place files in these directories ONLY:
  - pages/         — route pages (Nuxt auto-routing)
  - components/    — reusable Vue components (PascalCase)
  - composables/   — composable logic (useXxx naming)
  - stores/        — Pinia stores (useXxxStore naming)
  - server/api/    — API route handlers (optional)
  - supabase/      — Supabase client and types (read-only for frontend_gen)
  - assets/        — static assets, CSS
  - layouts/       — page layouts
  - middleware/     — route middleware

### 3. Design Scheme Application
Use the provided Tailwind configuration EXACTLY:
  - Colors: ${JSON.stringify(templateConfig.tailwindColors)}
  - Fonts: ${JSON.stringify(templateConfig.fonts)}
  - Spacing scale: ${JSON.stringify(templateConfig.spacing)}
  - Dark mode strategy: ${templateConfig.darkMode ?? 'class'}
  - DO NOT introduce any CSS framework other than Tailwind + the template config.

### 4. TypeScript Only
  - ALL files MUST be TypeScript (.ts for logic, .vue with <script setup lang="ts">)
  - NO plain JavaScript (.js) files under any circumstances
  - NO use of "any" type — define interfaces/types for all data structures
  - Use strict null checks throughout

### 5. package.json Immutability
  - DO NOT modify package.json or add new dependencies
  - If you absolutely need a new dependency, add it as a comment:
    // REQUESTED_DEP: npm install <package-name>
  - The orchestrator will evaluate and install if approved

### 6. Accessibility Requirements (a11y)
  - Use semantic HTML elements (<nav>, <main>, <article>, <aside>, <header>, <footer>)
  - Every interactive element MUST have an accessible name (aria-label or aria-labelledby)
  - All form controls MUST have associated <label> elements
  - Ensure keyboard navigation: Tab order must be logical
  - Color contrast MUST meet WCAG AA (4.5:1 for normal text)
  - Add focus-visible styles for all interactive elements
  - Images MUST have alt attributes (meaningful descriptions)

### 7. SEO Meta Tags
  - Every page MUST define SEO meta via useHead() or <Head> component
  - Required meta: title, description, og:title, og:description, og:image (if applicable)
  - Include canonical URL
  - Include structured data (JSON-LD) where appropriate

### 8. Error Handling
  - EVERY async operation MUST be wrapped in try/catch
  - Loading states MUST be shown during async operations (useLoading composable)
  - Empty states MUST have meaningful "no data" messages with action guidance
  - Error boundaries: display user-friendly error messages, never raw stack traces
  - Use Nuxt's <NuxtErrorBoundary> component at page level

## Output Format
When writing files, use the FileWrite tool. When searching, prefer Grep and Glob.
After each file write, note the file path so the QA verifier can find it.`
}
```

---

## 3. SupabaseTool

### 3.1 Zod Schemas

```typescript
// File: apps/agent-runtime/src/tools/supabase/SupabaseTool.ts

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError } from '../ToolV2.js'
import type { ToolV2, ToolUseContext, CanUseToolFn } from '../ToolV2.js'

// ── Input Schema ──────────────────────────────────────────────────────────

export const SupabaseActionEnum = z.enum([
  'create_table',
  'add_column',
  'add_rls',
  'create_migration',
  'create_type',
])

export const RlsPolicyEnum = z.enum([
  'authenticated',   // Only authenticated users
  'public',          // Anyone (anon + authenticated)
  'owner_only',      // Only the row creator (user_id = auth.uid())
])

export const SupabaseInputSchema = z.object({
  action: SupabaseActionEnum.describe('The Supabase operation to perform'),

  // Common
  migration_name: z.string().optional()
    .describe('Descriptive name for the migration file (snake_case)'),

  // create_table
  table_name: z.string().optional()
    .describe('Name of the table to create (snake_case)'),
  columns: z.array(z.object({
    name: z.string().describe('Column name (snake_case)'),
    type: z.string().describe('PostgreSQL type, e.g. text, uuid, timestamptz, integer, boolean, jsonb'),
    nullable: z.boolean().optional().default(false),
    default: z.string().optional().describe('SQL default expression'),
    unique: z.boolean().optional().default(false),
    references: z.string().optional().describe('Foreign key reference, e.g. auth.users(id)'),
  })).optional().describe('Columns for create_table'),

  // add_column
  column_name: z.string().optional().describe('Column to add'),
  column_type: z.string().optional().describe('PostgreSQL type'),
  column_nullable: z.boolean().optional().default(true),
  column_default: z.string().optional(),

  // add_rls
  rls_policy: RlsPolicyEnum.optional()
    .describe('RLS policy type to apply'),
  rls_table: z.string().optional()
    .describe('Table to apply RLS to'),

  // create_migration
  migration_sql: z.string().optional()
    .describe('Raw SQL content for the migration file'),

  // create_type
  type_name: z.string().optional()
    .describe('Name of the TypeScript type to generate'),
  type_source_table: z.string().optional()
    .describe('Source table to derive the type from'),
})

export type SupabaseInput = z.infer<typeof SupabaseInputSchema>

// ── Output Schema ─────────────────────────────────────────────────────────

export const SupabaseOutputSchema = z.object({
  success: z.boolean(),
  migrationPath: z.string().optional()
    .describe('Relative path to the generated migration file'),
  error: z.string().optional()
    .describe('Error message if the operation failed'),
  sqlContent: z.string().optional()
    .describe('The generated SQL content for review'),
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
```

### 3.2 Tool Implementation

```typescript
// Continued in: apps/agent-runtime/src/tools/supabase/SupabaseTool.ts

export const SupabaseTool: ToolV2<SupabaseInput, SupabaseOutput> = buildToolV2({
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
  isConcurrencySafe: (input) => input.action !== 'create_migration',

  async call(
    input: SupabaseInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    _assistantMessage,
  ) {
    try {
      // Generate migration filename: YYYYMMDDHHMMSS_description.sql
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

      // Resolve migrations directory
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
            return createToolError(
              'table_name and columns are required for create_table action'
            )
          }
          const cols = input.columns.map((col) => {
            let def = `  ${col.name} ${col.type}`
            if (!col.nullable) def += ' NOT NULL'
            if (col.default) def += ` DEFAULT ${col.default}`
            if (col.unique) def += ' UNIQUE'
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
            return createToolError(
              'table_name, column_name, and column_type are required for add_column'
            )
          }
          const nullableClause = input.column_nullable ? '' : ' NOT NULL'
          const defaultClause = input.column_default ? ` DEFAULT ${input.column_default}` : ''
          sqlContent = `ALTER TABLE ${input.table_name}\n` +
            `  ADD COLUMN IF NOT EXISTS ${input.column_name} ${input.column_type}${nullableClause}${defaultClause};\n`
          break
        }

        case 'add_rls': {
          if (!input.rls_table || !input.rls_policy) {
            return createToolError(
              'rls_table and rls_policy are required for add_rls action'
            )
          }
          const templateFn = RLS_TEMPLATES[input.rls_policy]
          if (!templateFn) {
            return createToolError(`Unknown RLS policy: ${input.rls_policy}`)
          }
          sqlContent = templateFn(input.rls_table)
          break
        }

        case 'create_migration': {
          if (!input.migration_sql) {
            return createToolError(
              'migration_sql is required for create_migration action'
            )
          }
          sqlContent = `-- Migration: ${migrationName}\n-- Generated: ${now.toISOString()}\n\n${input.migration_sql}\n`
          break
        }

        case 'create_type': {
          // Generate TypeScript type for a Supabase table
          if (!input.type_name || !input.type_source_table) {
            return createToolError(
              'type_name and type_source_table are required for create_type action'
            )
          }
          sqlContent = `-- Migration: ${migrationName}\n-- Generated: ${now.toISOString()}\n\n` +
            `-- This migration adds a COMMENT that triggers type generation\n` +
            `COMMENT ON TABLE ${input.type_source_table} IS 'TypeScript type: ${input.type_name}';\n`
          break
        }
      }

      // Write the migration file
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
      return createToolError(`SupabaseTool error: ${msg}`)
    }
  },

  async checkPermissions(input, context) {
    // Always ask before running SQL-generating operations
    return { behavior: 'ask', prompt: `Generate Supabase migration: ${input.action}?` }
  },

  renderToolUseMessage(input) {
    return `Supabase: ${input.action}${input.table_name ? ` on ${input.table_name}` : ''}`
  },

  toAutoClassifierInput(input) {
    return `supabase ${input.action} ${input.table_name ?? ''}`
  },

  userFacingName() {
    return 'Supabase Migration'
  },
})

export default SupabaseTool
```

---

## 4. PreviewTool and TemplateTool

### 4.1 PreviewTool

```typescript
// File: apps/agent-runtime/src/tools/preview/PreviewTool.ts

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError } from '../ToolV2.js'

export const PreviewActionEnum = z.enum([
  'start',
  'stop',
  'restart',
  'status',
])

export const PreviewInputSchema = z.object({
  action: PreviewActionEnum.describe('Preview server action'),
  port: z.number().int().min(1024).max(65535).optional().default(3000)
    .describe('Port for the dev server'),
  command: z.string().optional()
    .describe('Custom command to start (default: "npm run dev")'),
  env: z.record(z.string()).optional()
    .describe('Additional environment variables'),
})

export const PreviewOutputSchema = z.object({
  success: z.boolean(),
  url: z.string().optional()
    .describe('URL of the running preview (e.g. http://localhost:3000)'),
  pid: z.number().optional()
    .describe('Process ID of the dev server'),
  status: z.enum(['running', 'stopped', 'error', 'unknown']).optional(),
  error: z.string().optional(),
})

export type PreviewInput = z.infer<typeof PreviewInputSchema>
export type PreviewOutput = z.infer<typeof PreviewOutputSchema>

// Process registry — in production this would use Redis or a shared map
const runningPreviews = new Map<string, { pid: number; port: number; url: string }>()

export const PreviewTool = buildToolV2<PreviewInput, PreviewOutput>({
  name: 'preview',
  description:
    'Start/stop/restart/check status of the Nuxt 3 / Vite dev server for previewing the frontend.',
  category: 'execute',
  aliases: ['dev', 'server'],

  inputSchema: PreviewInputSchema,
  outputSchema: PreviewOutputSchema,

  isReadOnly: (input) => input.action === 'status',
  isDestructive: (input) => input.action === 'stop',
  isConcurrencySafe: false,

  async call(input, context, canUseTool) {
    try {
      const { spawn, execSync } = await import('child_process')
      const { join } = await import('path')

      const workspaceKey = context.workspacePath
      const existing = runningPreviews.get(workspaceKey)

      switch (input.action) {
        case 'start': {
          if (existing) {
            return createToolResult<PreviewOutput>({
              success: true,
              url: existing.url,
              pid: existing.pid,
              status: 'running',
            })
          }

          const cmd = input.command ?? 'npm run dev'
          const [bin, ...args] = cmd.split(' ')

          const child = spawn(bin, args, {
            cwd: context.workspacePath,
            env: { ...process.env, ...input.env },
            stdio: 'pipe',
            shell: true,
          })

          const url = `http://localhost:${input.port}`

          child.on('error', (err) => {
            context.sendLog(`Preview start error: ${err.message}`, true)
          })

          runningPreviews.set(workspaceKey, {
            pid: child.pid!,
            port: input.port,
            url,
          })

          context.sendLog(`Preview server starting on ${url}`)

          // Timeout to check if server is actually up
          await new Promise((resolve) => setTimeout(resolve, 3000))

          return createToolResult<PreviewOutput>({
            success: true,
            url,
            pid: child.pid!,
            status: 'running',
          })
        }

        case 'stop': {
          if (!existing) {
            return createToolResult<PreviewOutput>({
              success: true,
              status: 'stopped',
            })
          }

          try {
            process.kill(existing.pid, 'SIGTERM')
          } catch {
            // Already dead — fine
          }

          runningPreviews.delete(workspaceKey)
          context.sendLog(`Preview server stopped (PID ${existing.pid})`)

          return createToolResult<PreviewOutput>({
            success: true,
            status: 'stopped',
          })
        }

        case 'restart': {
          // Composite: stop + start
          if (existing) {
            try { process.kill(existing.pid, 'SIGTERM') } catch {}
            runningPreviews.delete(workspaceKey)
          }

          const cmd = input.command ?? 'npm run dev'
          const [bin, ...args] = cmd.split(' ')
          const child = spawn(bin, args, {
            cwd: context.workspacePath,
            env: { ...process.env, ...input.env },
            stdio: 'pipe',
            shell: true,
          })

          const url = `http://localhost:${input.port}`
          runningPreviews.set(workspaceKey, { pid: child.pid!, port: input.port, url })

          await new Promise((resolve) => setTimeout(resolve, 3000))

          return createToolResult<PreviewOutput>({
            success: true,
            url,
            pid: child.pid!,
            status: 'running',
          })
        }

        case 'status': {
          if (existing) {
            // Check if the process is still alive
            try {
              process.kill(existing.pid, 0) // Signal 0 = check existence
              return createToolResult<PreviewOutput>({
                success: true,
                url: existing.url,
                pid: existing.pid,
                status: 'running',
              })
            } catch {
              runningPreviews.delete(workspaceKey)
              return createToolResult<PreviewOutput>({
                success: true,
                status: 'stopped',
              })
            }
          }

          return createToolResult<PreviewOutput>({
            success: true,
            status: 'unknown',
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return createToolError(`PreviewTool error: ${msg}`)
    }
  },

  checkPermissions: async (input, context) => {
    if (input.action === 'start' || input.action === 'restart') {
      return { behavior: 'ask', prompt: `Start dev server on port ${input.port}?` }
    }
    return { behavior: 'allow' }
  },

  renderToolUseMessage(input) {
    return `Preview: ${input.action} server on port ${input.port ?? 3000}`
  },

  toAutoClassifierInput(input) {
    return `preview ${input.action}`
  },

  userFacingName() { return 'Preview Server' },
})

export default PreviewTool
```

### 4.2 TemplateTool

```typescript
// File: apps/agent-runtime/src/tools/template/TemplateTool.ts

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError } from '../ToolV2.js'

export interface TemplateMeta {
  id: string
  name: string
  description: string
  category: 'landing' | 'dashboard' | 'ecommerce' | 'blog' | 'saas' | 'portfolio'
  uiFramework: 'element-plus' | 'tailwind-only' | 'radix-vue'
  cssApproach: 'tailwind' | 'scoped-scss' | 'css-modules'
  tailwindColors?: Record<string, string>
  fonts?: string[]
  spacing?: Record<string, string>
  darkMode?: 'class' | 'media' | false
  allowedDeps: string[]
  features: string[]
  complexity: 'low' | 'medium' | 'high'
}

const TemplateInputSchema = z.object({
  action: z.enum([
    'list_templates',
    'get_template_details',
    'recommend_template',
  ]).describe('Template operation to perform'),

  templateId: z.string().optional()
    .describe('Template ID for get_template_details'),

  requirements: z.string().optional()
    .describe('Natural language description of what you need, for recommendation'),

  categoryFilter: z.enum([
    'landing', 'dashboard', 'ecommerce', 'blog', 'saas', 'portfolio',
  ]).optional().describe('Filter templates by category'),

  complexityFilter: z.enum(['low', 'medium', 'high']).optional()
    .describe('Filter templates by complexity'),
})

const TemplateOutputSchema = z.object({
  success: z.boolean(),
  templates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    uiFramework: z.string(),
    features: z.array(z.string()),
    complexity: z.string(),
  })).optional(),
  template: z.any().optional(), // Full TemplateMeta
  recommendation: z.string().optional(),
  recommendationReason: z.string().optional(),
  error: z.string().optional(),
})

export type TemplateInput = z.infer<typeof TemplateInputSchema>
export type TemplateOutput = z.infer<typeof TemplateOutputSchema>

// ── Template Registry ─────────────────────────────────────────────────────

const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
    id: 'landing-saas-starter',
    name: 'SaaS Landing Starter',
    description: 'Modern SaaS landing page with hero, features, pricing, and CTA sections',
    category: 'landing',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#6366f1',     // indigo-500
      secondary: '#8b5cf6',   // violet-500
      accent: '#06b6d4',      // cyan-500
      background: '#0f172a',  // slate-900
      surface: '#1e293b',     // slate-800
      text: '#f8fafc',        // slate-50
    },
    fonts: ['Inter', 'JetBrains Mono'],
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
    darkMode: 'class',
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'vue-router', 'pinia'],
    features: [
      'Dark/light mode toggle',
      'Responsive hero with CTA',
      'Feature grid with icons',
      'Pricing table (3 tiers)',
      'Testimonial carousel',
      'Newsletter signup form',
      'Footer with social links',
    ],
    complexity: 'medium',
  },
  {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    description: 'Data-rich analytics dashboard with charts, tables, and filters',
    category: 'dashboard',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#3b82f6',     // blue-500
      secondary: '#10b981',   // emerald-500
      accent: '#f59e0b',      // amber-500
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
    },
    fonts: ['Inter'],
    spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
    darkMode: 'class',
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'echarts', 'vue-echarts', 'pinia'],
    features: [
      'Sidebar navigation',
      'KPI cards with trend indicators',
      'Line/bar/pie charts (ECharts)',
      'Data table with sorting/filtering',
      'Date range picker',
      'Export to CSV',
    ],
    complexity: 'high',
  },
  {
    id: 'blog-minimal',
    name: 'Minimal Blog',
    description: 'Clean, typography-focused blog with MDX support',
    category: 'blog',
    uiFramework: 'tailwind-only',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#0f172a',
      secondary: '#475569',
      accent: '#0ea5e9',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
    },
    fonts: ['Merriweather', 'Inter'],
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2.5rem', xl: '4rem' },
    darkMode: 'class',
    allowedDeps: ['@nuxt/content', 'pinia'],
    features: [
      'MDX-powered blog posts',
      'Tag/category system',
      'Reading time estimate',
      'Table of contents (auto-generated)',
      'Social sharing buttons',
      'RSS feed',
    ],
    complexity: 'low',
  },
  {
    id: 'ecommerce-storefront',
    name: 'E-Commerce Storefront',
    description: 'Full product catalog with cart, checkout, and user accounts',
    category: 'ecommerce',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#dc2626',
      secondary: '#f97316',
      accent: '#facc15',
      background: '#fafafa',
      surface: '#ffffff',
      text: '#171717',
    },
    fonts: ['Inter'],
    spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
    darkMode: false,
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'pinia', 'vue-router'],
    features: [
      'Product grid with filters',
      'Product detail page with image gallery',
      'Shopping cart (Pinia store)',
      'Checkout form with validation',
      'User profile page',
      'Search with debounce',
    ],
    complexity: 'high',
  },
]

// ── Tool Implementation ───────────────────────────────────────────────────

export const TemplateTool = buildToolV2<TemplateInput, TemplateOutput>({
  name: 'template',
  description:
    'Browse, inspect, and get recommendations for Nuxt 3 project templates. ' +
    'Use this before generating code to pick the right starting point.',
  category: 'read',
  aliases: ['templates', 'scaffold'],

  inputSchema: TemplateInputSchema,
  outputSchema: TemplateOutputSchema,

  isReadOnly: () => true,
  isDestructive: () => false,
  isConcurrencySafe: () => true,

  async call(input, context, canUseTool) {
    try {
      switch (input.action) {
        case 'list_templates': {
          let filtered = TEMPLATE_REGISTRY
          if (input.categoryFilter) {
            filtered = filtered.filter((t) => t.category === input.categoryFilter)
          }
          if (input.complexityFilter) {
            filtered = filtered.filter((t) => t.complexity === input.complexityFilter)
          }

          const templates = filtered.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            uiFramework: t.uiFramework,
            features: t.features.slice(0, 5),
            complexity: t.complexity,
          }))

          return createToolResult(
            { success: true, templates },
            {
              resultForAssistant:
                `Available templates (${templates.length}):\n` +
                templates.map((t) => `- ${t.id} (${t.category}, ${t.complexity}): ${t.description}`).join('\n'),
            }
          )
        }

        case 'get_template_details': {
          const template = TEMPLATE_REGISTRY.find((t) => t.id === input.templateId)
          if (!template) {
            return createToolError(`Template not found: ${input.templateId}`)
          }

          return createToolResult(
            { success: true, template },
            {
              resultForAssistant:
                `Template: ${template.name}\n` +
                `UI Framework: ${template.uiFramework}\n` +
                `Colors: ${JSON.stringify(template.tailwindColors)}\n` +
                `Fonts: ${template.fonts?.join(', ')}\n` +
                `Dependencies: ${template.allowedDeps.join(', ')}\n` +
                `Features: ${template.features.join(', ')}\n`,
            }
          )
        }

        case 'recommend_template': {
          if (!input.requirements) {
            return createToolError('requirements is required for recommend_template')
          }

          const requirements = input.requirements.toLowerCase()
          // Simple keyword-based scoring
          const keywords: Record<string, string[]> = {
            landing: ['landing', 'homepage', 'hero', 'cta', 'pricing', 'testimonial', 'newsletter'],
            dashboard: ['dashboard', 'analytics', 'charts', 'kpi', 'metrics', 'data', 'admin'],
            blog: ['blog', 'articles', 'posts', 'writing', 'content', 'mdx', 'typography'],
            ecommerce: ['ecommerce', 'shop', 'store', 'cart', 'checkout', 'product', 'catalog'],
          }

          let bestMatch: { template: TemplateMeta; score: number } | null = null

          for (const template of TEMPLATE_REGISTRY) {
            let score = 0
            const catKeywords = keywords[template.category] ?? []
            for (const kw of catKeywords) {
              if (requirements.includes(kw)) score += 3
            }
            for (const feature of template.features) {
              if (requirements.includes(feature.toLowerCase())) score += 2
            }
            if (requirements.includes(template.complexity)) score += 1

            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { template, score }
            }
          }

          if (!bestMatch) {
            return createToolResult({
              success: true,
              recommendation: 'landing-saas-starter',
              recommendationReason: 'Default recommendation — no specific keywords matched',
            })
          }

          return createToolResult(
            {
              success: true,
              recommendation: bestMatch.template.id,
              recommendationReason:
                `Best match: ${bestMatch.template.name} (score: ${bestMatch.score}). ` +
                `Category: ${bestMatch.template.category}, Complexity: ${bestMatch.template.complexity}`,
            },
            {
              resultForAssistant:
                `Recommended template: **${bestMatch.template.id}** (${bestMatch.template.name})\n` +
                `Reason: ${bestMatch.template.description}\n` +
                `Use \`template\` with \`get_template_details\` to inspect it.`,
            }
          )
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return createToolError(`TemplateTool error: ${msg}`)
    }
  },

  checkPermissions: async () => ({ behavior: 'allow' }),

  renderToolUseMessage(input) {
    return `Template: ${input.action}${input.templateId ? ` ${input.templateId}` : ''}`
  },

  toAutoClassifierInput(input) {
    return `template ${input.action}`
  },

  userFacingName() { return 'Template Browser' },
})

export default TemplateTool
```

---

## 5. QueryLoopV2Enhanced

### 5.1 ProgressChunk Interface and Async Generator

```typescript
// File: apps/agent-runtime/src/agent/QueryLoopV2Enhanced.ts

import { QueryLoopV2, type QueryLoopV2Config } from './QueryLoopV2.js'
import { ConversationContextV2 } from '../context/ConversationContextV2.js'
import type { LLMToolDefinition } from '../services/llm/types.js'

// ── Progress Chunk Interface ──────────────────────────────────────────────

export type ProgressState =
  | 'planning'         // Agent is analyzing the task and creating a plan
  | 'thinking'         // LLM is generating a response (pre-tool-call or reasoning)
  | 'streaming_token'  // A single token is being streamed to the client
  | 'tool_calling'     // A tool invocation is in progress
  | 'tool_result'      // A tool has returned its result
  | 'content'          // A complete content block (non-streaming fallback)
  | 'error'            // An error occurred
  | 'done'             // The query loop has completed

export interface ProgressChunk {
  state: ProgressState
  message?: string
  token?: string             // Used for streaming_token state
  toolName?: string          // Used for tool_calling / tool_result
  toolInput?: unknown        // The input sent to the tool
  toolOutput?: unknown       // The result returned from the tool
  progress?: number          // 0-100 percentage of overall task
  details?: Record<string, unknown> // Additional metadata (tokens, iteration, etc.)
}

// ── WSBroadcast Abstraction ───────────────────────────────────────────────

export interface WSBroadcast {
  /**
   * Send a progress chunk to all connected WebSocket clients.
   * In production, this publishes to Redis Pub/Sub or a WS room.
   */
  broadcast(chunk: ProgressChunk): void | Promise<void>
}

// ── Enhanced Config ───────────────────────────────────────────────────────

export interface QueryLoopV2EnhancedConfig extends QueryLoopV2Config {
  wsBroadcast?: WSBroadcast
}

// ── QueryLoopV2Enhanced ───────────────────────────────────────────────────

export class QueryLoopV2Enhanced extends QueryLoopV2 {
  private wsBroadcast: WSBroadcast | undefined

  constructor(config: QueryLoopV2EnhancedConfig) {
    super(config)
    this.wsBroadcast = config.wsBroadcast
  }

  /**
   * Executes the query loop as an async generator, yielding a ProgressChunk
   * for every meaningful state transition. This enables progressive UI updates
   * without polling.
   *
   * Usage:
   *   for await (const chunk of queryLoop.executeWithProgress(input, ctx)) {
   *     wsBroadcast.broadcast(chunk)
   *   }
   */
  async *executeWithProgress(
    userInput: string,
    context: ConversationContextV2,
    options?: {
      systemPrompt?: string
      model?: string
      tools?: LLMToolDefinition[]
    }
  ): AsyncGenerator<ProgressChunk, QueryLoopV2['prototype'], void> {
    // Phase 1: Planning
    yield {
      state: 'planning',
      message: 'Analyzing task and creating execution plan...',
      progress: 5,
      details: { inputLength: userInput.length },
    }

    if (options?.systemPrompt) {
      context.setSystemPrompt(options.systemPrompt)
    }
    context.addUserMessage(userInput)

    const availableTools = options?.tools ?? []

    let iteration = 0
    let finalContent = ''
    const toolCalls: Array<{ name: string; input: unknown; output: unknown; error?: string }> = []

    const maxIterations = 30

    while (iteration < maxIterations) {
      iteration++

      yield {
        state: 'thinking',
        message: `Iteration ${iteration}: Thinking...`,
        progress: Math.min(10 + (iteration / maxIterations) * 60, 70),
        details: { iteration },
      }

      // Call LLM with streaming
      const messages = context.toLLMMessages()
      let streamContent = ''

      try {
        for await (const chunk of (this as any).config.llmService.stream(messages, {
          model: options?.model,
          tools: availableTools.length > 0 ? availableTools : undefined,
        })) {
          if (chunk.content) {
            streamContent += chunk.content
            yield {
              state: 'streaming_token',
              token: chunk.content,
              progress: undefined,
              details: { iteration },
            }
          }

          // Handle tool calls at the end of streaming
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            for (const tc of chunk.toolCalls) {
              let toolInput: unknown
              try {
                toolInput = JSON.parse(tc.function.arguments || '{}')
              } catch {
                toolInput = { raw: tc.function.arguments }
              }

              yield {
                state: 'tool_calling',
                toolName: tc.function.name,
                toolInput,
                message: `Calling tool: ${tc.function.name}`,
                progress: undefined,
                details: { iteration, toolCallId: tc.id },
              }

              // Execute tool (simplified — actual implementation delegates to runLoop internals)
              try {
                const result = await (this as any).executeTool(tc.function.name, toolInput, iteration)
                const output = result.data ?? result

                yield {
                  state: 'tool_result',
                  toolName: tc.function.name,
                  toolInput,
                  toolOutput: output,
                  message: `Tool ${tc.function.name} completed`,
                  progress: undefined,
                  details: { iteration, success: true },
                }

                toolCalls.push({
                  name: tc.function.name,
                  input: toolInput,
                  output,
                })
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'

                yield {
                  state: 'tool_result',
                  toolName: tc.function.name,
                  toolInput,
                  toolOutput: null,
                  message: `Tool ${tc.function.name} failed: ${errMsg}`,
                  progress: undefined,
                  details: { iteration, success: false, error: errMsg },
                }

                toolCalls.push({
                  name: tc.function.name,
                  input: toolInput,
                  output: null,
                  error: errMsg,
                })
              }
            }

            // Add tool results to context
            context.addToolResults(
              toolCalls.slice(-chunk.toolCalls.length).map((_, i) => {
                const tc = chunk.toolCalls![i]
                const result = toolCalls[toolCalls.length - chunk.toolCalls!.length + i]
                return {
                  toolCallId: tc.id,
                  output: result.output,
                  error: result.error,
                }
              })
            )

            // Continue loop for LLM to process tool results
            continue
          }
        }

        // If we got content without tool calls, add it and break
        if (streamContent) {
          finalContent += streamContent
          context.addAssistantMessage(streamContent)
        }

        yield {
          state: 'content',
          message: streamContent.slice(0, 200) + (streamContent.length > 200 ? '...' : ''),
          progress: 85,
          details: { iteration, contentLength: streamContent.length },
        }

        break // No tool calls → done
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'

        yield {
          state: 'error',
          message: `Error in iteration ${iteration}: ${errMsg}`,
          progress: undefined,
          details: { iteration, error: errMsg },
        }

        // Return the partial result wrapped in the right type
        // (QueryLoopV2Result shape)
        return {
          success: false,
          content: finalContent,
          toolCalls,
          iterations: iteration,
          compactionCount: 0,
          tokensSaved: 0,
          error: errMsg,
          duration: 0,
        } as any
      }
    }

    // Phase 4: Done
    yield {
      state: 'done',
      message: 'Task completed',
      progress: 100,
      details: { iterations: iteration, toolCalls: toolCalls.length },
    }

    return {
      success: true,
      content: finalContent,
      toolCalls,
      iterations: iteration,
      compactionCount: 0,
      tokensSaved: 0,
      duration: 0,
    } as any
  }
}

export default QueryLoopV2Enhanced
```

---

## 6. ConversationContextV3

### 6.1 Extended Context with Generation Tracking

```typescript
// File: apps/agent-runtime/src/context/ConversationContextV3.ts

import { ConversationContextV2 } from './ConversationContextV2.js'

// ── Verification Types ────────────────────────────────────────────────────

export interface StepResult {
  stepName: string          // e.g. "a11y_check", "typescript_check", "file_structure_check"
  passed: boolean
  message: string
  details?: Record<string, unknown>
  timestamp: number
}

export interface VerificationAttempt {
  attempt: number           // 1-based attempt counter
  steps: StepResult[]
  passed: boolean           // All steps passed
  commitSha?: string        // Git commit SHA if auto-committed
  startedAt: number
  completedAt: number
}

// ── Generation Context ────────────────────────────────────────────────────

export interface GenerationContext {
  /** The template ID used for generation (from TemplateTool) */
  templateId: string

  /** Map of file path → file content hash for all generated files */
  generatedFiles: Map<string, string>

  /** Supabase schema tracking for migrations created during this generation */
  supabaseSchema: {
    tables: Array<{
      name: string
      columns: Array<{ name: string; type: string; nullable: boolean }>
      rlsPolicies: Array<{
        name: string
        type: 'authenticated' | 'public' | 'owner_only'
        operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
      }>
    }>
  }

  /** Ordered list of verification attempts */
  verificationHistory: VerificationAttempt[]

  /** SHA of the last commit that passed all verifications */
  lastSuccessfulCommit: string | null
}

// ── ConversationContextV3 ─────────────────────────────────────────────────

export class ConversationContextV3 extends ConversationContextV2 {
  private generationContext: GenerationContext

  constructor(options?: {
    maxTokens?: number
    compressionThreshold?: number
    targetTokens?: number
  }) {
    super(options)
    this.generationContext = {
      templateId: '',
      generatedFiles: new Map(),
      supabaseSchema: { tables: [] },
      verificationHistory: [],
      lastSuccessfulCommit: null,
    }
  }

  // ── Generation Context Accessors ────────────────────────────────────────

  getGenerationContext(): Readonly<GenerationContext> {
    return this.generationContext
  }

  setTemplateId(id: string): void {
    this.generationContext.templateId = id
  }

  trackGeneratedFile(filePath: string, content: string): void {
    this.generationContext.generatedFiles.set(filePath, content)
  }

  getGeneratedFiles(): Map<string, string> {
    return new Map(this.generationContext.generatedFiles)
  }

  getGeneratedFileCount(): number {
    return this.generationContext.generatedFiles.size
  }

  // ── Supabase Schema Tracking ────────────────────────────────────────────

  addSupabaseTable(
    name: string,
    columns: Array<{ name: string; type: string; nullable: boolean }>
  ): void {
    this.generationContext.supabaseSchema.tables.push({
      name,
      columns,
      rlsPolicies: [],
    })
  }

  addRlsPolicy(
    tableName: string,
    policy: { name: string; type: 'authenticated' | 'public' | 'owner_only'; operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' }
  ): void {
    const table = this.generationContext.supabaseSchema.tables.find(
      (t) => t.name === tableName
    )
    if (table) {
      table.rlsPolicies.push(policy)
    }
  }

  getSupabaseSchema(): GenerationContext['supabaseSchema'] {
    return {
      tables: this.generationContext.supabaseSchema.tables.map((t) => ({
        ...t,
        rlsPolicies: [...t.rlsPolicies],
      })),
    }
  }

  // ── Verification History ────────────────────────────────────────────────

  recordVerificationAttempt(attempt: VerificationAttempt): void {
    this.generationContext.verificationHistory.push(attempt)
    if (attempt.passed && attempt.commitSha) {
      this.generationContext.lastSuccessfulCommit = attempt.commitSha
    }
  }

  getVerificationHistory(): VerificationAttempt[] {
    return [...this.generationContext.verificationHistory]
  }

  getLastSuccessfulCommit(): string | null {
    return this.generationContext.lastSuccessfulCommit
  }

  getVerificationAttemptCount(): number {
    return this.generationContext.verificationHistory.length
  }

  /**
   * Answers: has the current generation passed all verification checks?
   */
  isVerified(): boolean {
    const last = this.generationContext.verificationHistory.at(-1)
    return last?.passed ?? false
  }

  // ── Serialization ───────────────────────────────────────────────────────

  override serialize(): string {
    const base = JSON.parse(super.serialize())
    return JSON.stringify({
      ...base,
      generationContext: {
        ...this.generationContext,
        generatedFiles: Array.from(this.generationContext.generatedFiles.entries()),
      },
    })
  }

  static override deserialize(data: string): ConversationContextV3 {
    const parsed = JSON.parse(data)
    const ctx = new ConversationContextV3({
      maxTokens: parsed.maxTokens,
      compressionThreshold: parsed.compressionThreshold,
      targetTokens: parsed.targetTokens,
    })

    // Restore base messages
    const baseCtx = super.deserialize(data)
    ctx.replaceMessages(baseCtx.getMessages())

    // Restore generation context
    if (parsed.generationContext) {
      ctx.generationContext = {
        ...parsed.generationContext,
        generatedFiles: new Map(parsed.generationContext.generatedFiles ?? []),
      }
    }

    return ctx
  }
}

export default ConversationContextV3
```

---

## 7. TokenBudgetManager

### 7.1 Configuration and Breakdown

```typescript
// File: apps/agent-runtime/src/context/TokenBudgetManager.ts

import type { ConversationContextV2 } from './ConversationContextV2.js'
import type { LLMMessage } from '../services/llm/types.js'

// ── Configuration ─────────────────────────────────────────────────────────

export interface TokenBudgetConfig {
  /** Hard ceiling for tokens per request (default: 8000) */
  maxTokens: number

  /** Trigger warning when usage exceeds this fraction of maxTokens (default: 0.8) */
  warningThreshold: number

  /** The model's context window size (used as absolute upper bound) */
  modelContextWindow: number

  /** Minimum number of turns to preserve during trimming */
  minConversationTurns: number
}

export const DEFAULT_TOKEN_BUDGET_CONFIG: TokenBudgetConfig = {
  maxTokens: 8000,
  warningThreshold: 0.8,     // 6400 tokens — warn above this
  modelContextWindow: 200000, // e.g. Claude Sonnet 4
  minConversationTurns: 4,
}

// ── Token Breakdown ───────────────────────────────────────────────────────

export interface TokenBreakdown {
  systemPrompt: number
  conversationHistory: number
  generationContext: number  // Template config, supabase schema, verification logs
  tools: number              // Tool definitions in the system prompt
  available: number          // maxTokens - (systemPrompt + conversationHistory + generationContext + tools)
  total: number
  percentUsed: number
  needsCompaction: boolean
}

// ── Compaction Trigger ────────────────────────────────────────────────────

export type CompactionTrigger = 'none' | 'warning' | 'critical' | 'forced'

// ── Sliding Window Token History ──────────────────────────────────────────

interface TokenSnapshot {
  timestamp: number
  iteration: number
  tokensUsed: number
  breakdown: TokenBreakdown
}

const TOKEN_HISTORY_WINDOW = 50 // Keep last 50 snapshots

// ── TokenBudgetManager ────────────────────────────────────────────────────

export class TokenBudgetManager {
  private config: TokenBudgetConfig
  private history: TokenSnapshot[] = []

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = { ...DEFAULT_TOKEN_BUDGET_CONFIG, ...config }
  }

  /**
   * Produce a token budget breakdown for the given context and tool definitions.
   * Returns a TokenBreakdown with per-category token counts and compaction advice.
   */
  breakdown(
    context: ConversationContextV2,
    toolDefinitions: Array<{ function: { name: string; description: string; parameters?: unknown } }>
  ): TokenBreakdown {
    const messages = context.getMessages()
    const stats = context.getStats()

    // 1. System prompt tokens
    const systemMessages = messages.filter((m) => m.role === 'system')
    const systemPrompt = systemMessages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0
    )

    // 2. Conversation history tokens (non-system messages)
    const conversationMessages = messages.filter((m) => m.role !== 'system')
    const conversationHistory = conversationMessages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0
    )

    // 3. Tool definitions tokens
    const tools = toolDefinitions.reduce((sum, t) => {
      const desc = t.function.description ?? ''
      const params = t.function.parameters
        ? JSON.stringify(t.function.parameters)
        : ''
      return sum + this.estimateTokens(desc + params)
    }, 0)

    // 4. Generation context (approximated from stats)
    const generationContext = 0 // Populated by ConversationContextV3

    const total = systemPrompt + conversationHistory + generationContext + tools
    const available = Math.max(0, this.config.maxTokens - total)
    const percentUsed = (total / this.config.maxTokens) * 100

    const needsCompaction = available < this.config.maxTokens * 0.2 // < 20% free

    return {
      systemPrompt,
      conversationHistory,
      generationContext,
      tools,
      available,
      total,
      percentUsed,
      needsCompaction,
    }
  }

  /**
   * Determine compaction urgency level.
   */
  getCompactionTrigger(breakdown: TokenBreakdown): CompactionTrigger {
    const free = breakdown.available
    const max = this.config.maxTokens

    // Critical: < 10% free → full compaction needed
    if (free < max * 0.1) return 'critical'
    // Warning: < 20% free → compact soon
    if (free < max * 0.2) return 'warning'
    // Forced: over context window
    if (breakdown.total > this.config.modelContextWindow * 0.9) return 'forced'

    return 'none'
  }

  /**
   * Rebalancing priority queue — returns the compaction steps in order.
   * The caller should apply steps until token budget is satisfied.
   *
   * Priority 1: Trim conversation history (keep last N turns)
   * Priority 2: Truncate tool results (keep errors, summarize success)
   * Priority 3: Compress generation context (keep file signatures only)
   * Priority 4: Full compaction (summarize everything, produce COMPACTION_SUMMARY)
   */
  rebalancingPriority(breakdown: TokenBreakdown): Array<{
    priority: number
    name: string
    estTokenSavings: number
    reversible: boolean
  }> {
    const steps: Array<{
      priority: number
      name: string
      estTokenSavings: number
      reversible: boolean
    }> = []

    // Priority 1: Trim conversation history
    if (breakdown.conversationHistory > 0) {
      const trimTarget = Math.floor(breakdown.conversationHistory * 0.5)
      steps.push({
        priority: 1,
        name: 'Trim conversation history (keep last N turns)',
        estTokenSavings: trimTarget,
        reversible: false, // Trimmed messages are lost
      })
    }

    // Priority 2: Truncate tool results
    if (breakdown.conversationHistory > 0) {
      // Rough estimate: tool results are ~40% of conversation
      const truncateTarget = Math.floor(breakdown.conversationHistory * 0.2)
      steps.push({
        priority: 2,
        name: 'Truncate tool results (keep errors, summarize success)',
        estTokenSavings: truncateTarget,
        reversible: false,
      })
    }

    // Priority 3: Compress generation context
    if (breakdown.generationContext > 0) {
      const compressTarget = Math.floor(breakdown.generationContext * 0.7)
      steps.push({
        priority: 3,
        name: 'Compress generation context (keep file signatures only)',
        estTokenSavings: compressTarget,
        reversible: true, // Can be restored from GenerationContext
      })
    }

    // Priority 4: Full compaction
    steps.push({
      priority: 4,
      name: 'Full compaction (summarize everything, produce COMPACTION_SUMMARY)',
      estTokenSavings: Math.floor(breakdown.total * 0.6),
      reversible: false,
    })

    return steps
  }

  /**
   * Record a token snapshot for trend analysis.
   */
  recordSnapshot(iteration: number, breakdown: TokenBreakdown): void {
    this.history.push({
      timestamp: Date.now(),
      iteration,
      tokensUsed: breakdown.total,
      breakdown,
    })

    // Sliding window — keep only last TOKEN_HISTORY_WINDOW entries
    if (this.history.length > TOKEN_HISTORY_WINDOW) {
      this.history = this.history.slice(-TOKEN_HISTORY_WINDOW)
    }
  }

  /**
   * Get token usage trend: average tokens per iteration over the last N iterations.
   */
  getTrend(lastN: number = 10): {
    avgTokensPerIteration: number
    trendDirection: 'growing' | 'stable' | 'shrinking'
    projectedExhaustionIteration: number | null
  } {
    const relevant = this.history.slice(-lastN)
    if (relevant.length < 2) {
      return {
        avgTokensPerIteration: relevant[0]?.tokensUsed ?? 0,
        trendDirection: 'stable',
        projectedExhaustionIteration: null,
      }
    }

    const avg = relevant.reduce((sum, s) => sum + s.tokensUsed, 0) / relevant.length

    // Simple linear trend
    const first = relevant[0].tokensUsed
    const last = relevant[relevant.length - 1].tokensUsed
    const delta = last - first

    let trendDirection: 'growing' | 'stable' | 'shrinking'
    if (delta > avg * 0.1) trendDirection = 'growing'
    else if (delta < -avg * 0.1) trendDirection = 'shrinking'
    else trendDirection = 'stable'

    // Project exhaustion
    let projectedExhaustionIteration: number | null = null
    if (trendDirection === 'growing' && relevant.length >= 3) {
      const lastIteration = relevant[relevant.length - 1].iteration
      const tokensPerIter = delta / relevant.length
      const remainingBudget = this.config.maxTokens - last
      if (tokensPerIter > 0) {
        projectedExhaustionIteration =
          lastIteration + Math.floor(remainingBudget / tokensPerIter)
      }
    }

    return {
      avgTokensPerIteration: Math.round(avg),
      trendDirection,
      projectedExhaustionIteration,
    }
  }

  /**
   * Determine whether compaction is needed based on `available < 20% of max`.
   */
  shouldCompact(breakdown: TokenBreakdown): boolean {
    return breakdown.needsCompaction
  }

  /**
   * Update the configuration at runtime.
   */
  updateConfig(partial: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  getConfig(): Readonly<TokenBudgetConfig> {
    return this.config
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private estimateTokens(text: string): number {
    // Matches the estimator in ConversationContextV2 (line 22-28):
    // Chinese chars ~1 token each, others ~4 chars/token
    if (!text) return 0
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars + otherChars / 4)
  }
}

export default TokenBudgetManager
```

---

## Appendix A: Tool Registration Update

After adding the new tools, update `registerStandardTools()` in
`apps/agent-runtime/src/tools/index.ts:157` and `apps/agent-runtime/src/index.ts:260`
to register the 4 new tools alongside the existing 10:

```typescript
// Add to registerStandardTools() in both files:

import { SupabaseTool } from './supabase/SupabaseTool.js'
import { PreviewTool } from './preview/PreviewTool.js'
import { TemplateTool } from './template/TemplateTool.js'

// ... inside registerStandardTools():
registry.register(SupabaseTool)   // Registration #11
registry.register(PreviewTool)    // Registration #12
registry.register(TemplateTool)   // Registration #13
```

Total tools after extension: **13** (10 existing + 3 new).

> Note: `SupabaseTool`, `PreviewTool`, and `TemplateTool` are ToolV2 implementations.
> They integrate with `QueryLoopV2` via `ToolRegistryV2` (defined in
> `apps/agent-runtime/src/tools/registry/ToolRegistryV2.ts`).

---

## Appendix B: File Path Index

| Component | Absolute Path | Lines |
|---|---|---|
| AgentSystem (AgentManager) | `apps/agent-runtime/src/agent/AgentSystem.ts` | 1121 |
| QueryLoopV2 | `apps/agent-runtime/src/agent/QueryLoopV2.ts` | 652 |
| SubAgent | `apps/agent-runtime/src/agent/SubAgent.ts` | 374 |
| ToolV2 | `apps/agent-runtime/src/tools/ToolV2.ts` | 478 |
| BaseAgentRuntime | `apps/agent-runtime/src/services/BaseAgentRuntime.ts` | 246 |
| LLMService | `apps/agent-runtime/src/services/llm/LLMService.ts` | 307 |
| PermissionManager | `apps/agent-runtime/src/permissions/PermissionManager.ts` | 495 |
| CompactionEngine | `apps/agent-runtime/src/context/compact/CompactionEngine.ts` | 532 |
| ConversationContextV2 | `apps/agent-runtime/src/context/ConversationContextV2.ts` | 389 |
| TempDirIsolation | `apps/agent-runtime/src/agent/isolation/TempDirIsolation.ts` | 292 |
| WorktreeIsolation | `apps/agent-runtime/src/agent/isolation/WorktreeIsolation.ts` | 287 |
| Tools index | `apps/agent-runtime/src/tools/index.ts` | 198 |
| Main index | `apps/agent-runtime/src/index.ts` | 351 |
| System prompts | `AGENTS/shared/prompts/system-*.md` | — |

---

## Appendix C: Data Flow Diagram

```
User Request
    │
    ▼
┌─────────────────────┐
│  Orchestrator Agent  │  (AGENTS/orchestrator.ts)
│  (阿黄 / Tech Lead)  │
└────────┬────────────┘
         │ dispatches to
         ▼
┌──────────────────────────────┐
│     QueryLoopV2Enhanced      │  (Section 5)
│  executeWithProgress()       │
│  State machine:              │
│    planning → thinking →     │
│    streaming_token →         │
│    tool_calling →            │
│    tool_result → content →   │
│    done                      │
└──┬───────────┬───────────┬───┘
   │           │           │
   ▼           ▼           ▼
┌───────┐ ┌─────────┐ ┌─────────┐
│frontend│ │supabase │ │qa_verif │  Agent Types
│_gen   │ │_gen     │ │ier      │  (Section 1)
└───┬───┘ └────┬────┘ └────┬────┘
    │          │            │
    ▼          ▼            ▼
┌────────┐ ┌────────┐ ┌──────────┐
│Preview │ │Supabase│ │FileRead/ │  Tools
│Tool    │ │Tool    │ │Grep tools│  (Sections 3-4)
│Template│ │(SQL gen│ └──────────┘
│Tool    │ │ + RLS) │
└────────┘ └────────┘
    │          │            │
    └──────────┴────────────┘
               │
               ▼
    ┌─────────────────────┐
    │ ConversationContextV3 │  (Section 6)
    │ TokenBudgetManager   │  (Section 7)
    │ CompactionEngine     │
    └─────────────────────┘
               │
               ▼
    ┌─────────────────────┐
    │   WSBroadcast       │
    │   (ProgressChunks to │
    │    client UI)        │
    └─────────────────────┘
```
