/**
 * Feature Flags 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  enableFeature,
  disableFeature,
  getFeatureStatus,
  type FeatureFlag
} from '../../src/config/featureFlags.js'

describe('Feature Flags', () => {
  beforeEach(() => {
    // 重置功能开关到默认值
    Object.keys(FEATURE_FLAGS).forEach(key => {
      (FEATURE_FLAGS as any)[key] = false
    })
  })

  describe('default values', () => {
    it('should have all flags default to false', () => {
      Object.values(FEATURE_FLAGS).forEach(value => {
        expect(value).toBe(false)
      })
    })

    it('should have expected flag names', () => {
      const expectedFlags: FeatureFlag[] = [
        'USE_TOOL_V2',
        'USE_QUERY_LOOP_V2',
        'ENABLE_WORKTREE_ISOLATION',
        'ENABLE_TEMPDIR_ISOLATION',
        'ENABLE_CONTEXT_COMPRESSION',
        'ENABLE_AUTO_CLASSIFIER',
        'ENABLE_MCP_MINIMAL',
        'ENABLE_PERMISSION_HOOKS',
        'ENABLE_TEAM_COLLABORATION',
        'DEBUG'
      ]

      expectedFlags.forEach(flag => {
        expect(FEATURE_FLAGS).toHaveProperty(flag)
      })
    })
  })

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features', () => {
      FEATURE_FLAGS.USE_TOOL_V2 = true
      expect(isFeatureEnabled('USE_TOOL_V2')).toBe(true)
    })

    it('should return false for disabled features', () => {
      FEATURE_FLAGS.USE_TOOL_V2 = false
      expect(isFeatureEnabled('USE_TOOL_V2')).toBe(false)
    })

    it('should work for all feature flags', () => {
      const flags: FeatureFlag[] = [
        'USE_TOOL_V2',
        'USE_QUERY_LOOP_V2',
        'ENABLE_WORKTREE_ISOLATION',
        'ENABLE_AUTO_CLASSIFIER'
      ]

      flags.forEach(flag => {
        FEATURE_FLAGS[flag] = true
        expect(isFeatureEnabled(flag)).toBe(true)
        
        FEATURE_FLAGS[flag] = false
        expect(isFeatureEnabled(flag)).toBe(false)
      })
    })
  })

  describe('enableFeature', () => {
    it('should enable a feature', () => {
      expect(FEATURE_FLAGS.ENABLE_CONTEXT_COMPRESSION).toBe(false)
      
      enableFeature('ENABLE_CONTEXT_COMPRESSION')
      
      expect(FEATURE_FLAGS.ENABLE_CONTEXT_COMPRESSION).toBe(true)
      expect(isFeatureEnabled('ENABLE_CONTEXT_COMPRESSION')).toBe(true)
    })

    it('should work for all features', () => {
      const flags: FeatureFlag[] = Object.keys(FEATURE_FLAGS) as FeatureFlag[]
      
      flags.forEach(flag => {
        enableFeature(flag)
        expect(FEATURE_FLAGS[flag]).toBe(true)
      })
    })
  })

  describe('disableFeature', () => {
    it('should disable a feature', () => {
      FEATURE_FLAGS.ENABLE_MCP_MINIMAL = true
      expect(FEATURE_FLAGS.ENABLE_MCP_MINIMAL).toBe(true)
      
      disableFeature('ENABLE_MCP_MINIMAL')
      
      expect(FEATURE_FLAGS.ENABLE_MCP_MINIMAL).toBe(false)
    })

    it('should work for all features', () => {
      // First enable all
      const flags: FeatureFlag[] = Object.keys(FEATURE_FLAGS) as FeatureFlag[]
      flags.forEach(flag => {
        FEATURE_FLAGS[flag] = true
      })
      
      // Then disable all
      flags.forEach(flag => {
        disableFeature(flag)
        expect(FEATURE_FLAGS[flag]).toBe(false)
      })
    })
  })

  describe('getFeatureStatus', () => {
    it('should return a copy of all feature statuses', () => {
      FEATURE_FLAGS.USE_TOOL_V2 = true
      FEATURE_FLAGS.ENABLE_AUTO_CLASSIFIER = true
      
      const status = getFeatureStatus()
      
      expect(status.USE_TOOL_V2).toBe(true)
      expect(status.ENABLE_AUTO_CLASSIFIER).toBe(true)
      expect(status.USE_QUERY_LOOP_V2).toBe(false)
    })

    it('should return a copy, not the original', () => {
      const status = getFeatureStatus()
      
      // Modify the returned object
      status.USE_TOOL_V2 = true
      
      // Original should not be affected
      expect(FEATURE_FLAGS.USE_TOOL_V2).toBe(false)
    })

    it('should include all feature flags', () => {
      const status = getFeatureStatus()
      const flagKeys = Object.keys(FEATURE_FLAGS)
      
      expect(Object.keys(status)).toEqual(flagKeys)
    })
  })

  describe('toggle features', () => {
    it('should allow toggling features on and off', () => {
      const flag: FeatureFlag = 'DEBUG'
      
      // Start with false
      expect(FEATURE_FLAGS[flag]).toBe(false)
      
      // Enable
      enableFeature(flag)
      expect(FEATURE_FLAGS[flag]).toBe(true)
      
      // Disable
      disableFeature(flag)
      expect(FEATURE_FLAGS[flag]).toBe(false)
      
      // Enable again
      enableFeature(flag)
      expect(FEATURE_FLAGS[flag]).toBe(true)
    })
  })

  describe('feature flag independence', () => {
    it('should keep features independent', () => {
      enableFeature('USE_TOOL_V2')
      enableFeature('ENABLE_AUTO_CLASSIFIER')
      
      expect(isFeatureEnabled('USE_TOOL_V2')).toBe(true)
      expect(isFeatureEnabled('ENABLE_AUTO_CLASSIFIER')).toBe(true)
      expect(isFeatureEnabled('USE_QUERY_LOOP_V2')).toBe(false)
      
      disableFeature('USE_TOOL_V2')
      
      expect(isFeatureEnabled('USE_TOOL_V2')).toBe(false)
      expect(isFeatureEnabled('ENABLE_AUTO_CLASSIFIER')).toBe(true)
    })
  })
})
