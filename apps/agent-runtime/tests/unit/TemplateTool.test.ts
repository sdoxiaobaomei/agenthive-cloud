/**
 * TemplateTool 单元测试
 *
 * 测试重点：模板列表/过滤/推荐逻辑、数据完整性、边界条件
 */

import { describe, it, expect, vi } from 'vitest'
import { TemplateTool } from '../../src/tools/template/TemplateTool.js'

function createMockContext() {
  return {
    agentId: 'test-agent',
    workspacePath: '/tmp/test-workspace',
    sendLog: vi.fn(),
    abortController: new AbortController(),
    getAppState: vi.fn(() => ({})),
    setAppState: vi.fn(),
    messages: [],
    checkPermission: vi.fn(),
    llm: {
      complete: vi.fn(),
      stream: vi.fn(),
    },
  }
}

// ============================================================================
// Tool Metadata
// ============================================================================

describe('TemplateTool — Metadata', () => {
  it('should have correct name and category', () => {
    expect(TemplateTool.name).toBe('template')
    expect(TemplateTool.category).toBe('read')
  })

  it('should have aliases', () => {
    expect(TemplateTool.aliases).toContain('templates')
    expect(TemplateTool.aliases).toContain('scaffold')
  })

  it('should be read-only', () => {
    expect(TemplateTool.isReadOnly({} as any)).toBe(true)
  })

  it('should NOT be destructive', () => {
    expect(TemplateTool.isDestructive!({} as any)).toBe(false)
  })

  it('should be concurrency-safe', () => {
    expect(TemplateTool.isConcurrencySafe({} as any)).toBe(true)
  })
})

// ============================================================================
// list_templates — Basic Listing
// ============================================================================

describe('TemplateTool — list_templates', () => {
  it('should return all 4 templates when no filter', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('result')
    if (result.type === 'result') {
      expect(result.data.success).toBe(true)
      expect(result.data.templates).toHaveLength(4)
    }
  })

  it('each template should have required fields', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      for (const t of result.data.templates!) {
        expect(t.id).toBeTruthy()
        expect(t.name).toBeTruthy()
        expect(t.description).toBeTruthy()
        expect(t.category).toBeTruthy()
        expect(t.uiFramework).toBeTruthy()
        expect(Array.isArray(t.features)).toBe(true)
        expect(t.features.length).toBeGreaterThan(0)
        expect(t.complexity).toBeTruthy()
      }
    }
  })
})

// ============================================================================
// list_templates — Filtering
// ============================================================================

describe('TemplateTool — list_templates filtering', () => {
  it('should filter by category', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates', categoryFilter: 'blog' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.templates).toHaveLength(1)
      expect(result.data.templates![0].id).toBe('blog-minimal')
    }
  })

  it('should filter by complexity', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates', complexityFilter: 'high' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.templates!.length).toBe(2) // dashboard + ecommerce
      const ids = result.data.templates!.map((t) => t.id)
      expect(ids).toContain('dashboard-analytics')
      expect(ids).toContain('ecommerce-storefront')
    }
  })

  it('should filter by both category and complexity', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates', categoryFilter: 'dashboard', complexityFilter: 'high' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.templates).toHaveLength(1)
      expect(result.data.templates![0].id).toBe('dashboard-analytics')
    }
  })

  it('should return empty list when filters match nothing', async () => {
    const result = await TemplateTool.call(
      { action: 'list_templates', categoryFilter: 'saas' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      // saas category exists but no templates registered for it yet
      expect(result.data.templates).toHaveLength(0)
    }
  })
})

// ============================================================================
// get_template_details
// ============================================================================

describe('TemplateTool — get_template_details', () => {
  it('should return full template details for valid ID', async () => {
    const result = await TemplateTool.call(
      { action: 'get_template_details', templateId: 'dashboard-analytics' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('result')
    if (result.type === 'result') {
      expect(result.data.success).toBe(true)
      expect(result.data.template).toBeDefined()
      expect(result.data.template.id).toBe('dashboard-analytics')
      expect(result.data.template.tailwindColors).toBeDefined()
      expect(result.data.template.fonts).toBeDefined()
      expect(result.data.template.allowedDeps).toBeDefined()
      expect(result.data.template.features.length).toBeGreaterThan(0)
    }
  })

  it('should return error for unknown template ID', async () => {
    const result = await TemplateTool.call(
      { action: 'get_template_details', templateId: 'non-existent' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('error')
    expect(result.error).toContain('Template not found')
  })

  it('should return full template for landing template', async () => {
    const result = await TemplateTool.call(
      { action: 'get_template_details', templateId: 'landing-saas-starter' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.template.uiFramework).toBe('element-plus')
      expect(result.data.template.category).toBe('landing')
      expect(result.data.template.complexity).toBe('medium')
      expect(result.data.template.darkMode).toBe('class')
    }
  })
})

// ============================================================================
// recommend_template
// ============================================================================

describe('TemplateTool — recommend_template', () => {
  it('should return error when requirements are missing', async () => {
    const result = await TemplateTool.call(
      { action: 'recommend_template' },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    expect(result.type).toBe('error')
    expect(result.error).toContain('requirements')
  })

  it('should recommend dashboard template for analytics keywords', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'I need an analytics dashboard with charts and KPI metrics',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.success).toBe(true)
      expect(result.data.recommendation).toBe('dashboard-analytics')
    }
  })

  it('should recommend landing template for landing page keywords', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'Create a landing page with hero, pricing, and testimonials for my SaaS product',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.recommendation).toBe('landing-saas-starter')
    }
  })

  it('should recommend blog template for content/mdx keywords', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'I want to start a blog with MDX content and good typography',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.recommendation).toBe('blog-minimal')
    }
  })

  it('should recommend ecommerce template for shop/store keywords', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'Build an online store with shopping cart and checkout',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.recommendation).toBe('ecommerce-storefront')
    }
  })

  it('should return first template when no keywords match (all scores are 0)', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'xyzzy foobar nothing relevant',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      // When no keywords match, all templates score 0 and the first one wins
      expect(result.data.success).toBe(true)
      expect(result.data.recommendation).toBeDefined()
      expect(result.data.recommendationReason).toBeDefined()
      expect(result.data.recommendationReason).toContain('score: 0')
    }
  })

  it('should return recommendationReason in result', async () => {
    const result = await TemplateTool.call(
      {
        action: 'recommend_template',
        requirements: 'dashboard analytics',
      },
      createMockContext() as any,
      vi.fn(),
      null,
    )

    if (result.type === 'result') {
      expect(result.data.recommendationReason).toBeDefined()
      expect(result.data.recommendationReason!.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// Permissions
// ============================================================================

describe('TemplateTool — Permissions', () => {
  it('should always allow (read-only tool)', async () => {
    const perm = await TemplateTool.checkPermissions(
      { action: 'list_templates' } as any,
      createMockContext() as any,
    )
    expect(perm.behavior).toBe('allow')
  })
})
