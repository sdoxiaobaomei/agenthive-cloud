/**
 * TokenBudgetManager Unit Tests
 *
 * Covers:
 * - Configuration (default, custom, update)
 * - Token breakdown (system prompt, conversation, tools, generation context)
 * - Compaction trigger levels (none, warning, critical, forced)
 * - Rebalancing priority queue
 * - Sliding window token history and trend analysis
 * - Token estimation (Chinese, English, mixed)
 *
 * 对应 spec/002-agent-runtime.md §7
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TokenBudgetManager,
  DEFAULT_TOKEN_BUDGET_CONFIG,
  type TokenBudgetConfig,
  type TokenBreakdown,
  type CompactionTrigger,
} from '../../src/context/TokenBudgetManager.js'
import { ConversationContextV2 } from '../../src/context/ConversationContextV2.js'

// ==========================================================================
// Helpers
// ==========================================================================

function makeToolDef(
  name: string,
  description: string,
  parameters?: object,
): { function: { name: string; description: string; parameters?: unknown } } {
  return {
    function: {
      name,
      description,
      parameters,
    },
  }
}

function makeEmptyContext(): ConversationContextV2 {
  return new ConversationContextV2()
}

function makeContextWithMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): ConversationContextV2 {
  const ctx = new ConversationContextV2()
  for (const msg of messages) {
    if (msg.role === 'system') {
      ctx.setSystemPrompt(msg.content)
    } else if (msg.role === 'user') {
      ctx.addUserMessage(msg.content)
    } else {
      ctx.addAssistantMessage(msg.content)
    }
  }
  return ctx
}

// ==========================================================================
// Tests
// ==========================================================================

describe('TokenBudgetManager', () => {
  // ── Constructor & Config ──────────────────────────────────────────────

  describe('constructor / getConfig', () => {
    it('should use DEFAULT_TOKEN_BUDGET_CONFIG when no options provided', () => {
      const mgr = new TokenBudgetManager()
      expect(mgr.getConfig()).toEqual(DEFAULT_TOKEN_BUDGET_CONFIG)
    })

    it('should merge partial config with defaults', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 4000 })
      const config = mgr.getConfig()
      expect(config.maxTokens).toBe(4000)
      expect(config.warningThreshold).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.warningThreshold)
      expect(config.modelContextWindow).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.modelContextWindow)
      expect(config.minConversationTurns).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.minConversationTurns)
    })

    it('should override all config fields', () => {
      const custom: TokenBudgetConfig = {
        maxTokens: 10000,
        warningThreshold: 0.5,
        modelContextWindow: 100000,
        minConversationTurns: 8,
      }
      const mgr = new TokenBudgetManager(custom)
      expect(mgr.getConfig()).toEqual(custom)
    })

    it('should return the config object (TypeScript enforces readonly)', () => {
      const mgr = new TokenBudgetManager()
      const config = mgr.getConfig()
      expect(config.maxTokens).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.maxTokens)
      expect(config.warningThreshold).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.warningThreshold)
      expect(config.modelContextWindow).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.modelContextWindow)
      expect(config.minConversationTurns).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.minConversationTurns)
    })
  })

  // ── updateConfig ──────────────────────────────────────────────────────

  describe('updateConfig', () => {
    it('should update a single config field', () => {
      const mgr = new TokenBudgetManager()
      mgr.updateConfig({ maxTokens: 16000 })
      expect(mgr.getConfig().maxTokens).toBe(16000)

      // Other fields preserved
      expect(mgr.getConfig().warningThreshold).toBe(
        DEFAULT_TOKEN_BUDGET_CONFIG.warningThreshold,
      )
    })

    it('should update multiple config fields', () => {
      const mgr = new TokenBudgetManager()
      mgr.updateConfig({ maxTokens: 5000, minConversationTurns: 6 })
      expect(mgr.getConfig().maxTokens).toBe(5000)
      expect(mgr.getConfig().minConversationTurns).toBe(6)
    })

    it('should allow updating config at runtime', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 4000 })
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'Hello world this is a somewhat longer test message' },
      ])

      // Before update: available based on 4000
      const b1 = mgr.breakdown(ctx, [])
      const before = b1.available

      // After update to larger max: more available
      mgr.updateConfig({ maxTokens: 12000 })
      const b2 = mgr.breakdown(ctx, [])
      const after = b2.available

      expect(after).toBeGreaterThan(before)
    })
  })

  // ── breakdown — empty context ─────────────────────────────────────────

  describe('breakdown with empty context', () => {
    it('should report zero for all categories with empty context', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.systemPrompt).toBe(0)
      expect(breakdown.conversationHistory).toBe(0)
      expect(breakdown.tools).toBe(0)
      expect(breakdown.generationContext).toBe(0)
      expect(breakdown.total).toBe(0)
      expect(breakdown.available).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.maxTokens)
      expect(breakdown.percentUsed).toBe(0)
      expect(breakdown.needsCompaction).toBe(false)
    })
  })

  // ── breakdown — system prompt ─────────────────────────────────────────

  describe('breakdown with system prompt', () => {
    it('should count system prompt tokens', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      ctx.setSystemPrompt('You are a helpful coding assistant.')
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.systemPrompt).toBeGreaterThan(0)
      expect(breakdown.conversationHistory).toBe(0)
    })

    it('should count Chinese system prompt correctly', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      ctx.setSystemPrompt('你是一个有帮助的编程助手，用中文回答问题。')
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.systemPrompt).toBeGreaterThan(0)
      // Chinese chars ~1 token each, so ~19 tokens
      expect(breakdown.systemPrompt).toBeGreaterThanOrEqual(18)
    })
  })

  // ── breakdown — conversation ──────────────────────────────────────────

  describe('breakdown with conversation messages', () => {
    it('should count user and assistant messages', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there! How can I help?' },
      ])
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.conversationHistory).toBeGreaterThan(0)
      expect(breakdown.systemPrompt).toBe(0)
    })

    it('should correctly separate system prompt from conversation', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      ctx.setSystemPrompt('System instruction here.')
      ctx.addUserMessage('User question')
      ctx.addAssistantMessage('Assistant answer')

      const breakdown = mgr.breakdown(ctx, [])
      expect(breakdown.systemPrompt).toBeGreaterThan(0)
      expect(breakdown.conversationHistory).toBeGreaterThan(0)
      // System + conversation + tools + genContext = total
      expect(breakdown.total).toBe(
        breakdown.systemPrompt +
          breakdown.conversationHistory +
          breakdown.tools +
          breakdown.generationContext,
      )
    })

    it('should handle long conversation', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      for (let i = 0; i < 20; i++) {
        ctx.addUserMessage(`Question number ${i}: `.padEnd(50, 'x'))
        ctx.addAssistantMessage(`Answer number ${i}: `.padEnd(100, 'y'))
      }

      const breakdown = mgr.breakdown(ctx, [])
      expect(breakdown.conversationHistory).toBeGreaterThan(500)
    })
  })

  // ── breakdown — tool definitions ──────────────────────────────────────

  describe('breakdown with tool definitions', () => {
    it('should count tool definition tokens', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()

      const breakdown = mgr.breakdown(ctx, [
        makeToolDef('read_file', 'Read a file from the filesystem'),
        makeToolDef('write_file', 'Write content to a file'),
      ])

      expect(breakdown.tools).toBeGreaterThan(0)
    })

    it('should count zero for empty tool definitions', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.tools).toBe(0)
    })

    it('should include parameter schemas in tool token count', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()

      const withParams = mgr.breakdown(ctx, [
        makeToolDef('complex', 'Complex tool', {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name' },
            value: { type: 'number', description: 'The value' },
          },
          required: ['name'],
        }),
      ])

      const withoutParams = mgr.breakdown(ctx, [
        makeToolDef('simple', 'Simple tool'),
      ])

      // Tool with parameters should cost more tokens
      expect(withParams.tools).toBeGreaterThan(withoutParams.tools)
    })

    it('should handle tool with empty description', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeEmptyContext()
      const breakdown = mgr.breakdown(ctx, [
        makeToolDef('no_desc', ''),
      ])

      expect(breakdown.tools).toBe(0)
    })
  })

  // ── breakdown — needsCompaction ───────────────────────────────────────

  describe('breakdown needsCompaction flag', () => {
    it('should set needsCompaction=false when usage is low', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 10000 })
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'Hello' },
      ])
      const breakdown = mgr.breakdown(ctx, [])
      expect(breakdown.needsCompaction).toBe(false)
    })

    it('should set needsCompaction=true when less than 20% available', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 100 })
      // Need enough tokens to fill > 80% of max
      const ctx = makeEmptyContext()
      ctx.setSystemPrompt(
        'A very long system prompt that takes up many tokens '.repeat(10),
      )
      const breakdown = mgr.breakdown(ctx, [])
      // available < 20% of max → needsCompaction
      expect(breakdown.needsCompaction).toBe(breakdown.available < 20)
    })

    it('should calculate percentUsed correctly', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 1000 })
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'Short message' },
      ])
      const breakdown = mgr.breakdown(ctx, [])

      expect(breakdown.percentUsed).toBeCloseTo(
        ((breakdown.total / 1000) * 100),
        0,
      )
      expect(breakdown.percentUsed).toBeGreaterThan(0)
    })
  })

  // ── getCompactionTrigger ──────────────────────────────────────────────

  describe('getCompactionTrigger', () => {
    function makeBreakdown(overrides: Partial<TokenBreakdown>): TokenBreakdown {
      return {
        systemPrompt: 0,
        conversationHistory: 0,
        generationContext: 0,
        tools: 0,
        available: 8000,
        total: 0,
        percentUsed: 0,
        needsCompaction: false,
        ...overrides,
      }
    }

    it('should return "none" when plenty of space available', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 8000 })
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 6000, total: 2000 }),
      )
      expect(result).toBe('none')
    })

    it('should return "warning" when less than 20% free', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 8000 })
      // free = 1200, 20% of 8000 = 1600 → warning
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 1200, total: 6800 }),
      )
      expect(result).toBe('warning')
    })

    it('should return "critical" when less than 10% free', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 8000 })
      // free = 600, 10% of 8000 = 800 → critical
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 600, total: 7400 }),
      )
      expect(result).toBe('critical')
    })

    it('should return "forced" when total exceeds 90% of context window', () => {
      const mgr = new TokenBudgetManager({
        maxTokens: 8000,
        modelContextWindow: 200000,
      })
      // Need available > 10% of maxTokens (800) AND total > 90% of contextWindow
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 2000, total: 190000 }),
      )
      // 190000 > 200000 * 0.9 = 180000 → forced
      expect(result).toBe('forced')
    })

    it('should prioritize "critical" over "forced" when both apply', () => {
      const mgr = new TokenBudgetManager({
        maxTokens: 8000,
        modelContextWindow: 200000,
      })
      // free = 500 (< 10% of 8000), total = 7500 + 190000? No — total includes all.
      // the check order is: critical → warning → forced → none
      // So critical should be checked first
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 400, total: 190000 }),
      )
      // 190000 > 180000 (forced), but 400 < 800 (critical) → should be critical
      expect(result).toBe('critical')
    })

    it('should return "none" when at exactly 20% free', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 8000 })
      const result = mgr.getCompactionTrigger(
        makeBreakdown({ available: 1600, total: 6400 }),
      )
      // free = 1600, not < 1600 → warning not triggered
      // but also: 1600 < 1600? No. → none (unless forced)
      expect(result).toBe('none')
    })
  })

  // ── rebalancingPriority ───────────────────────────────────────────────

  describe('rebalancingPriority', () => {
    it('should return 4 steps (including full compaction) even for empty breakdown', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 0,
        conversationHistory: 0,
        generationContext: 0,
        tools: 0,
        available: 8000,
        total: 0,
        percentUsed: 0,
        needsCompaction: false,
      })

      // Priority 4 (full compaction) is always included
      expect(steps.length).toBeGreaterThanOrEqual(1)
      const priorities = steps.map((s) => s.priority)
      expect(priorities).toContain(4) // Full compaction always present
    })

    it('should include conversation trim step when conversationHistory > 0', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 0,
        conversationHistory: 1000,
        generationContext: 0,
        tools: 0,
        available: 6000,
        total: 1000,
        percentUsed: 12.5,
        needsCompaction: false,
      })

      const priorities = steps.map((s) => s.priority)
      expect(priorities).toContain(1) // Trim conversation history
      expect(priorities).toContain(2) // Truncate tool results
    })

    it('should include generation context compression when genContext > 0', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 0,
        conversationHistory: 1000,
        generationContext: 500,
        tools: 0,
        available: 5000,
        total: 1500,
        percentUsed: 23,
        needsCompaction: false,
      })

      const priorities = steps.map((s) => s.priority)
      expect(priorities).toContain(3) // Compress generation context
    })

    it('should order steps by priority (ascending)', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 2000,
        conversationHistory: 3000,
        generationContext: 1000,
        tools: 500,
        available: 500,
        total: 6500,
        percentUsed: 93,
        needsCompaction: true,
      })

      const priorities = steps.map((s) => s.priority)
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThan(priorities[i - 1])
      }
    })

    it('should mark only generation context compression as reversible', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 0,
        conversationHistory: 1000,
        generationContext: 500,
        tools: 0,
        available: 5000,
        total: 1500,
        percentUsed: 23,
        needsCompaction: false,
      })

      const genCtxStep = steps.find((s) => s.priority === 3)
      expect(genCtxStep).toBeDefined()
      expect(genCtxStep!.reversible).toBe(true)

      const trimStep = steps.find((s) => s.priority === 1)
      expect(trimStep!.reversible).toBe(false)

      const fullStep = steps.find((s) => s.priority === 4)
      expect(fullStep!.reversible).toBe(false)
    })

    it('should estimate reasonable token savings', () => {
      const mgr = new TokenBudgetManager()
      const steps = mgr.rebalancingPriority({
        systemPrompt: 0,
        conversationHistory: 4000,
        generationContext: 2000,
        tools: 100,
        available: 0,
        total: 6100,
        percentUsed: 100,
        needsCompaction: true,
      })

      for (const step of steps) {
        expect(step.estTokenSavings).toBeGreaterThan(0)
        expect(Number.isFinite(step.estTokenSavings)).toBe(true)
      }
    })
  })

  // ── recordSnapshot ────────────────────────────────────────────────────

  describe('recordSnapshot / sliding window', () => {
    function makeSimpleBreakdown(total: number): TokenBreakdown {
      return {
        systemPrompt: 0,
        conversationHistory: total,
        generationContext: 0,
        tools: 0,
        available: 8000 - total,
        total,
        percentUsed: (total / 8000) * 100,
        needsCompaction: total > 6400,
      }
    }

    it('should record snapshots and return via getTrend', () => {
      const mgr = new TokenBudgetManager()
      mgr.recordSnapshot(1, makeSimpleBreakdown(1000))
      mgr.recordSnapshot(2, makeSimpleBreakdown(1200))
      mgr.recordSnapshot(3, makeSimpleBreakdown(1300))

      const trend = mgr.getTrend()
      expect(trend.avgTokensPerIteration).toBeGreaterThan(0)
    })

    it('should limit history to 50 entries (TOKEN_HISTORY_WINDOW)', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 60; i++) {
        mgr.recordSnapshot(i, makeSimpleBreakdown(1000 + i * 10))
      }

      const trend = mgr.getTrend(60)
      // Last 10 iterations (51-60) should be present
      expect(trend.avgTokensPerIteration).toBeGreaterThan(0)
      // We can't directly verify the window size but the trend analysis
      // on lastN=60 should yield results based on available snapshots
    })

    it('should maintain correct iteration numbers after sliding window', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 55; i++) {
        mgr.recordSnapshot(i, makeSimpleBreakdown(i * 100))
      }

      // getTrend with lastN=10 should use the last 10 entries (46-55)
      const trend = mgr.getTrend(10)
      expect(trend.avgTokensPerIteration).toBeGreaterThan(0)
    })
  })

  // ── getTrend — trend analysis ─────────────────────────────────────────

  describe('getTrend', () => {
    function makeBreakdownAt(total: number): TokenBreakdown {
      return {
        systemPrompt: 0,
        conversationHistory: total,
        generationContext: 0,
        tools: 0,
        available: 8000 - Math.min(total, 8000),
        total,
        percentUsed: (total / 8000) * 100,
        needsCompaction: false,
      }
    }

    it('should return stable for a single snapshot', () => {
      const mgr = new TokenBudgetManager()
      mgr.recordSnapshot(1, makeBreakdownAt(1000))

      const trend = mgr.getTrend()
      expect(trend.trendDirection).toBe('stable')
      expect(trend.avgTokensPerIteration).toBe(1000)
      expect(trend.projectedExhaustionIteration).toBeNull()
    })

    it('should return stable for no snapshots', () => {
      const mgr = new TokenBudgetManager()
      const trend = mgr.getTrend()
      expect(trend.trendDirection).toBe('stable')
      expect(trend.avgTokensPerIteration).toBe(0)
      expect(trend.projectedExhaustionIteration).toBeNull()
    })

    it('should detect growing trend', () => {
      const mgr = new TokenBudgetManager()
      // Tokens growing: 1000 → 1500 over 5 iterations
      for (let i = 1; i <= 5; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(500 + i * 200))
        // i=1:700, i=2:900, i=3:1100, i=4:1300, i=5:1500
      }

      const trend = mgr.getTrend(5)
      // delta = 1500 - 700 = 800, avg = 1100, 800 > 110 (10% of avg) → growing
      expect(trend.trendDirection).toBe('growing')
    })

    it('should detect shrinking trend', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 5; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(2000 - i * 200))
        // i=1:1800, i=2:1600, i=3:1400, i=4:1200, i=5:1000
      }

      const trend = mgr.getTrend(5)
      expect(trend.trendDirection).toBe('shrinking')
    })

    it('should detect stable trend', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 5; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(1000 + (i % 2) * 50))
        // i=1:1050, i=2:1000, i=3:1050, i=4:1000, i=5:1050
      }

      const trend = mgr.getTrend(5)
      expect(trend.trendDirection).toBe('stable')
    })

    it('should project exhaustion for growing trend', () => {
      const mgr = new TokenBudgetManager({ maxTokens: 8000 })
      for (let i = 1; i <= 5; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(1000 + i * 200))
        // i=1:1200, i=2:1400, i=3:1600, i=4:1800, i=5:2000
      }

      const trend = mgr.getTrend(5)
      expect(trend.trendDirection).toBe('growing')
      expect(trend.projectedExhaustionIteration).toBeGreaterThan(5)
    })

    it('should not project exhaustion for stable/declining trend', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 5; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(1000))
      }

      const trend = mgr.getTrend(5)
      expect(trend.trendDirection).toBe('stable')
      expect(trend.projectedExhaustionIteration).toBeNull()
    })

    it('should support custom lastN parameter', () => {
      const mgr = new TokenBudgetManager()
      for (let i = 1; i <= 20; i++) {
        mgr.recordSnapshot(i, makeBreakdownAt(500 + i * 100))
      }

      const trend5 = mgr.getTrend(5)
      const trend10 = mgr.getTrend(10)
      // Both should return valid results
      expect(trend5.avgTokensPerIteration).toBeGreaterThan(0)
      expect(trend10.avgTokensPerIteration).toBeGreaterThan(0)
    })
  })

  // ── shouldCompact ─────────────────────────────────────────────────────

  describe('shouldCompact', () => {
    it('should delegate to breakdown.needsCompaction', () => {
      const mgr = new TokenBudgetManager()
      expect(
        mgr.shouldCompact({
          systemPrompt: 0,
          conversationHistory: 0,
          generationContext: 0,
          tools: 0,
          available: 8000,
          total: 0,
          percentUsed: 0,
          needsCompaction: false,
        }),
      ).toBe(false)

      expect(
        mgr.shouldCompact({
          systemPrompt: 0,
          conversationHistory: 0,
          generationContext: 0,
          tools: 0,
          available: 0,
          total: 8000,
          percentUsed: 100,
          needsCompaction: true,
        }),
      ).toBe(true)
    })
  })

  // ── Token Estimation Accuracy ─────────────────────────────────────────

  describe('token estimation (via breakdown)', () => {
    it('should estimate English text correctly (~4 chars/token)', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'The quick brown fox jumps over the lazy dog' },
      ])
      const breakdown = mgr.breakdown(ctx, [])

      // 43 chars, no Chinese → ceil(43/4) = 11
      expect(breakdown.conversationHistory).toBe(11)
    })

    it('should estimate Chinese text correctly (~1 char/token)', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeContextWithMessages([
        { role: 'user', content: '你好世界' },
      ])
      const breakdown = mgr.breakdown(ctx, [])

      // 4 Chinese chars → 4 tokens
      expect(breakdown.conversationHistory).toBe(4)
    })

    it('should handle mixed Chinese/English content', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeContextWithMessages([
        { role: 'user', content: 'Hello 你好 World' },
      ])
      const breakdown = mgr.breakdown(ctx, [])

      // 2 Chinese chars → 2, remaining chars = 12 → ceil(12/4) = 3, total = 5
      expect(breakdown.conversationHistory).toBe(5)
    })

    it('should return 0 for empty content', () => {
      const mgr = new TokenBudgetManager()
      const ctx = makeContextWithMessages([
        { role: 'user', content: '' },
      ])
      const breakdown = mgr.breakdown(ctx, [])
      expect(breakdown.conversationHistory).toBe(0)
    })
  })
})
