/**
 * ConversationContextV3 Unit Tests
 *
 * Covers:
 * - Generation context initialization and accessors
 * - Generated file tracking
 * - Supabase schema tracking (tables + RLS policies)
 * - Verification history management
 * - Serialization / deserialization (including Map → Array conversion)
 *
 * 对应 spec/002-agent-runtime.md §6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConversationContextV3,
  type GenerationContext,
  type VerificationAttempt,
  type StepResult,
} from '../../src/context/ConversationContextV3.js'

// ==========================================================================
// Helpers
// ==========================================================================

function makeStep(
  stepName: string,
  passed: boolean,
  message: string,
  details?: Record<string, unknown>,
): StepResult {
  return {
    stepName,
    passed,
    message,
    details,
    timestamp: Date.now(),
  }
}

function makeVerificationAttempt(
  attempt: number,
  steps: StepResult[],
  commitSha?: string,
): VerificationAttempt {
  const passed = steps.every((s) => s.passed)
  return {
    attempt,
    steps,
    passed,
    commitSha,
    startedAt: Date.now() - 1000,
    completedAt: Date.now(),
  }
}

// ==========================================================================
// Tests
// ==========================================================================

describe('ConversationContextV3', () => {
  let ctx: ConversationContextV3

  beforeEach(() => {
    ctx = new ConversationContextV3()
  })

  // ── Initialization ────────────────────────────────────────────────────

  describe('initialization', () => {
    it('should initialize with empty generation context', () => {
      const genCtx = ctx.getGenerationContext()
      expect(genCtx.templateId).toBe('')
      expect(genCtx.generatedFiles.size).toBe(0)
      expect(genCtx.supabaseSchema.tables).toEqual([])
      expect(genCtx.verificationHistory).toEqual([])
      expect(genCtx.lastSuccessfulCommit).toBeNull()
    })

    it('should accept custom options and pass them to parent', () => {
      const custom = new ConversationContextV3({
        maxTokens: 5000,
        compressionThreshold: 4000,
        targetTokens: 2000,
      })
      // V3 inherits from V2 — verify it doesn't throw and has gen context
      const genCtx = custom.getGenerationContext()
      expect(genCtx.templateId).toBe('')
    })
  })

  // ── Template ID ───────────────────────────────────────────────────────

  describe('setTemplateId / getGenerationContext', () => {
    it('should set and expose the template ID', () => {
      ctx.setTemplateId('landing-saas-starter')
      expect(ctx.getGenerationContext().templateId).toBe('landing-saas-starter')
    })

    it('should overwrite previous template ID', () => {
      ctx.setTemplateId('blog-minimal')
      ctx.setTemplateId('dashboard-analytics')
      expect(ctx.getGenerationContext().templateId).toBe('dashboard-analytics')
    })

    it('should accept any string template ID', () => {
      ctx.setTemplateId('custom-project-template-v3')
      expect(ctx.getGenerationContext().templateId).toBe('custom-project-template-v3')
    })
  })

  // ── Generated File Tracking ───────────────────────────────────────────

  describe('trackGeneratedFile / getGeneratedFiles / getGeneratedFileCount', () => {
    it('should track a single generated file', () => {
      ctx.trackGeneratedFile('pages/index.vue', '<template>...</template>')
      expect(ctx.getGeneratedFileCount()).toBe(1)
      expect(ctx.getGeneratedFiles().get('pages/index.vue')).toBe('<template>...</template>')
    })

    it('should track multiple generated files', () => {
      ctx.trackGeneratedFile('pages/index.vue', 'a')
      ctx.trackGeneratedFile('components/Header.vue', 'b')
      ctx.trackGeneratedFile('stores/useCart.ts', 'c')
      expect(ctx.getGeneratedFileCount()).toBe(3)
      expect(ctx.getGeneratedFiles().get('components/Header.vue')).toBe('b')
    })

    it('should overwrite file content on duplicate path', () => {
      ctx.trackGeneratedFile('pages/index.vue', 'version-1')
      ctx.trackGeneratedFile('pages/index.vue', 'version-2')
      expect(ctx.getGeneratedFileCount()).toBe(1)
      expect(ctx.getGeneratedFiles().get('pages/index.vue')).toBe('version-2')
    })

    it('should return a defensive copy of the Map', () => {
      ctx.trackGeneratedFile('a.ts', 'x')
      const files = ctx.getGeneratedFiles()
      files.set('b.ts', 'y')
      // Original context should not be affected
      expect(ctx.getGeneratedFileCount()).toBe(1)
    })

    it('should track empty content strings', () => {
      ctx.trackGeneratedFile('empty.vue', '')
      expect(ctx.getGeneratedFileCount()).toBe(1)
      expect(ctx.getGeneratedFiles().get('empty.vue')).toBe('')
    })

    it('should return 0 for getGeneratedFileCount when no files tracked', () => {
      expect(ctx.getGeneratedFileCount()).toBe(0)
    })
  })

  // ── Supabase Schema Tracking ─────────────────────────────────────────

  describe('addSupabaseTable / getSupabaseSchema', () => {
    it('should add a table with columns to the schema', () => {
      ctx.addSupabaseTable('profiles', [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'username', type: 'text', nullable: false },
        { name: 'avatar_url', type: 'text', nullable: true },
      ])

      const schema = ctx.getSupabaseSchema()
      expect(schema.tables).toHaveLength(1)
      expect(schema.tables[0].name).toBe('profiles')
      expect(schema.tables[0].columns).toHaveLength(3)
      expect(schema.tables[0].columns[0]).toEqual({
        name: 'id',
        type: 'uuid',
        nullable: false,
      })
      expect(schema.tables[0].rlsPolicies).toEqual([])
    })

    it('should track multiple tables independently', () => {
      ctx.addSupabaseTable('users', [
        { name: 'id', type: 'uuid', nullable: false },
      ])
      ctx.addSupabaseTable('posts', [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'title', type: 'text', nullable: false },
      ])

      const schema = ctx.getSupabaseSchema()
      expect(schema.tables).toHaveLength(2)
      expect(schema.tables[0].name).toBe('users')
      expect(schema.tables[1].name).toBe('posts')
      expect(schema.tables[1].columns).toHaveLength(2)
    })

    it('should return a defensive copy of the schema', () => {
      ctx.addSupabaseTable('test', [
        { name: 'col', type: 'text', nullable: true },
      ])

      const schema = ctx.getSupabaseSchema()
      schema.tables.push({
        name: 'injected',
        columns: [],
        rlsPolicies: [],
      })
      // Should not affect original
      expect(ctx.getSupabaseSchema().tables).toHaveLength(1)
    })
  })

  // ── RLS Policy Tracking ──────────────────────────────────────────────

  describe('addRlsPolicy', () => {
    beforeEach(() => {
      ctx.addSupabaseTable('documents', [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'user_id', type: 'uuid', nullable: false },
      ])
    })

    it('should add an RLS policy to an existing table', () => {
      ctx.addRlsPolicy('documents', {
        name: 'documents_select_policy',
        type: 'authenticated',
        operation: 'SELECT',
      })

      const table = ctx.getSupabaseSchema().tables[0]
      expect(table.rlsPolicies).toHaveLength(1)
      expect(table.rlsPolicies[0]).toEqual({
        name: 'documents_select_policy',
        type: 'authenticated',
        operation: 'SELECT',
      })
    })

    it('should add multiple RLS policies to the same table', () => {
      ctx.addRlsPolicy('documents', {
        name: 'select_policy',
        type: 'authenticated',
        operation: 'SELECT',
      })
      ctx.addRlsPolicy('documents', {
        name: 'insert_policy',
        type: 'authenticated',
        operation: 'INSERT',
      })
      ctx.addRlsPolicy('documents', {
        name: 'owner_update',
        type: 'owner_only',
        operation: 'UPDATE',
      })

      const table = ctx.getSupabaseSchema().tables[0]
      expect(table.rlsPolicies).toHaveLength(3)
      expect(table.rlsPolicies.map((p) => p.name)).toEqual([
        'select_policy',
        'insert_policy',
        'owner_update',
      ])
    })

    it('should silently ignore RLS policies for non-existent tables', () => {
      ctx.addRlsPolicy('nonexistent', {
        name: 'orphan_policy',
        type: 'public',
        operation: 'SELECT',
      })

      // Schema should be unchanged
      const table = ctx.getSupabaseSchema().tables[0]
      expect(table.rlsPolicies).toHaveLength(0)
    })

    it('should accept all RLS policy types', () => {
      ctx.addRlsPolicy('documents', {
        name: 'p1',
        type: 'authenticated',
        operation: 'SELECT',
      })
      ctx.addRlsPolicy('documents', {
        name: 'p2',
        type: 'public',
        operation: 'INSERT',
      })
      ctx.addRlsPolicy('documents', {
        name: 'p3',
        type: 'owner_only',
        operation: 'DELETE',
      })

      const table = ctx.getSupabaseSchema().tables[0]
      expect(table.rlsPolicies.map((p) => p.type)).toEqual([
        'authenticated',
        'public',
        'owner_only',
      ])
    })

    it('should accept all CRUD operations', () => {
      const ops: Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'> = [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
      ]
      for (const op of ops) {
        ctx.addRlsPolicy('documents', {
          name: `policy_${op.toLowerCase()}`,
          type: 'authenticated',
          operation: op,
        })
      }

      const table = ctx.getSupabaseSchema().tables[0]
      expect(table.rlsPolicies.map((p) => p.operation)).toEqual(ops)
    })

    it('should add policies to the correct table in multi-table schema', () => {
      ctx.addSupabaseTable('comments', [
        { name: 'id', type: 'uuid', nullable: false },
      ])
      ctx.addRlsPolicy('comments', {
        name: 'comments_policy',
        type: 'public',
        operation: 'SELECT',
      })

      const tables = ctx.getSupabaseSchema().tables
      expect(tables[0].rlsPolicies).toHaveLength(0) // documents — no policies
      expect(tables[1].rlsPolicies).toHaveLength(1) // comments — one policy
      expect(tables[1].rlsPolicies[0].name).toBe('comments_policy')
    })
  })

  // ── Verification History ─────────────────────────────────────────────

  describe('recordVerificationAttempt / getVerificationHistory', () => {
    it('should record a verification attempt', () => {
      const attempt = makeVerificationAttempt(1, [
        makeStep('typescript_check', true, 'All TS checks passed'),
        makeStep('a11y_check', true, 'All a11y checks passed'),
      ])

      ctx.recordVerificationAttempt(attempt)
      expect(ctx.getVerificationAttemptCount()).toBe(1)

      const history = ctx.getVerificationHistory()
      expect(history).toHaveLength(1)
      expect(history[0].attempt).toBe(1)
      expect(history[0].passed).toBe(true)
      expect(history[0].steps).toHaveLength(2)
    })

    it('should update lastSuccessfulCommit when passed attempt has commitSha', () => {
      const attempt = makeVerificationAttempt(
        1,
        [makeStep('lint', true, 'OK')],
        'abc123def456',
      )

      ctx.recordVerificationAttempt(attempt)
      expect(ctx.getLastSuccessfulCommit()).toBe('abc123def456')
    })

    it('should NOT update lastSuccessfulCommit when attempt is not passed', () => {
      const attempt = makeVerificationAttempt(1, [
        makeStep('typescript_check', false, 'TS errors found'),
      ])

      ctx.recordVerificationAttempt(attempt)
      expect(ctx.getLastSuccessfulCommit()).toBeNull()
    })

    it('should NOT update lastSuccessfulCommit when commitSha is missing', () => {
      const attempt = makeVerificationAttempt(1, [
        makeStep('lint', true, 'OK'),
      ])
      // no commitSha

      ctx.recordVerificationAttempt(attempt)
      expect(ctx.getLastSuccessfulCommit()).toBeNull()
    })

    it('should keep multiple attempts in order', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', true, 'OK')]),
      )
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(2, [makeStep('lint', false, 'Fail')]),
      )
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(3, [makeStep('lint', true, 'Fixed')], 'sha3'),
      )

      expect(ctx.getVerificationAttemptCount()).toBe(3)
      const history = ctx.getVerificationHistory()
      expect(history[0].attempt).toBe(1)
      expect(history[1].attempt).toBe(2)
      expect(history[2].attempt).toBe(3)
      expect(ctx.getLastSuccessfulCommit()).toBe('sha3')
    })

    it('should return a defensive copy of verification history', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', true, 'OK')]),
      )

      const history = ctx.getVerificationHistory()
      history.push(
        makeVerificationAttempt(99, [makeStep('fake', true, 'injected')]),
      )

      expect(ctx.getVerificationAttemptCount()).toBe(1)
    })
  })

  // ── isVerified ───────────────────────────────────────────────────────

  describe('isVerified', () => {
    it('should return false when no verification attempts exist', () => {
      expect(ctx.isVerified()).toBe(false)
    })

    it('should return true when last attempt passed', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', true, 'OK')]),
      )
      expect(ctx.isVerified()).toBe(true)
    })

    it('should return false when last attempt failed', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', true, 'OK')]),
      )
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(2, [makeStep('lint', false, 'Fail')]),
      )
      expect(ctx.isVerified()).toBe(false)
    })

    it('should return true again after re-verification passes', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', false, 'Fail')]),
      )
      expect(ctx.isVerified()).toBe(false)
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(2, [makeStep('lint', true, 'Fixed')]),
      )
      expect(ctx.isVerified()).toBe(true)
    })

    it('should consider all steps — any failure means not passed', () => {
      const attempt = makeVerificationAttempt(1, [
        makeStep('a11y', true, 'OK'),
        makeStep('typescript', false, 'TS error'),
        makeStep('seo', true, 'OK'),
      ])
      expect(attempt.passed).toBe(false)
      ctx.recordVerificationAttempt(attempt)
      expect(ctx.isVerified()).toBe(false)
    })
  })

  // ── Serialization / Deserialization ──────────────────────────────────

  describe('serialize / deserialize', () => {
    it('should serialize and deserialize a V3 context preserving messages', () => {
      ctx.setTemplateId('landing-saas-starter')
      ctx.addUserMessage('Generate a landing page')
      ctx.addAssistantMessage('Working on it...')

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getGenerationContext().templateId).toBe('landing-saas-starter')
      const messages = restored.getMessages()
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Generate a landing page')
    })

    it('should preserve generated files through serialization', () => {
      ctx.trackGeneratedFile('pages/index.vue', '<template>Hello</template>')
      ctx.trackGeneratedFile('stores/useCart.ts', 'export const useCart...')

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getGeneratedFileCount()).toBe(2)
      expect(restored.getGeneratedFiles().get('pages/index.vue')).toBe(
        '<template>Hello</template>',
      )
      expect(restored.getGeneratedFiles().get('stores/useCart.ts')).toBe(
        'export const useCart...',
      )
    })

    it('should preserve supabase schema through serialization', () => {
      ctx.addSupabaseTable('products', [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'name', type: 'text', nullable: false },
      ])
      ctx.addRlsPolicy('products', {
        name: 'products_select',
        type: 'authenticated',
        operation: 'SELECT',
      })

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      const schema = restored.getSupabaseSchema()
      expect(schema.tables).toHaveLength(1)
      expect(schema.tables[0].name).toBe('products')
      expect(schema.tables[0].columns).toHaveLength(2)
      expect(schema.tables[0].rlsPolicies).toHaveLength(1)
      expect(schema.tables[0].rlsPolicies[0].name).toBe('products_select')
    })

    it('should preserve verification history through serialization', () => {
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(1, [makeStep('lint', true, 'OK')], 'sha123'),
      )

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getVerificationAttemptCount()).toBe(1)
      expect(restored.getLastSuccessfulCommit()).toBe('sha123')
      expect(restored.isVerified()).toBe(true)
    })

    it('should handle round-trip with empty generation context', () => {
      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getGenerationContext().templateId).toBe('')
      expect(restored.getGeneratedFileCount()).toBe(0)
      expect(restored.getSupabaseSchema().tables).toEqual([])
      expect(restored.getVerificationHistory()).toEqual([])
      expect(restored.getLastSuccessfulCommit()).toBeNull()
    })

    it('should preserve custom constructor options through deserialization', () => {
      const custom = new ConversationContextV3({
        maxTokens: 9999,
        compressionThreshold: 7777,
      })
      custom.setTemplateId('blog-minimal')

      const serialized = custom.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getGenerationContext().templateId).toBe('blog-minimal')
    })

    it('should handle complex round-trip with all data', () => {
      ctx.setTemplateId('ecommerce-storefront')
      ctx.trackGeneratedFile('pages/products.vue', '<template>Products</template>')
      ctx.trackGeneratedFile('stores/useCart.ts', 'pinia store')
      ctx.addSupabaseTable('orders', [
        { name: 'id', type: 'uuid', nullable: false },
        { name: 'total', type: 'numeric', nullable: false },
      ])
      ctx.addRlsPolicy('orders', {
        name: 'orders_owner_select',
        type: 'owner_only',
        operation: 'SELECT',
      })
      ctx.recordVerificationAttempt(
        makeVerificationAttempt(
          1,
          [
            makeStep('typescript_check', true, 'Passed'),
            makeStep('a11y_check', true, 'Passed'),
            makeStep('seo_check', true, 'Passed'),
          ],
          'fedcba987',
        ),
      )

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      expect(restored.getGenerationContext().templateId).toBe('ecommerce-storefront')
      expect(restored.getGeneratedFileCount()).toBe(2)
      expect(restored.getSupabaseSchema().tables).toHaveLength(1)
      expect(restored.getSupabaseSchema().tables[0].rlsPolicies).toHaveLength(1)
      expect(restored.getVerificationAttemptCount()).toBe(1)
      expect(restored.getLastSuccessfulCommit()).toBe('fedcba987')
      expect(restored.isVerified()).toBe(true)
    })
  })

  // ── Integration with parent (V2) features ────────────────────────────

  describe('integration with ConversationContextV2', () => {
    it('should support addUserMessage from parent', () => {
      ctx.addUserMessage('Hello')
      const messages = ctx.getMessages()
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
    })

    it('should support setSystemPrompt from parent', () => {
      ctx.setSystemPrompt('You are a helpful assistant')
      const messages = ctx.getMessages()
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('You are a helpful assistant')
    })

    it('should support getStats from parent', () => {
      ctx.addUserMessage('Hello there friend')
      const stats = ctx.getStats()
      expect(stats.totalMessages).toBe(1)
      expect(stats.userMessages).toBe(1)
    })

    it('should preserve system prompt through serialize/deserialize', () => {
      ctx.setSystemPrompt('Custom system prompt for V3')
      ctx.addUserMessage('Test message')

      const serialized = ctx.serialize()
      const restored = ConversationContextV3.deserialize(serialized)

      const messages = restored.getMessages()
      const sysMsg = messages.find((m) => m.role === 'system')
      expect(sysMsg).toBeDefined()
      expect(sysMsg!.content).toBe('Custom system prompt for V3')
    })
  })
})
