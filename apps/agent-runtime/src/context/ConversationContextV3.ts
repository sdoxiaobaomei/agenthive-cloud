/**
 * ConversationContextV3 — Extended Context with Generation Tracking
 *
 * Extends ConversationContextV2 with:
 * - Generation context (template ID, generated files)
 * - Supabase schema tracking
 * - Verification history
 *
 * 对应 spec/002-agent-runtime.md §6
 */

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
