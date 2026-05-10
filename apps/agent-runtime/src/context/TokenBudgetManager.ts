/**
 * TokenBudgetManager — Token 预算管理和压缩触发决策
 *
 * Features:
 * - Token 预算分解 (system prompt / conversation / generation context / tools)
 * - Compaction 触发等级 (none / warning / critical / forced)
 * - Sliding window token history with trend analysis
 * - Rebalancing priority queue
 *
 * 对应 spec/002-agent-runtime.md §7
 */

import type { ConversationContextV2 } from './ConversationContextV2.js'

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
   */
  breakdown(
    context: ConversationContextV2,
    toolDefinitions: Array<{ function: { name: string; description: string; parameters?: unknown } }>
  ): TokenBreakdown {
    const messages = context.getMessages()

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
   * Rebalancing priority queue — returns compaction steps in order.
   *
   * Priority 1: Trim conversation history (keep last N turns)
   * Priority 2: Truncate tool results (keep errors, summarize success)
   * Priority 3: Compress generation context (keep file signatures only)
   * Priority 4: Full compaction (summarize everything)
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
        reversible: false,
      })
    }

    // Priority 2: Truncate tool results
    if (breakdown.conversationHistory > 0) {
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
        reversible: true,
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

    // Sliding window
    if (this.history.length > TOKEN_HISTORY_WINDOW) {
      this.history = this.history.slice(-TOKEN_HISTORY_WINDOW)
    }
  }

  /**
   * Get token usage trend over the last N iterations.
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
   * Determine whether compaction is needed.
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
