/**
 * Permission Manager - 权限管理系统
 * 
 * 参考 Claude Code 设计：
 * 1. 规则基础的权限控制
 * 2. 多种权限模式（ask/allow/deny/auto）
 * 3. 细粒度权限规则（工具、路径、命令）
 * 4. 权限审计日志
 */

import { EventEmitter } from 'events'
import { Logger } from '../utils/loggerEnhanced.js'
import type { EnhancedPermissionDecision, PermissionBehavior } from '../tools/ToolClaudeCode.js'

export type PermissionMode = 'ask' | 'allow' | 'deny' | 'auto'

export interface PermissionRule {
  id: string
  name: string
  toolName?: string
  toolPattern?: RegExp
  pathPattern?: RegExp
  commandPattern?: RegExp
  behavior: PermissionBehavior
  description?: string
  createdAt: number
  expiresAt?: number
}

export interface PermissionRequest {
  id: string
  toolName: string
  input: any
  context: {
    agentId: string
    workspacePath: string
    isDestructive: boolean
    isReadOnly: boolean
  }
  timestamp: number
}

export interface PermissionCacheEntry {
  decision: EnhancedPermissionDecision
  timestamp: number
  ttl: number
}

export interface PermissionManagerConfig {
  mode: PermissionMode
  defaultBehavior: PermissionBehavior
  rules: PermissionRule[]
  cacheEnabled: boolean
  cacheTTL: number
  autoClassifierEnabled: boolean
}

interface PendingPermission {
  resolve: (decision: EnhancedPermissionDecision) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Permission Manager - 中央权限控制系统
 */
export class PermissionManager extends EventEmitter {
  private logger = new Logger('PermissionManager')
  private config: PermissionManagerConfig
  private rules: Map<string, PermissionRule> = new Map()
  private cache: Map<string, PermissionCacheEntry> = new Map()
  private pendingPermissions: Map<string, PendingPermission> = new Map()
  private permissionHistory: PermissionRequest[] = []
  private historyLimit = 1000

  constructor(config?: Partial<PermissionManagerConfig>) {
    super()
    
    this.config = {
      mode: config?.mode || this.getModeFromEnv(),
      defaultBehavior: config?.defaultBehavior || 'ask',
      rules: config?.rules || [],
      cacheEnabled: config?.cacheEnabled ?? true,
      cacheTTL: config?.cacheTTL || 5 * 60 * 1000, // 5 minutes
      autoClassifierEnabled: config?.autoClassifierEnabled ?? false
    }

    // Load initial rules
    for (const rule of this.config.rules) {
      this.rules.set(rule.id, rule)
    }

    this.logger.info('PermissionManager initialized', { 
      mode: this.config.mode, 
      rulesCount: this.rules.size 
    })
  }

  private getModeFromEnv(): PermissionMode {
    const envMode = process.env.PERMISSION_MODE as PermissionMode
    if (['ask', 'allow', 'deny', 'auto'].includes(envMode)) {
      return envMode
    }
    return 'ask'
  }

  /**
   * Check permission for a tool execution
   */
  async checkPermission(
    toolName: string,
    input: any,
    context: {
      agentId: string
      workspacePath: string
      isDestructive: boolean
      isReadOnly: boolean
    }
  ): Promise<EnhancedPermissionDecision> {
    const request: PermissionRequest = {
      id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      toolName,
      input,
      context,
      timestamp: Date.now()
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedDecision(request)
      if (cached) {
        this.logger.debug('Permission cache hit', { toolName, requestId: request.id })
        return cached
      }
    }

    // Record in history
    this.recordHistory(request)

    // Check rules
    const ruleDecision = this.checkRules(request)
    if (ruleDecision) {
      this.logger.permission(`Rule matched: ${ruleDecision.behavior}`, { 
        toolName, 
        ruleId: ruleDecision.ruleId 
      })
      this.cacheDecision(request, ruleDecision)
      return ruleDecision
    }

    // Apply mode-based logic
    const modeDecision = await this.applyMode(request)
    this.cacheDecision(request, modeDecision)
    return modeDecision
  }

  /**
   * Check rules against permission request
   */
  private checkRules(request: PermissionRequest): (EnhancedPermissionDecision & { ruleId?: string }) | null {
    for (const rule of this.rules.values()) {
      // Check expiration
      if (rule.expiresAt && Date.now() > rule.expiresAt) {
        continue
      }

      // Check tool name match
      if (rule.toolName && rule.toolName !== request.toolName) {
        continue
      }

      // Check tool pattern
      if (rule.toolPattern && !rule.toolPattern.test(request.toolName)) {
        continue
      }

      // Check path pattern (for file operations)
      if (rule.pathPattern && request.input?.path) {
        if (!rule.pathPattern.test(request.input.path)) {
          continue
        }
      }

      // Check command pattern (for shell operations)
      if (rule.commandPattern && request.input?.command) {
        if (!rule.commandPattern.test(request.input.command)) {
          continue
        }
      }

      // Rule matched
      return {
        behavior: rule.behavior,
        message: rule.description,
        ruleId: rule.id
      }
    }

    return null
  }

  /**
   * Apply permission mode logic
   */
  private async applyMode(request: PermissionRequest): Promise<EnhancedPermissionDecision> {
    const { mode } = this.config
    const { isDestructive, isReadOnly } = request.context

    switch (mode) {
      case 'deny':
        return { behavior: 'deny', message: 'Permission mode is set to deny' }

      case 'allow':
        // Even in allow mode, block destructive operations
        if (isDestructive) {
          return { behavior: 'ask', prompt: `Allow destructive operation: ${request.toolName}?` }
        }
        return { behavior: 'allow' }

      case 'auto':
        if (this.config.autoClassifierEnabled) {
          return this.autoClassify(request)
        }
        // Fall through to ask if auto classifier not enabled
        return { behavior: 'ask', prompt: this.generatePrompt(request) }

      case 'ask':
      default:
        // Read-only operations can be auto-allowed
        if (isReadOnly) {
          return { behavior: 'allow' }
        }
        return { behavior: 'ask', prompt: this.generatePrompt(request) }
    }
  }

  /**
   * Auto-classify permission request
   */
  private autoClassify(request: PermissionRequest): EnhancedPermissionDecision {
    const { isDestructive, isReadOnly } = request.context

    // Low risk operations
    if (isReadOnly) {
      return { behavior: 'allow' }
    }

    // High risk operations
    if (isDestructive) {
      return { behavior: 'ask', prompt: this.generatePrompt(request) }
    }

    // Medium risk - allow for now, but could be more sophisticated
    return { behavior: 'allow' }
  }

  /**
   * Generate permission prompt
   */
  private generatePrompt(request: PermissionRequest): string {
    const { toolName, input } = request
    
    let details = ''
    if (input?.path) {
      details = `Path: ${input.path}`
    } else if (input?.command) {
      details = `Command: ${input.command.slice(0, 100)}`
    } else if (input?.description) {
      details = `Description: ${input.description}`
    }

    return `Allow ${toolName}?${details ? ` (${details})` : ''}`
  }

  /**
   * Add a permission rule
   */
  addRule(rule: Omit<PermissionRule, 'id' | 'createdAt'>): PermissionRule {
    const fullRule: PermissionRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now()
    }

    this.rules.set(fullRule.id, fullRule)
    this.logger.permission(`Rule added: ${fullRule.name}`, { ruleId: fullRule.id, behavior: fullRule.behavior })
    this.emit('rule:added', fullRule)

    return fullRule
  }

  /**
   * Remove a permission rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId)
    if (removed) {
      this.logger.permission(`Rule removed: ${ruleId}`)
      this.emit('rule:removed', { ruleId })
    }
    return removed
  }

  /**
   * Get all rules
   */
  getRules(): PermissionRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Set permission mode
   */
  setMode(mode: PermissionMode): void {
    this.config.mode = mode
    this.logger.info(`Permission mode changed to: ${mode}`)
    this.emit('mode:changed', { mode })
  }

  /**
   * Get current mode
   */
  getMode(): PermissionMode {
    return this.config.mode
  }

  /**
   * Request user permission (for interactive mode)
   */
  async requestUserPermission(requestId: string): Promise<EnhancedPermissionDecision> {
    return new Promise((resolve, reject) => {
      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        this.pendingPermissions.delete(requestId)
        reject(new Error('Permission request timed out'))
      }, 5 * 60 * 1000)

      this.pendingPermissions.set(requestId, { resolve, reject, timeout })
      this.emit('permission:requested', { requestId })
    })
  }

  /**
   * Respond to a pending permission request
   */
  respondToPermission(requestId: string, decision: EnhancedPermissionDecision): boolean {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) {
      return false
    }

    clearTimeout(pending.timeout)
    this.pendingPermissions.delete(requestId)
    pending.resolve(decision)
    
    this.emit('permission:responded', { requestId, decision })
    return true
  }

  /**
   * Get cache key for a request
   */
  private getCacheKey(request: PermissionRequest): string {
    // Simple cache key based on tool and path/command
    const keyParts = [request.toolName]
    if (request.input?.path) {
      keyParts.push(request.input.path)
    } else if (request.input?.command) {
      keyParts.push(request.input.command)
    }
    return keyParts.join(':')
  }

  /**
   * Get cached decision
   */
  private getCachedDecision(request: PermissionRequest): EnhancedPermissionDecision | null {
    const key = this.getCacheKey(request)
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    // Check TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.decision
  }

  /**
   * Cache a decision
   */
  private cacheDecision(request: PermissionRequest, decision: EnhancedPermissionDecision): void {
    if (!this.config.cacheEnabled) return
    if (decision.behavior === 'ask') return // Don't cache ask decisions

    const key = this.getCacheKey(request)
    this.cache.set(key, {
      decision,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL
    })
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.debug('Permission cache cleared')
  }

  /**
   * Record permission history
   */
  private recordHistory(request: PermissionRequest): void {
    this.permissionHistory.push(request)
    
    // Trim history if needed
    if (this.permissionHistory.length > this.historyLimit) {
      this.permissionHistory = this.permissionHistory.slice(-this.historyLimit)
    }
  }

  /**
   * Get permission history
   */
  getHistory(limit = 100): PermissionRequest[] {
    return this.permissionHistory.slice(-limit)
  }

  /**
   * Get permission statistics
   */
  getStats(): {
    rulesCount: number
    cacheSize: number
    pendingCount: number
    historyCount: number
    mode: PermissionMode
  } {
    return {
      rulesCount: this.rules.size,
      cacheSize: this.cache.size,
      pendingCount: this.pendingPermissions.size,
      historyCount: this.permissionHistory.length,
      mode: this.config.mode
    }
  }

  /**
   * Cleanup expired rules and cache entries
   */
  cleanup(): void {
    const now = Date.now()
    
    // Cleanup expired rules
    for (const [id, rule] of this.rules) {
      if (rule.expiresAt && now > rule.expiresAt) {
        this.rules.delete(id)
        this.logger.debug(`Expired rule removed: ${id}`)
      }
    }

    // Cleanup expired cache entries
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Global instance
let globalPermissionManager: PermissionManager | null = null

export function initializePermissionManager(config?: Partial<PermissionManagerConfig>): PermissionManager {
  globalPermissionManager = new PermissionManager(config)
  return globalPermissionManager
}

export function getPermissionManager(): PermissionManager {
  if (!globalPermissionManager) {
    globalPermissionManager = new PermissionManager()
  }
  return globalPermissionManager
}

export function resetPermissionManager(): void {
  globalPermissionManager = null
}

export default PermissionManager
