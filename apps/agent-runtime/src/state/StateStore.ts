/**
 * State Store - inspired by Claude Code
 * 
 * Event-driven state management with pub-sub pattern.
 * Features:
 * - Selective subscription to state changes
 * - Persistent state storage
 * - State history and time-travel
 * - Computed values
 * - Batch updates
 */
import { EventEmitter } from 'events'
import { Logger } from '../utils/logger.js'

export type StateValue = string | number | boolean | null | undefined | StateObject | StateArray
export interface StateObject { [key: string]: StateValue }
export interface StateArray extends Array<StateValue> {}

export interface StateSlice<T = any> {
  value: T
  version: number
  lastUpdated: number
  metadata?: Record<string, any>
}

export interface StateChange<T = any> {
  path: string
  previousValue: T
  newValue: T
  timestamp: number
  version: number
  source?: string
}

export type StateListener<T = any> = (change: StateChange<T>) => void
export type StateSelector<T = any> = (state: StateObject) => T

export interface Subscription {
  id: string
  path: string
  listener: StateListener
  selector?: StateSelector
}

export interface PersistConfig {
  enabled: boolean
  key: string
  storage?: 'memory' | 'local' | 'custom'
  customStorage?: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
    remove: (key: string) => Promise<void>
  }
  debounceMs?: number
}

export class StateStore extends EventEmitter {
  private state: Map<string, StateSlice> = new Map()
  private subscriptions: Map<string, Set<Subscription>> = new Map()
  private stateListeners: Map<string, Set<StateListener>> = new Map()
  private history: StateChange[] = []
  private maxHistorySize: number = 1000
  private persistConfig: PersistConfig
  private persistTimeout: NodeJS.Timeout | null = null
  private logger: Logger
  private batchMode = false
  private batchChanges: StateChange[] = []
  
  constructor(persistConfig: Partial<PersistConfig> = {}) {
    super()
    this.persistConfig = {
      enabled: false,
      key: 'agent_runtime_state',
      storage: 'memory',
      debounceMs: 1000,
      ...persistConfig
    }
    this.logger = new Logger('StateStore')
  }
  
  /**
   * Get a state value at path
   */
  get<T = any>(path: string): T | undefined {
    const slice = this.state.get(path)
    return slice?.value as T
  }
  
  /**
   * Get full state slice including metadata
   */
  getSlice<T = any>(path: string): StateSlice<T> | undefined {
    return this.state.get(path) as StateSlice<T> | undefined
  }
  
  /**
   * Set a state value at path
   */
  set<T = any>(
    path: string,
    value: T,
    options?: {
      source?: string
      metadata?: Record<string, any>
      skipNotify?: boolean
    }
  ): void {
    const existing = this.state.get(path)
    const previousValue = existing?.value
    
    // Don't update if value hasn't changed
    if (JSON.stringify(previousValue) === JSON.stringify(value)) {
      return
    }
    
    const now = Date.now()
    const newSlice: StateSlice<T> = {
      value,
      version: (existing?.version || 0) + 1,
      lastUpdated: now,
      metadata: options?.metadata
    }
    
    this.state.set(path, newSlice)
    
    const change: StateChange<T> = {
      path,
      previousValue,
      newValue: value,
      timestamp: now,
      version: newSlice.version,
      source: options?.source
    }
    
    // Add to history
    this.addToHistory(change)
    
    if (this.batchMode) {
      this.batchChanges.push(change)
    } else {
      if (!options?.skipNotify) {
        this.notifyChange(change)
      }
      this.schedulePersist()
    }
    
    this.emit('change', change)
  }
  
  /**
   * Update a state value using a function
   */
  update<T = any>(
    path: string,
    updater: (current: T | undefined) => T,
    options?: { source?: string; metadata?: Record<string, any> }
  ): void {
    const current = this.get<T>(path)
    const newValue = updater(current)
    this.set(path, newValue, options)
  }
  
  /**
   * Delete a state value
   */
  delete(path: string): void {
    const existing = this.state.get(path)
    if (!existing) return
    
    this.state.delete(path)
    
    const change: StateChange = {
      path,
      previousValue: existing.value,
      newValue: undefined,
      timestamp: Date.now(),
      version: existing.version + 1
    }
    
    this.addToHistory(change)
    this.notifyChange(change)
    this.schedulePersist()
    
    this.emit('delete', change)
  }
  
  /**
   * Check if a path exists
   */
  has(path: string): boolean {
    return this.state.has(path)
  }
  
  /**
   * Subscribe to changes at a path
   */
  subscribe<T = any>(
    path: string,
    listener: StateListener<T>,
    options?: {
      immediate?: boolean // Call immediately with current value
      selector?: StateSelector<T>
    }
  ): () => void {
    const subscription: Subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      path,
      listener: listener as StateListener,
      selector: options?.selector
    }
    
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set())
    }
    this.subscriptions.get(path)!.add(subscription)
    
    // Immediate callback with current value
    if (options?.immediate) {
      const current = this.get<T>(path)
      listener({
        path,
        previousValue: undefined as any,
        newValue: current as any,
        timestamp: Date.now(),
        version: this.getSlice(path)?.version || 0
      })
    }
    
    this.logger.debug(`Subscribed to: ${path}`)
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.get(path)?.delete(subscription)
      if (this.subscriptions.get(path)?.size === 0) {
        this.subscriptions.delete(path)
      }
    }
  }
  
  /**
   * Subscribe to all changes (wildcard)
   */
  subscribeAll(listener: StateListener): () => void {
    const id = `wildcard_${Date.now()}`
    
    if (!this.stateListeners.has('__all__')) {
      this.stateListeners.set('__all__', new Set())
    }
    this.stateListeners.get('__all__')!.add(listener)
    
    return () => {
      this.stateListeners.get('__all__')?.delete(listener)
    }
  }
  
  /**
   * Get all state values matching a pattern
   */
  getMatching(pattern: RegExp): Array<{ path: string; value: any }> {
    const results: Array<{ path: string; value: any }> = []
    
    for (const [path, slice] of this.state) {
      if (pattern.test(path)) {
        results.push({ path, value: slice.value })
      }
    }
    
    return results
  }
  
  /**
   * Batch multiple updates
   */
  batch<T>(fn: () => T): T {
    this.batchMode = true
    this.batchChanges = []
    
    try {
      const result = fn()
      
      // Process all batched changes
      const uniquePaths = new Set(this.batchChanges.map(c => c.path))
      
      for (const path of uniquePaths) {
        const lastChange = [...this.batchChanges].reverse().find(c => c.path === path)
        if (lastChange) {
          this.notifyChange(lastChange)
        }
      }
      
      this.emit('batch', this.batchChanges)
      
      this.schedulePersist()
      
      return result
    } finally {
      this.batchMode = false
      this.batchChanges = []
    }
  }
  
  /**
   * Get state history
   */
  getHistory(options?: { 
    path?: string
    limit?: number
    since?: number
  }): StateChange[] {
    let history = [...this.history]
    
    if (options?.path) {
      history = history.filter(h => h.path === options.path)
    }
    
    if (options?.since) {
      history = history.filter(h => h.timestamp >= options.since!)
    }
    
    if (options?.limit) {
      history = history.slice(-options.limit)
    }
    
    return history
  }
  
  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = []
  }
  
  /**
   * Get all state keys
   */
  keys(): string[] {
    return Array.from(this.state.keys())
  }
  
  /**
   * Get all state entries
   */
  entries(): Array<{ path: string; slice: StateSlice }> {
    return Array.from(this.state.entries()).map(([path, slice]) => ({ path, slice }))
  }
  
  /**
   * Clear all state
   */
  clear(): void {
    const oldState = new Map(this.state)
    this.state.clear()
    
    // Notify all deletions
    for (const [path, slice] of oldState) {
      this.notifyChange({
        path,
        previousValue: slice.value,
        newValue: undefined,
        timestamp: Date.now(),
        version: slice.version + 1
      })
    }
    
    this.history = []
    this.schedulePersist()
    
    this.emit('clear')
  }
  
  /**
   * Export state to JSON
   */
  export(): string {
    const exportData = {
      state: Array.from(this.state.entries()),
      history: this.history,
      exportedAt: Date.now()
    }
    return JSON.stringify(exportData)
  }
  
  /**
   * Import state from JSON
   */
  import(data: string): void {
    try {
      const parsed = JSON.parse(data)
      
      this.state.clear()
      for (const [path, slice] of parsed.state) {
        this.state.set(path, slice)
      }
      
      if (parsed.history) {
        this.history = parsed.history
      }
      
      this.emit('import', parsed)
      this.logger.info('State imported')
    } catch (error) {
      this.logger.error('Failed to import state', { error })
      throw error
    }
  }
  
  /**
   * Persist state to storage
   */
  async persist(): Promise<void> {
    if (!this.persistConfig.enabled) return
    
    try {
      const data = this.export()
      
      if (this.persistConfig.storage === 'local') {
        // 浏览器环境使用 localStorage，Node 环境需要自定义存储
        const ls = (globalThis as any).localStorage
        if (ls) {
          ls.setItem(this.persistConfig.key, data)
        }
      } else if (this.persistConfig.customStorage) {
        await this.persistConfig.customStorage.set(this.persistConfig.key, data)
      }
      
      this.emit('persist', { timestamp: Date.now() })
      this.logger.debug('State persisted')
    } catch (error) {
      this.logger.error('Failed to persist state', { error })
    }
  }
  
  /**
   * Restore state from storage
   */
  async restore(): Promise<void> {
    if (!this.persistConfig.enabled) return
    
    try {
      let data: string | null = null
      
      if (this.persistConfig.storage === 'local') {
        const ls = (globalThis as any).localStorage
        if (ls) {
          data = ls.getItem(this.persistConfig.key)
        }
      } else if (this.persistConfig.customStorage) {
        data = await this.persistConfig.customStorage.get(this.persistConfig.key)
      }
      
      if (data) {
        this.import(data)
        this.logger.info('State restored')
      }
    } catch (error) {
      this.logger.error('Failed to restore state', { error })
    }
  }
  
  private notifyChange(change: StateChange): void {
    // Notify path-specific subscribers
    const subscriptions = this.subscriptions.get(change.path)
    if (subscriptions) {
      for (const sub of subscriptions) {
        try {
          if (sub.selector) {
            // If selector provided, apply it
            const selectedValue = sub.selector({ [change.path]: change.newValue })
            const selectedPrevious = sub.selector({ [change.path]: change.previousValue })
            sub.listener({
              ...change,
              newValue: selectedValue,
              previousValue: selectedPrevious
            })
          } else {
            sub.listener(change)
          }
        } catch (error) {
          this.logger.error(`Error in subscription listener for ${change.path}`, { error })
        }
      }
    }
    
    // Notify wildcard listeners
    const wildcardListeners = this.stateListeners.get('__all__')
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(change)
        } catch (error) {
          this.logger.error('Error in wildcard listener', { error })
        }
      }
    }
    
    // Notify parent path subscribers (for nested paths)
    const pathParts = change.path.split('.')
    for (let i = 1; i < pathParts.length; i++) {
      const parentPath = pathParts.slice(0, i).join('.')
      const parentSubs = this.subscriptions.get(parentPath)
      if (parentSubs) {
        for (const sub of parentSubs) {
          try {
            sub.listener(change)
          } catch (error) {
            this.logger.error(`Error in parent subscription for ${parentPath}`, { error })
          }
        }
      }
    }
  }
  
  private addToHistory(change: StateChange): void {
    this.history.push(change)
    
    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize)
    }
  }
  
  private schedulePersist(): void {
    if (!this.persistConfig.enabled) return
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout)
    }
    
    this.persistTimeout = setTimeout(() => {
      this.persist()
    }, this.persistConfig.debounceMs)
  }
}

// Global instance
let globalStateStore: StateStore | null = null

export function initializeStateStore(config?: Partial<PersistConfig>): StateStore {
  globalStateStore = new StateStore(config)
  return globalStateStore
}

export function getStateStore(): StateStore {
  if (!globalStateStore) {
    globalStateStore = new StateStore()
  }
  return globalStateStore
}

export function resetStateStore(): void {
  globalStateStore = null
}
