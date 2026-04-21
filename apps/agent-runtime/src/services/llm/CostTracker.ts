/**
 * Cost Tracker - inspired by Claude Code
 * 
 * Tracks LLM usage costs with per-model pricing.
 * Provides:
 * - Per-request cost calculation
 * - Usage aggregation and analytics
 * - Budget enforcement
 * - Cost reporting
 */
import { EventEmitter } from 'events'
import { metrics } from '@opentelemetry/api'
import { AI_METRICS, AI_ATTRIBUTES } from '@agenthive/observability'
import { Logger } from '../../utils/logger.js'

// Pricing per 1K tokens (as of 2024 - update as needed)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude models
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  
  // OpenAI GPT models
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  
  // Fallback for unknown models (use GPT-4 pricing as conservative estimate)
  'default': { input: 0.01, output: 0.03 }
}

export interface UsageRecord {
  id: string
  timestamp: number
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
  requestType: 'completion' | 'stream' | 'tool_call'
  metadata?: Record<string, any>
}

export interface CostSummary {
  totalRequests: number
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCost: number
  averageCostPerRequest: number
  byProvider: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
  byModel: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
}

export interface BudgetConfig {
  dailyLimit?: number
  monthlyLimit?: number
  perRequestLimit?: number
  alertThreshold?: number // 0-1, alert when this % of budget is used
}

export class CostTracker extends EventEmitter {
  private records: UsageRecord[] = []
  private budgetConfig: BudgetConfig
  private logger: Logger
  private dailyUsage: number = 0
  private dailyResetTime: number
  private monthlyUsage: number = 0
  private monthlyResetTime: number
  
  constructor(budgetConfig: BudgetConfig = {}) {
    super()
    this.budgetConfig = budgetConfig
    this.logger = new Logger('CostTracker')
    
    // Initialize reset times
    const now = new Date()
    this.dailyResetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    this.monthlyResetTime = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  }
  
  /**
   * Record a usage event and calculate cost
   */
  recordUsage(params: {
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    requestType: 'completion' | 'stream' | 'tool_call'
    metadata?: Record<string, any>
  }): UsageRecord {
    this.checkReset()
    
    const { provider, model, promptTokens, completionTokens, requestType, metadata } = params
    
    // Calculate cost
    const pricing = this.getPricing(model)
    const inputCost = (promptTokens / 1000) * pricing.input
    const outputCost = (completionTokens / 1000) * pricing.output
    const totalCost = inputCost + outputCost
    
    // Check budget limits
    if (this.budgetConfig.perRequestLimit && totalCost > this.budgetConfig.perRequestLimit) {
      this.emit('budget:per_request_exceeded', {
        cost: totalCost,
        limit: this.budgetConfig.perRequestLimit
      })
    }
    
    if (this.budgetConfig.dailyLimit && (this.dailyUsage + totalCost) > this.budgetConfig.dailyLimit) {
      this.emit('budget:daily_exceeded', {
        current: this.dailyUsage,
        additional: totalCost,
        limit: this.budgetConfig.dailyLimit
      })
    }
    
    // Create record
    const record: UsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCost,
      outputCost,
      totalCost,
      requestType,
      metadata
    }
    
    this.records.push(record)
    this.dailyUsage += totalCost
    this.monthlyUsage += totalCost
    
    // Check alert threshold
    if (this.budgetConfig.alertThreshold && this.budgetConfig.dailyLimit) {
      const threshold = this.budgetConfig.dailyLimit * this.budgetConfig.alertThreshold
      if (this.dailyUsage >= threshold && (this.dailyUsage - totalCost) < threshold) {
        this.emit('budget:alert', {
          current: this.dailyUsage,
          limit: this.budgetConfig.dailyLimit,
          threshold: this.budgetConfig.alertThreshold
        })
      }
    }
    
    this.emit('usage', record)
    this.recordOtelMetrics(record)
    
    this.logger.debug('Usage recorded', {
      model,
      totalTokens: record.totalTokens,
      totalCost: record.totalCost.toFixed(6)
    })
    
    return record
  }
  
  /**
   * Get pricing for a model
   */
  getPricing(model: string): { input: number; output: number } {
    // Try exact match
    if (MODEL_PRICING[model]) {
      return MODEL_PRICING[model]
    }
    
    // Try prefix match (e.g., 'claude-3-5-sonnet' matches 'claude-3-5-sonnet-20241022')
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (model.startsWith(key.replace(/-\d{8}$/, '')) || key.startsWith(model.replace(/-\d{8}$/, ''))) {
        return pricing
      }
    }
    
    // Fallback
    this.logger.warn(`Unknown model pricing: ${model}, using default`)
    return MODEL_PRICING.default
  }
  
  /**
   * Get cost summary
   */
  getSummary(timeRange?: { start?: number; end?: number }): CostSummary {
    const start = timeRange?.start || 0
    const end = timeRange?.end || Date.now()
    
    const filtered = this.records.filter(r => r.timestamp >= start && r.timestamp <= end)
    
    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {}
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
    
    let totalTokens = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalCost = 0
    
    for (const record of filtered) {
      totalTokens += record.totalTokens
      totalPromptTokens += record.promptTokens
      totalCompletionTokens += record.completionTokens
      totalCost += record.totalCost
      
      // By provider
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0 }
      }
      byProvider[record.provider].requests++
      byProvider[record.provider].tokens += record.totalTokens
      byProvider[record.provider].cost += record.totalCost
      
      // By model
      if (!byModel[record.model]) {
        byModel[record.model] = { requests: 0, tokens: 0, cost: 0 }
      }
      byModel[record.model].requests++
      byModel[record.model].tokens += record.totalTokens
      byModel[record.model].cost += record.totalCost
    }
    
    return {
      totalRequests: filtered.length,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost,
      averageCostPerRequest: filtered.length > 0 ? totalCost / filtered.length : 0,
      byProvider,
      byModel
    }
  }
  
  /**
   * Get today's usage
   */
  getTodayUsage(): { cost: number; tokens: number; requests: number } {
    this.checkReset()
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = today.getTime()
    const end = Date.now()
    
    const todayRecords = this.records.filter(r => r.timestamp >= start && r.timestamp <= end)
    
    return {
      cost: todayRecords.reduce((sum, r) => sum + r.totalCost, 0),
      tokens: todayRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      requests: todayRecords.length
    }
  }
  
  /**
   * Get current month's usage
   */
  getMonthUsage(): { cost: number; tokens: number; requests: number } {
    this.checkReset()
    
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const end = Date.now()
    
    const monthRecords = this.records.filter(r => r.timestamp >= start && r.timestamp <= end)
    
    return {
      cost: monthRecords.reduce((sum, r) => sum + r.totalCost, 0),
      tokens: monthRecords.reduce((sum, r) => sum + r.totalTokens, 0),
      requests: monthRecords.length
    }
  }
  
  /**
   * Get all records
   */
  getRecords(): UsageRecord[] {
    return [...this.records]
  }
  
  /**
   * Clear all records
   */
  clear(): void {
    this.records = []
    this.dailyUsage = 0
    this.monthlyUsage = 0
    this.logger.info('Cost tracker cleared')
  }
  
  /**
   * Export records to JSON
   */
  export(): string {
    return JSON.stringify({
      records: this.records,
      summary: this.getSummary(),
      today: this.getTodayUsage(),
      month: this.getMonthUsage(),
      exportedAt: Date.now()
    }, null, 2)
  }
  
  /**
   * Update budget configuration
   */
  updateBudget(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config }
  }
  
  /**
   * Check if operation would exceed budget
   */
  wouldExceedBudget(estimatedCost: number): { exceeded: boolean; reason?: string } {
    this.checkReset()
    
    if (this.budgetConfig.perRequestLimit && estimatedCost > this.budgetConfig.perRequestLimit) {
      return {
        exceeded: true,
        reason: `Per-request limit: $${estimatedCost.toFixed(4)} > $${this.budgetConfig.perRequestLimit}`
      }
    }
    
    if (this.budgetConfig.dailyLimit && (this.dailyUsage + estimatedCost) > this.budgetConfig.dailyLimit) {
      return {
        exceeded: true,
        reason: `Daily limit would be exceeded: $${(this.dailyUsage + estimatedCost).toFixed(4)} > $${this.budgetConfig.dailyLimit}`
      }
    }
    
    return { exceeded: false }
  }
  
  /**
   * Export cost data as OpenTelemetry metrics
   */
  private recordOtelMetrics(record: UsageRecord): void {
    try {
      const meter = metrics.getMeter('agenthive-cost-tracker')
      
      // LLM 请求计数器
      const requestCounter = meter.createCounter(AI_METRICS.LLM_REQUESTS_TOTAL, {
        description: 'Total LLM API requests',
      })
      requestCounter.add(1, {
        [AI_ATTRIBUTES.LLM_PROVIDER]: record.provider,
        [AI_ATTRIBUTES.LLM_MODEL]: record.model,
        [AI_ATTRIBUTES.LLM_STREAMING]: record.requestType === 'stream',
      })
      
      // Token 直方图
      const tokenHistogram = meter.createHistogram(AI_METRICS.LLM_TOKENS_TOTAL, {
        description: 'Total tokens per request',
        unit: '1',
      })
      tokenHistogram.record(record.totalTokens, {
        [AI_ATTRIBUTES.LLM_PROVIDER]: record.provider,
        [AI_ATTRIBUTES.LLM_MODEL]: record.model,
      })
      
      // 成本计数器
      const costCounter = meter.createCounter(AI_METRICS.LLM_COST_TOTAL, {
        description: 'Total LLM cost in USD',
        unit: 'USD',
      })
      costCounter.add(record.totalCost, {
        [AI_ATTRIBUTES.LLM_PROVIDER]: record.provider,
        [AI_ATTRIBUTES.LLM_MODEL]: record.model,
      })
    } catch {
      // OTel metrics 失败不应影响业务逻辑
    }
  }

  private checkReset(): void {
    const now = Date.now()
    
    // Check daily reset
    if (now >= this.dailyResetTime) {
      this.dailyUsage = 0
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      this.dailyResetTime = tomorrow.getTime()
      this.logger.debug('Daily usage reset')
    }
    
    // Check monthly reset
    if (now >= this.monthlyResetTime) {
      this.monthlyUsage = 0
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      nextMonth.setHours(0, 0, 0, 0)
      this.monthlyResetTime = nextMonth.getTime()
      this.logger.debug('Monthly usage reset')
    }
  }
}

// Global instance
let globalCostTracker: CostTracker | null = null

export function initializeCostTracker(budgetConfig?: BudgetConfig): CostTracker {
  globalCostTracker = new CostTracker(budgetConfig)
  return globalCostTracker
}

export function getCostTracker(): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker()
  }
  return globalCostTracker
}

export function resetCostTracker(): void {
  globalCostTracker = null
}
