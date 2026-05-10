/**
 * AgentSystem 单元测试 — AgentType 扩展
 *
 * 测试重点：9 个 AgentType 定义的正确性、边界条件、配置约束
 * 不以覆盖率为目标，以功能完整度和异常路径为核心
 */

import { describe, it, expect } from 'vitest'
import { BUILTIN_AGENTS, type AgentType, type AgentDefinition } from '../../src/agent/AgentSystem.js'

// ============================================================================
// Helpers
// ============================================================================

/** 获取所有 AgentType 值的列表（从 BUILTIN_AGENTS 的 key 推断） */
function allAgentTypes(): AgentType[] {
  return Object.keys(BUILTIN_AGENTS) as AgentType[]
}

/** 验证 allowedTools 和 disallowedTools 无交集 */
function validateToolDisjoint(def: AgentDefinition): { valid: boolean; overlapping: string[] } {
  const allowed = new Set(def.allowedTools ?? [])
  const disallowed = new Set(def.disallowedTools ?? [])
  const overlapping = [...allowed].filter((t) => disallowed.has(t))
  return { valid: overlapping.length === 0, overlapping }
}

/** 获取已有的 5 个 agent type */
const LEGACY_AGENT_TYPES: AgentType[] = ['explore', 'plan', 'coder', 'general', 'custom']

/** 新增的 4 个 agent type */
const NEW_AGENT_TYPES: AgentType[] = ['frontend_gen', 'supabase_gen', 'qa_verifier', 'deploy_gen']

// ============================================================================
// 功能完整性测试
// ============================================================================

describe('AgentType Extension', () => {
  // ── 1. 9 AgentTypes 都已定义 ──────────────────────────────────────────

  it('should define all 9 AgentType values in BUILTIN_AGENTS', () => {
    const types = allAgentTypes()
    // 原有 5 个 + 新增 4 个 = 9
    expect(types).toHaveLength(9)

    for (const legacy of LEGACY_AGENT_TYPES) {
      expect(BUILTIN_AGENTS[legacy]).toBeDefined()
    }
    for (const added of NEW_AGENT_TYPES) {
      expect(BUILTIN_AGENTS[added]).toBeDefined()
    }
  })

  // ── 2. 每个定义字段完整性 ──────────────────────────────────────────────

  it('every agent definition should have all required fields', () => {
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      expect(def.agentType).toBe(type)
      expect(typeof def.name).toBe('string')
      expect(def.name.length).toBeGreaterThan(0)
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(0)
      // systemPrompt 可以是空字符串（运行时注入），但必须是 string
      expect(typeof def.systemPrompt).toBe('string')
      expect(typeof def.maxIterations).toBe('number')
      expect(def.maxIterations).toBeGreaterThan(0)
      expect(typeof def.readOnly).toBe('boolean')
      expect(def.defaultIsolation).toBeDefined()
    }
  })

  // ── 3. 类型推断校验（运行时用 typeof） ─────────────────────────────────

  it('AgentType should be a valid union type at runtime', () => {
    const validTypes = new Set(allAgentTypes())

    // 新增类型必须在 BUILTIN_AGENTS 中
    expect(validTypes.has('frontend_gen')).toBe(true)
    expect(validTypes.has('supabase_gen')).toBe(true)
    expect(validTypes.has('qa_verifier')).toBe(true)
    expect(validTypes.has('deploy_gen')).toBe(true)

    // 所有 key 都必须是合法的 AgentType
    for (const key of Object.keys(BUILTIN_AGENTS)) {
      expect(validTypes.has(key as AgentType)).toBe(true)
    }
  })

  // ── 4. allowed/disallowed tools 不冲突 ─────────────────────────────────

  it('allowedTools and disallowedTools should have no overlap', () => {
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      const { valid, overlapping } = validateToolDisjoint(def)
      expect(valid).toBe(true)
      if (overlapping.length > 0) {
        // 永远不会到达，但如果到达会输出有用信息
        console.error(`AgentType ${type} has overlapping tools:`, overlapping)
      }
    }
  })
})

// ============================================================================
// 新增 Agent 定义专项测试
// ============================================================================

describe('New Agent Definitions', () => {
  // ── frontend_gen ───────────────────────────────────────────────────────

  describe('frontend_gen', () => {
    const def = BUILTIN_AGENTS.frontend_gen

    it('should be configured as a code-writing agent', () => {
      expect(def.readOnly).toBe(false)
      expect(def.maxIterations).toBe(30)
      expect(def.defaultIsolation).toBe('worktree')
      expect(def.model).toBe('claude-sonnet-4-20250514')
    })

    it('should have empty systemPrompt (runtime-injected)', () => {
      expect(def.systemPrompt).toBe('')
    })

    it('should allow frontend-related tools', () => {
      expect(def.allowedTools).toContain('file_write')
      expect(def.allowedTools).toContain('preview')
      expect(def.allowedTools).toContain('template')
      expect(def.allowedTools).toContain('web_fetch')
    })

    it('should NOT allow backend/database tools', () => {
      expect(def.disallowedTools).toContain('supabase')
      expect(def.disallowedTools).toContain('deploy')
    })

    it('should have allowedTools as a non-null array', () => {
      expect(Array.isArray(def.allowedTools)).toBe(true)
      expect(def.allowedTools!.length).toBeGreaterThan(0)
    })
  })

  // ── supabase_gen ───────────────────────────────────────────────────────

  describe('supabase_gen', () => {
    const def = BUILTIN_AGENTS.supabase_gen

    it('should be configured as a code-writing agent', () => {
      expect(def.readOnly).toBe(false)
      expect(def.maxIterations).toBe(20)
      expect(def.defaultIsolation).toBe('none')
      expect(def.model).toBe('claude-sonnet-4-20250514')
    })

    it('should have empty systemPrompt (runtime-injected)', () => {
      expect(def.systemPrompt).toBe('')
    })

    it('should allow database-related tools', () => {
      expect(def.allowedTools).toContain('supabase')
      expect(def.allowedTools).toContain('file_write')
    })

    it('should NOT allow preview or deploy or bash tools', () => {
      expect(def.disallowedTools).toContain('bash')
      expect(def.disallowedTools).toContain('preview')
      expect(def.disallowedTools).toContain('deploy')
      expect(def.disallowedTools).toContain('http')
    })
  })

  // ── qa_verifier ───────────────────────────────────────────────────────

  describe('qa_verifier', () => {
    const def = BUILTIN_AGENTS.qa_verifier

    it('should be READ-ONLY — QA must not modify code', () => {
      expect(def.readOnly).toBe(true)
      expect(def.disallowedTools).toContain('file_write')
      expect(def.disallowedTools).toContain('file_edit')
    })

    it('should have reasonable iteration limit', () => {
      expect(def.maxIterations).toBe(15)
    })

    it('should not require isolation', () => {
      expect(def.defaultIsolation).toBe('none')
    })

    it('should allow read and preview tools', () => {
      expect(def.allowedTools).toContain('file_read')
      expect(def.allowedTools).toContain('preview')
    })

    it('should NOT allow database or deploy tools', () => {
      expect(def.disallowedTools).toContain('supabase')
      expect(def.disallowedTools).toContain('deploy')
    })
  })

  // ── deploy_gen ────────────────────────────────────────────────────────

  describe('deploy_gen', () => {
    const def = BUILTIN_AGENTS.deploy_gen

    it('should be configured as a code-writing agent', () => {
      expect(def.readOnly).toBe(false)
      expect(def.maxIterations).toBe(20)
      expect(def.model).toBe('claude-sonnet-4-20250514')
    })

    it('should use worktree isolation (deployments are risky)', () => {
      expect(def.defaultIsolation).toBe('worktree')
    })

    it('should have empty systemPrompt (runtime-injected)', () => {
      expect(def.systemPrompt).toBe('')
    })

    it('should allow file and shell tools', () => {
      expect(def.allowedTools).toContain('file_write')
      expect(def.allowedTools).toContain('bash')
    })

    it('should NOT allow Supabase or frontend tools', () => {
      expect(def.disallowedTools).toContain('supabase')
      expect(def.disallowedTools).toContain('preview')
      expect(def.disallowedTools).toContain('template')
      expect(def.disallowedTools).toContain('web_fetch')
    })
  })
})

// ============================================================================
// 边界条件 & 异常测试
// ============================================================================

describe('AgentType Edge Cases', () => {
  it('maxIterations should be a positive integer for every agent', () => {
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      expect(Number.isInteger(def.maxIterations)).toBe(true)
      expect(def.maxIterations).toBeGreaterThan(0)
      expect(def.maxIterations).toBeLessThanOrEqual(50)
    }
  })

  it('readOnly agents should not have file_write or file_edit in allowedTools', () => {
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      if (def.readOnly) {
        if (def.allowedTools) {
          expect(def.allowedTools).not.toContain('file_write')
          expect(def.allowedTools).not.toContain('file_edit')
        }
        // 必须在 disallowedTools 中阻止写入
        expect(def.disallowedTools).toContain('file_write')
        expect(def.disallowedTools).toContain('file_edit')
      }
    }
  })

  it('agentType field must match its key in BUILTIN_AGENTS', () => {
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      expect(def.agentType).toBe(type)
    }
  })

  it('new agents without systemPrompt should still have empty string (not undefined/null)', () => {
    for (const type of NEW_AGENT_TYPES) {
      const def = BUILTIN_AGENTS[type]
      expect(def.systemPrompt).toBe('')
      expect(def.systemPrompt).not.toBeNull()
      expect(def.systemPrompt).not.toBeUndefined()
    }
  })

  it('all agents should have valid isolation mode', () => {
    const validIsolations = ['none', 'worktree', 'remote', 'container']
    for (const type of allAgentTypes()) {
      const def = BUILTIN_AGENTS[type]
      expect(validIsolations).toContain(def.defaultIsolation)
    }
  })

  it('model field should be set for all new agents', () => {
    for (const type of NEW_AGENT_TYPES) {
      const def = BUILTIN_AGENTS[type]
      expect(def.model).toBe('claude-sonnet-4-20250514')
    }
  })
})

// ============================================================================
// 回归测试 — 原有 Agent 定义未被意外修改
// ============================================================================

describe('Legacy Agent Regression', () => {
  it('explore agent should still be read-only with read/search tools', () => {
    const def = BUILTIN_AGENTS.explore
    expect(def.readOnly).toBe(true)
    expect(def.allowedTools).toContain('file_read')
    expect(def.allowedTools).toContain('glob')
    expect(def.allowedTools).toContain('grep')
    expect(def.disallowedTools).toContain('file_write')
    expect(def.maxIterations).toBe(15)
  })

  it('plan agent should still be read-only with limited tools', () => {
    const def = BUILTIN_AGENTS.plan
    expect(def.readOnly).toBe(true)
    expect(def.disallowedTools).toContain('file_write')
    expect(def.disallowedTools).toContain('bash')
    expect(def.maxIterations).toBe(10)
  })

  it('coder agent should have no tool restrictions (null allowed = all allowed)', () => {
    const def = BUILTIN_AGENTS.coder
    expect(def.readOnly).toBe(false)
    expect(def.allowedTools).toBeNull() // null means all tools allowed
    expect(def.maxIterations).toBe(25)
  })

  it('general agent should have no tool restrictions', () => {
    const def = BUILTIN_AGENTS.general
    expect(def.readOnly).toBe(false)
    expect(def.allowedTools).toBeNull()
    expect(def.maxIterations).toBe(20)
  })

  it('custom agent should exist with null allowedTools', () => {
    const def = BUILTIN_AGENTS.custom
    expect(def.agentType).toBe('custom')
    expect(def.allowedTools).toBeNull()
  })
})
