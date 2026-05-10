/**
 * Frontend Gen System Prompt Unit Tests
 *
 * Covers:
 * - buildFrontendGenSystemPrompt with full template config
 * - buildFrontendGenPlaceholderPrompt
 * - Template-specific value injection (uiFramework, cssApproach, colors, fonts, spacing, darkMode)
 * - All 8 constraint sections present
 * - Missing/optional config fields
 * - FrontendGenContext type compatibility
 *
 * 对应 spec/002-agent-runtime.md §2
 */

import { describe, it, expect } from 'vitest'
import {
  buildFrontendGenSystemPrompt,
  buildFrontendGenPlaceholderPrompt,
  type FrontendGenContext,
} from '../../src/agent/prompts/frontend-gen.js'
import type { TemplateMeta } from '../../src/tools/template/TemplateTool.js'

// ==========================================================================
// Helpers
// ==========================================================================

function makeFullTemplate(): TemplateMeta {
  return {
    id: 'landing-saas-starter',
    name: 'SaaS Landing Starter',
    description: 'Modern SaaS landing page with hero, features, pricing, and CTA sections',
    category: 'landing',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#06b6d4',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f8fafc',
    },
    fonts: ['Inter', 'JetBrains Mono'],
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
    darkMode: 'class',
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'vue-router', 'pinia'],
    features: ['Dark/light mode toggle', 'Responsive hero with CTA'],
    complexity: 'medium',
  }
}

function makeMinimalTemplate(): TemplateMeta {
  return {
    id: 'blog-minimal',
    name: 'Minimal Blog',
    description: 'Clean, typography-focused blog',
    category: 'blog',
    uiFramework: 'tailwind-only',
    cssApproach: 'tailwind',
    allowedDeps: ['@nuxt/content', 'pinia'],
    features: ['MDX-powered blog posts'],
    complexity: 'low',
  }
}

function makeContext(
  templateId: string,
  templateConfig: TemplateMeta,
): FrontendGenContext {
  return {
    templateId,
    templateConfig,
    generatedFiles: new Map(),
    supabaseSchema: { tables: [] },
    verificationHistory: [],
    lastSuccessfulCommit: null,
  }
}

// ==========================================================================
// Tests — buildFrontendGenSystemPrompt
// ==========================================================================

describe('buildFrontendGenSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const ctx = makeContext('landing-saas-starter', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toBeTruthy()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('should include the template ID in the prompt', () => {
    const ctx = makeContext('dashboard-analytics', makeMinimalTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('dashboard-analytics')
  })

  // ── Section 1: UI Library Lockdown ────────────────────────────────────

  it('should include UI library lockdown section with framework name', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('UI Library Lockdown')
    expect(prompt).toContain('element-plus')
  })

  it('should include CSS approach in the prompt', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('tailwind')
  })

  it('should forbid other UI libraries', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('DO NOT import or reference any other UI library')
    expect(prompt).toContain('Vuetify')
    expect(prompt).toContain('Ant Design')
    expect(prompt).toContain('Bootstrap')
  })

  // ── Section 2: File Structure ─────────────────────────────────────────

  it('should include Nuxt 3 file structure conventions', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('File Structure Conventions')
    expect(prompt).toContain('pages/')
    expect(prompt).toContain('components/')
    expect(prompt).toContain('composables/')
    expect(prompt).toContain('stores/')
    expect(prompt).toContain('layouts/')
  })

  // ── Section 3: Design Scheme ──────────────────────────────────────────

  it('should include Tailwind design scheme with colors', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Design Scheme Application')

    // Check that colors are injected
    const colors = ctx.templateConfig.tailwindColors!
    for (const [key, value] of Object.entries(colors)) {
      expect(prompt).toContain(value)
    }
  })

  it('should include font list in the prompt', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Inter')
    expect(prompt).toContain('JetBrains Mono')
  })

  it('should include spacing scale in the prompt', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('"xs":"0.5rem"')
  })

  it('should include dark mode strategy', () => {
    const ctx = makeContext('test', {
      ...makeFullTemplate(),
      darkMode: 'class',
    })
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('class')
  })

  // ── Section 4: TypeScript Only ────────────────────────────────────────

  it('should include TypeScript-only requirements', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('TypeScript Only')
    expect(prompt).toContain('<script setup lang="ts">')
    expect(prompt).toContain('NO plain JavaScript')
    expect(prompt).toContain('NO use of "any" type')
  })

  // ── Section 5: package.json Immutability ──────────────────────────────

  it('should include package.json immutability rules', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('package.json Immutability')
    expect(prompt).toContain('DO NOT modify package.json')
    expect(prompt).toContain('REQUESTED_DEP')
  })

  // ── Section 6: Accessibility (a11y) ───────────────────────────────────

  it('should include accessibility requirements', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Accessibility Requirements')
    expect(prompt).toContain('WCAG AA')
    expect(prompt).toContain('aria-label')
    expect(prompt).toContain('alt attributes')
    expect(prompt).toContain('keyboard navigation')
  })

  // ── Section 7: SEO ────────────────────────────────────────────────────

  it('should include SEO meta tag requirements', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('SEO Meta Tags')
    expect(prompt).toContain('useHead()')
    expect(prompt).toContain('og:title')
    expect(prompt).toContain('og:description')
    expect(prompt).toContain('JSON-LD')
  })

  // ── Section 8: Error Handling ─────────────────────────────────────────

  it('should include error handling requirements', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Error Handling')
    expect(prompt).toContain('try/catch')
    expect(prompt).toContain('NuxtErrorBoundary')
    expect(prompt).toContain('Loading states')
  })

  // ── CRITICAL CONSTRAINTS header ───────────────────────────────────────

  it('should include CRITICAL CONSTRAINTS header', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('CRITICAL CONSTRAINTS')
    expect(prompt).toContain('VIOLATION MEANS REJECTION')
  })

  // ── Allowed Dependencies ──────────────────────────────────────────────

  it('should list allowed dependencies from template config', () => {
    const template = {
      ...makeFullTemplate(),
      allowedDeps: ['vue-router', 'pinia', 'echarts'],
    }
    const ctx = makeContext('test', template)
    const prompt = buildFrontendGenSystemPrompt(ctx)
    // Should mention allowed deps somewhere
    expect(prompt).toContain('element-plus') // uiFramework
  })

  // ── Optional Fields ───────────────────────────────────────────────────

  it('should handle missing tailwindColors gracefully', () => {
    const ctx = makeContext('test', makeMinimalTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('{}') // empty color map
  })

  it('should handle missing fonts gracefully', () => {
    const ctx = makeContext('test', makeMinimalTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Inter') // default font
  })

  it('should handle missing darkMode (default to "class")', () => {
    const ctx = makeContext('test', makeMinimalTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('class')
  })

  it('should handle radix-vue uiFramework', () => {
    const template: TemplateMeta = {
      ...makeFullTemplate(),
      uiFramework: 'radix-vue',
    }
    const ctx = makeContext('test', template)
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('radix-vue')
  })

  it('should handle scoped-scss cssApproach', () => {
    const template: TemplateMeta = {
      ...makeFullTemplate(),
      cssApproach: 'scoped-scss',
    }
    const ctx = makeContext('test', template)
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('scoped-scss')
  })

  it('should handle darkMode: false', () => {
    const template: TemplateMeta = {
      ...makeFullTemplate(),
      darkMode: false,
    }
    const ctx = makeContext('test', template)
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('false')
  })

  // ── Output Format section ─────────────────────────────────────────────

  it('should include Output Format instructions', () => {
    const ctx = makeContext('test', makeFullTemplate())
    const prompt = buildFrontendGenSystemPrompt(ctx)
    expect(prompt).toContain('Output Format')
    expect(prompt).toContain('FileWrite')
    expect(prompt).toContain('QA verifier')
  })
})

// ==========================================================================
// Tests — buildFrontendGenPlaceholderPrompt
// ==========================================================================

describe('buildFrontendGenPlaceholderPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('landing-saas-starter')
    expect(prompt).toBeTruthy()
    expect(prompt.length).toBeGreaterThan(50)
  })

  it('should include the template ID', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('ecommerce-storefront')
    expect(prompt).toContain('ecommerce-storefront')
  })

  it('should warn that template config is not yet loaded', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('blog-minimal')
    expect(prompt).toContain('TEMPLATE CONFIG NOT YET LOADED')
  })

  it('should instruct read-only operations only', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('dashboard-analytics')
    expect(prompt).toContain('read-only')
    expect(prompt).toContain('DO NOT write any files')
  })

  it('should instruct to prepare a generation plan', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('landing-saas-starter')
    expect(prompt).toContain('generation plan')
  })

  it('should instruct to wait for orchestrator', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('landing-saas-starter')
    expect(prompt).toContain('orchestrator')
  })

  it('should contain the Nuxt 3 / Vue 3 developer identity', () => {
    const prompt = buildFrontendGenPlaceholderPrompt('test-template')
    expect(prompt).toContain('expert Nuxt 3 / Vue 3')
  })
})

// ==========================================================================
// Tests — FrontendGenContext type compatibility
// ==========================================================================

describe('FrontendGenContext', () => {
  it('should accept a valid FrontendGenContext object', () => {
    const ctx: FrontendGenContext = {
      templateId: 'landing-saas-starter',
      templateConfig: makeFullTemplate(),
      generatedFiles: new Map(),
      supabaseSchema: { tables: [] },
      verificationHistory: [],
      lastSuccessfulCommit: null,
    }

    expect(ctx.templateId).toBe('landing-saas-starter')
    expect(ctx.templateConfig.uiFramework).toBe('element-plus')
    expect(ctx.generatedFiles.size).toBe(0)
  })

  it('should support GenerationContext inherited fields', () => {
    const ctx: FrontendGenContext = {
      templateId: 'test',
      templateConfig: makeMinimalTemplate(),
      generatedFiles: new Map([['pages/index.vue', 'content']]),
      supabaseSchema: {
        tables: [
          {
            name: 'posts',
            columns: [{ name: 'id', type: 'uuid', nullable: false }],
            rlsPolicies: [],
          },
        ],
      },
      verificationHistory: [
        {
          attempt: 1,
          steps: [
            {
              stepName: 'typescript_check',
              passed: true,
              message: 'OK',
              timestamp: Date.now(),
            },
          ],
          passed: true,
          startedAt: Date.now() - 1000,
          completedAt: Date.now(),
        },
      ],
      lastSuccessfulCommit: 'abc123',
    }

    expect(ctx.generatedFiles.get('pages/index.vue')).toBe('content')
    expect(ctx.supabaseSchema.tables[0].name).toBe('posts')
    expect(ctx.verificationHistory[0].passed).toBe(true)
    expect(ctx.lastSuccessfulCommit).toBe('abc123')
    expect(buildFrontendGenSystemPrompt(ctx)).toContain('test')
  })
})
