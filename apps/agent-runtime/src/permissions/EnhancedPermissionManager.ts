/**
 * Enhanced Permission Manager - inspired by Claude Code
 * 
 * Advanced permission system with:
 * - Pattern-based tool matching
 * - Pre/post execution hooks
 * - Permission decision caching
 * - Hierarchical rules
 * - Path-based permissions for file operations
 */
import type { PermissionDecision } from '../tools/Tool.js'
import { Logger } from '../utils/logger.js'

export type PermissionMode = 
  | 'default'      // Default mode, ask for sensitive operations
  | 'auto'         // Auto mode, allow all
  | 'strict'       // Strict mode, ask for all operations
  | 'plan'         // Plan mode, allow only planned operations
  | 'bypass'       // Bypass mode, allow all (admin only)

export interface PermissionPattern {
  /** Tool name pattern (supports wildcards: *, ?) */
  tool: string
  /** Optional action pattern within tool */
  action?: string
  /** Optional path pattern (for file operations) */
  path?: string
}

export interface PermissionRule {
  id: string
  name?: string
  /** Pattern to match tools */
  pattern: PermissionPattern
  /** Decision: allow, deny, or ask */
  decision: 'allow' | 'deny' | 'ask'
  /** Optional condition function */
  condition?: (input: any, context: any) => boolean | Promise<boolean>
  /** Rule priority (higher = evaluated first) */
  priority?: number
  /** Rule description */
  description?: string
  /** Whether this rule is active */
  active?: boolean
  /** Expiration timestamp (optional) */
  expiresAt?: number
}

export interface PermissionCacheEntry {
  key: string
  decision: PermissionDecision
  timestamp: number
  hitCount: number
}

export interface ExecutionHooks {
  /** Called before tool execution */
  beforeExecute?: (toolName: string, input: any, context: any) => Promise<void | { abort: boolean; reason?: string }>
  /** Called after successful execution */
  afterExecute?: (toolName: string, input: any, output: any, context: any) => Promise<void>
  /** Called after failed execution */
  onError?: (toolName: string, input: any, error: Error, context: any) => Promise<void>
}

export class EnhancedPermissionManager {
  private mode: PermissionMode = 'default'
  private rules: PermissionRule[] = []
  private cache = new Map<string, PermissionCacheEntry>()
  private cacheSize: number = 1000
  private sessionAllowed = new Set<string>()
  private sessionDenied = new Set<string>()
  private hooks: ExecutionHooks = {}
  private logger: Logger
  
  // Statistics
  private stats = {
    totalChecks: 0,
    cacheHits: 0,
    allowed: 0,
    denied: 0,
    asked: 0
  }
  
  constructor(mode: PermissionMode = 'default') {
    this.mode = mode
    this.logger = new Logger('EnhancedPermissionManager')
    this.setupDefaultRules()
  }
  
  /**
   * Set permission mode
   */
  setMode(mode: PermissionMode): void {
    this.logger.info(`Permission mode changed: ${this.mode} -> ${mode}`)
    this.mode = mode
  }
  
  getMode(): PermissionMode {
    return this.mode
  }
  
  /**
   * Add a permission rule
   */
  addRule(rule: Omit<PermissionRule, 'id'> & { id?: string }): PermissionRule {
    const fullRule: PermissionRule = {
      id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      priority: 0,
      active: true,
      ...rule
    }
    
    this.rules.push(fullRule)
    this.sortRules()
    
    this.logger.debug(`Added rule: ${fullRule.name || fullRule.id}`, {
      pattern: fullRule.pattern,
      decision: fullRule.decision
    })
    
    // Clear cache when rules change
    this.clearCache()
    
    return fullRule
  }
  
  /**
   * Remove a rule by ID
   */
  removeRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id)
    if (index >= 0) {
      this.rules.splice(index, 1)
      this.clearCache()
      return true
    }
    return false
  }
  
  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<Omit<PermissionRule, 'id'>>): boolean {
    const rule = this.rules.find(r => r.id === id)
    if (!rule) return false
    
    Object.assign(rule, updates)
    this.sortRules()
    this.clearCache()
    
    return true
  }
  
  /**
   * Get all rules
   */
  getRules(): PermissionRule[] {
    return [...this.rules]
  }
  
  /**
   * Check permission for a tool operation
   */
  async checkPermission<T>(
    toolName: string,
    input: T,
    context?: any
  ): Promise<PermissionDecision> {
    this.stats.totalChecks++
    
    // Check mode first
    if (this.mode === 'bypass' || this.mode === 'auto') {
      this.stats.allowed++
      return { type: 'allow' }
    }
    
    if (this.mode === 'strict') {
      this.stats.asked++
      return {
        type: 'ask',
        prompt: `Allow ${toolName}?`
      }
    }
    
    // Check cache
    const cacheKey = this.generateCacheKey(toolName, input)
    const cached = this.cache.get(cacheKey)
    if (cached && !this.isExpired(cached)) {
      cached.hitCount++
      this.stats.cacheHits++
      return cached.decision
    }
    
    // Check session-level permissions
    const sessionKey = this.generateSessionKey(toolName, input)
    if (this.sessionAllowed.has(sessionKey)) {
      this.stats.allowed++
      const decision: PermissionDecision = { type: 'allow' }
      this.setCache(cacheKey, decision)
      return decision
    }
    
    if (this.sessionDenied.has(sessionKey)) {
      this.stats.denied++
      const decision: PermissionDecision = { type: 'deny', message: 'Denied by session rule' }
      this.setCache(cacheKey, decision)
      return decision
    }
    
    // Evaluate rules
    for (const rule of this.rules) {
      if (!rule.active) continue
      if (rule.expiresAt && Date.now() > rule.expiresAt) continue
      
      if (this.matchesPattern(toolName, input, rule.pattern)) {
        // Check condition if present
        if (rule.condition) {
          try {
            const conditionResult = await rule.condition(input, context)
            if (!conditionResult) continue
          } catch (error) {
            this.logger.error(`Rule condition error: ${rule.id}`, { error })
            continue
          }
        }
        
        // Apply decision
        let decision: PermissionDecision
        
        switch (rule.decision) {
          case 'allow':
            decision = { type: 'allow' }
            this.stats.allowed++
            break
          case 'deny':
            decision = { type: 'deny', message: `Denied by rule: ${rule.name || rule.id}` }
            this.stats.denied++
            break
          case 'ask':
            decision = {
              type: 'ask',
              prompt: rule.description || `Allow ${toolName}?`
            }
            this.stats.asked++
            break
        }
        
        this.setCache(cacheKey, decision)
        return decision
      }
    }
    
    // Default: allow
    this.stats.allowed++
    const decision: PermissionDecision = { type: 'allow' }
    this.setCache(cacheKey, decision)
    return decision
  }
  
  /**
   * Allow a tool for the session
   */
  allowForSession(toolName: string, input?: any): void {
    const key = this.generateSessionKey(toolName, input)
    this.sessionAllowed.add(key)
    this.sessionDenied.delete(key)
    this.logger.debug(`Allowed for session: ${toolName}`)
  }
  
  /**
   * Deny a tool for the session
   */
  denyForSession(toolName: string, input?: any): void {
    const key = this.generateSessionKey(toolName, input)
    this.sessionDenied.add(key)
    this.sessionAllowed.delete(key)
    this.logger.debug(`Denied for session: ${toolName}`)
  }
  
  /**
   * Clear session permissions
   */
  clearSessionPermissions(): void {
    this.sessionAllowed.clear()
    this.sessionDenied.clear()
    this.logger.debug('Session permissions cleared')
  }
  
  /**
   * Set execution hooks
   */
  setHooks(hooks: ExecutionHooks): void {
    this.hooks = hooks
  }
  
  /**
   * Get execution hooks
   */
  getHooks(): ExecutionHooks {
    return this.hooks
  }
  
  /**
   * Execute hooks before tool execution
   */
  async executeBeforeHook(toolName: string, input: any, context: any): Promise<{ abort: boolean; reason?: string }> {
    if (this.hooks.beforeExecute) {
      const result = await this.hooks.beforeExecute(toolName, input, context)
      if (result && typeof result === 'object' && 'abort' in result) {
        return result
      }
    }
    return { abort: false }
  }
  
  /**
   * Execute hooks after tool execution
   */
  async executeAfterHook(toolName: string, input: any, output: any, context: any): Promise<void> {
    if (this.hooks.afterExecute) {
      await this.hooks.afterExecute(toolName, input, output, context)
    }
  }
  
  /**
   * Execute error hook
   */
  async executeErrorHook(toolName: string, input: any, error: Error, context: any): Promise<void> {
    if (this.hooks.onError) {
      await this.hooks.onError(toolName, input, error, context)
    }
  }
  
  /**
   * Get permission statistics
   */
  getStats() {
    return { ...this.stats }
  }
  
  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.debug('Permission cache cleared')
  }
  
  /**
   * Reset all rules and permissions
   */
  reset(): void {
    this.rules = []
    this.clearCache()
    this.clearSessionPermissions()
    this.stats = {
      totalChecks: 0,
      cacheHits: 0,
      allowed: 0,
      denied: 0,
      asked: 0
    }
    this.setupDefaultRules()
  }
  
  private setupDefaultRules(): void {
    // Rule: File edit operations require confirmation
    this.addRule({
      name: 'File Edit Confirmation',
      pattern: { tool: 'file_edit' },
      decision: 'ask',
      description: 'File editing requires confirmation',
      priority: 100
    })
    
    // Rule: File write to existing files requires confirmation
    this.addRule({
      name: 'File Write Confirmation',
      pattern: { tool: 'file_write' },
      decision: 'ask',
      condition: (input: any) => input.path && !input.create,
      description: 'Overwriting existing files requires confirmation',
      priority: 90
    })
    
    // Rule: Git push requires confirmation
    this.addRule({
      name: 'Git Push Confirmation',
      pattern: { tool: 'git', action: 'push' },
      decision: 'ask',
      description: 'Pushing to remote requires confirmation',
      priority: 100
    })
    
    // Rule: Git destructive operations require confirmation
    this.addRule({
      name: 'Git Destructive Operations',
      pattern: { tool: 'git' },
      decision: 'ask',
      condition: (input: any) => 
        ['reset', 'clean', 'revert'].includes(input.command),
      description: 'Destructive git operations require confirmation',
      priority: 95
    })
    
    // Rule: Shell dangerous commands require confirmation
    this.addRule({
      name: 'Dangerous Shell Commands',
      pattern: { tool: 'bash' },
      decision: 'ask',
      condition: (input: any) => {
        const dangerous = ['rm -rf', 'sudo', 'chmod 777', 'mkfs', 'dd if=', '> /dev', 'curl.*|.*sh']
        const command = input.command || ''
        return dangerous.some(d => new RegExp(d, 'i').test(command))
      },
      description: 'Dangerous shell commands require confirmation',
      priority: 100
    })
    
    // Rule: Allow reading common config files
    this.addRule({
      name: 'Allow Config Reads',
      pattern: { tool: 'file_read', path: '*.{json,yaml,yml,md,txt,config}' },
      decision: 'allow',
      priority: 50
    })
    
    // Rule: Allow common git reads
    this.addRule({
      name: 'Allow Git Status',
      pattern: { tool: 'git' },
      decision: 'allow',
      condition: (input: any) => 
        ['status', 'log', 'diff', 'show', 'branch'].includes(input.command),
      priority: 60
    })
  }
  
  private sortRules(): void {
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }
  
  private matchesPattern(toolName: string, input: any, pattern: PermissionPattern): boolean {
    // Match tool name (with wildcards)
    if (!this.matchWildcard(toolName, pattern.tool)) {
      return false
    }
    
    // Match action if specified
    if (pattern.action && input?.action !== pattern.action) {
      return false
    }
    
    // Match path if specified
    if (pattern.path && input?.path) {
      if (!this.matchWildcard(input.path, pattern.path)) {
        return false
      }
    }
    
    return true
  }
  
  private matchWildcard(text: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * matches anything
      .replace(/\?/g, '.') // ? matches single char
    
    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(text)
  }
  
  private generateCacheKey(toolName: string, input: any): string {
    // Generate a cache key based on tool name and input
    const inputStr = typeof input === 'object' 
      ? JSON.stringify(input) 
      : String(input)
    return `${toolName}:${inputStr}`
  }
  
  private generateSessionKey(toolName: string, input?: any): string {
    if (!input) return toolName
    return `${toolName}:${JSON.stringify(input)}`
  }
  
  private setCache(key: string, decision: PermissionDecision): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.cacheSize) {
      const oldest = this.cache.entries().next().value
      if (oldest) {
        this.cache.delete(oldest[0])
      }
    }
    
    this.cache.set(key, {
      key,
      decision,
      timestamp: Date.now(),
      hitCount: 0
    })
  }
  
  private isExpired(entry: PermissionCacheEntry): boolean {
    // Cache entries expire after 1 hour
    const CACHE_TTL = 60 * 60 * 1000
    return Date.now() - entry.timestamp > CACHE_TTL
  }
}

// Global instance
let globalPermissionManager: EnhancedPermissionManager | null = null

export function initializePermissionManager(mode?: PermissionMode): EnhancedPermissionManager {
  globalPermissionManager = new EnhancedPermissionManager(mode)
  return globalPermissionManager
}

export function getPermissionManager(): EnhancedPermissionManager {
  if (!globalPermissionManager) {
    globalPermissionManager = new EnhancedPermissionManager()
  }
  return globalPermissionManager
}

export function resetPermissionManager(): void {
  globalPermissionManager = null
}
