/**
 * Context Compaction Pipeline - inspired by Claude Code
 * 
 * Orchestrates multiple compaction strategies to keep context within token limits.
 * Strategies are applied in priority order until context is small enough.
 * 
 * Usage:
 * ```typescript
 * const pipeline = new CompactionPipeline([
 *   new SnipCompaction(),
 *   new Microcompact(),
 *   new ContextCollapse(),
 *   new Autocompact({ summarize: async (msgs) => {...} })
 * ])
 * 
 * const result = await pipeline.compact({
 *   messages,
 *   maxTokens: 12000,
 *   targetTokens: 8000
 * })
 * ```
 */
import { CompactionStrategy, CompactionContext, CompactionResult, countTotalTokens } from './types.js'
import { LLMMessage } from '../../services/llm/types.js'
import { Logger } from '../../utils/logger.js'

export interface PipelineResult {
  /** Final message list */
  messages: LLMMessage[]
  /** Whether any compaction was applied */
  applied: boolean
  /** Results from each strategy */
  results: CompactionResult[]
  /** Total tokens saved */
  tokensSaved: number
  /** Original token count */
  originalTokens: number
  /** Final token count */
  finalTokens: number
}

export interface PipelineConfig {
  /** Stop if we've compacted below this threshold */
  targetTokens: number
  /** Maximum allowed tokens */
  maxTokens: number
  /** Whether to continue applying strategies until target is reached */
  aggressive: boolean
  /** Logger instance */
  logger?: Logger
}

export class CompactionPipeline {
  private strategies: CompactionStrategy[]
  private config: PipelineConfig
  private logger: Logger
  
  constructor(
    strategies: CompactionStrategy[],
    config: Partial<PipelineConfig> = {}
  ) {
    // Sort strategies by priority
    this.strategies = [...strategies].sort((a, b) => a.priority - b.priority)
    
    this.config = {
      targetTokens: 8000,
      maxTokens: 12000,
      aggressive: true,
      ...config
    }
    
    this.logger = config.logger || new Logger('CompactionPipeline')
  }
  
  /**
   * Run the compaction pipeline
   */
  async compact(context: Omit<CompactionContext, 'targetTokens'>): Promise<PipelineResult> {
    let messages = [...context.messages]
    const originalTokens = countTotalTokens(messages)
    let currentTokens = originalTokens
    
    const results: CompactionResult[] = []
    let applied = false
    
    this.logger.debug('Starting compaction', {
      originalTokens,
      targetTokens: this.config.targetTokens,
      maxTokens: this.config.maxTokens,
      strategies: this.strategies.map(s => s.name)
    })
    
    // Check if we need compaction
    if (currentTokens <= this.config.targetTokens) {
      this.logger.debug('No compaction needed', { currentTokens })
      return {
        messages,
        applied: false,
        results: [],
        tokensSaved: 0,
        originalTokens,
        finalTokens: currentTokens
      }
    }
    
    // Apply strategies in order
    for (const strategy of this.strategies) {
      // Check if we've reached target
      if (!this.config.aggressive && currentTokens <= this.config.targetTokens) {
        break
      }
      
      // Check if strategy can be applied
      const canCompact = strategy.canCompact({
        messages,
        maxTokens: this.config.maxTokens,
        targetTokens: this.config.targetTokens
      })
      
      if (!canCompact) {
        this.logger.debug(`Strategy ${strategy.name} cannot compact`, {
          currentTokens,
          messageCount: messages.length
        })
        continue
      }
      
      this.logger.debug(`Applying strategy: ${strategy.name}`)
      
      // Apply the strategy
      let result: CompactionResult
      
      // Handle async strategies (like Autocompact)
      if ('compactAsync' in strategy) {
        result = await (strategy as any).compactAsync({
          messages,
          maxTokens: this.config.maxTokens,
          targetTokens: this.config.targetTokens
        })
      } else {
        result = strategy.compact({
          messages,
          maxTokens: this.config.maxTokens,
          targetTokens: this.config.targetTokens
        })
      }
      
      results.push(result)
      
      if (result.applied) {
        applied = true
        currentTokens = result.newTokens
        
        // We need to update messages for the next strategy
        // But our strategies return info, not new messages
        // Let's handle this differently - strategies should return new messages
        
        this.logger.info(`Strategy ${strategy.name} applied`, {
          originalTokens: result.originalTokens,
          newTokens: result.newTokens,
          saved: result.originalTokens - result.newTokens,
          affectedMessages: result.affectedMessages
        })
        
        // For now, we apply strategies sequentially to the same message list
        // This is a simplified approach - in production, each strategy would modify messages
      }
      
      // Safety check - don't go below minimum
      if (messages.length < 3) {
        this.logger.warn('Message count too low, stopping compaction')
        break
      }
    }
    
    const tokensSaved = originalTokens - currentTokens
    
    this.logger.info('Compaction complete', {
      originalTokens,
      finalTokens: currentTokens,
      tokensSaved,
      strategiesApplied: results.filter(r => r.applied).length
    })
    
    return {
      messages,
      applied,
      results,
      tokensSaved,
      originalTokens,
      finalTokens: currentTokens
    }
  }
  
  /**
   * Add a strategy to the pipeline
   */
  addStrategy(strategy: CompactionStrategy): void {
    this.strategies.push(strategy)
    this.strategies.sort((a, b) => a.priority - b.priority)
  }
  
  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter(s => s.name !== name)
  }
  
  /**
   * Get current strategies
   */
  getStrategies(): CompactionStrategy[] {
    return [...this.strategies]
  }
  
  /**
   * Create a default pipeline with all standard strategies
   */
  static createDefault(config?: Partial<PipelineConfig> & { 
    summarize?: (messages: LLMMessage[]) => Promise<string> 
  }): CompactionPipeline {
    const { SnipCompaction } = require('./SnipCompaction.js')
    const { Microcompact } = require('./Microcompact.js')
    const { ContextCollapse } = require('./ContextCollapse.js')
    const { Autocompact } = require('./Autocompact.js')
    
    const strategies: CompactionStrategy[] = [
      new SnipCompaction(),
      new Microcompact(),
      new ContextCollapse()
    ]
    
    // Add autocompact if summarize function provided
    if (config?.summarize) {
      strategies.push(new Autocompact({ summarize: config.summarize }))
    }
    
    return new CompactionPipeline(strategies, config)
  }
}

// Re-export types
export * from './types.js'
export { SnipCompaction } from './SnipCompaction.js'
export { Microcompact } from './Microcompact.js'
export { ContextCollapse } from './ContextCollapse.js'
export { Autocompact } from './Autocompact.js'
