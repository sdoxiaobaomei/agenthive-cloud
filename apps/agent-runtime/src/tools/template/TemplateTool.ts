/**
 * TemplateTool — 浏览、查看、推荐 Nuxt 3 项目模板
 *
 * 对应 spec/002-agent-runtime.md §4.2
 */

import { z } from 'zod'
import { buildToolV2, createToolResult, createToolError, type ToolResult } from '../ToolV2.js'
import type { ToolUseContext, CanUseToolFn } from '../ToolV2.js'

// ── Helper: wrap createToolError ─────────────────────────────────────────

function fail(msg: string): ToolResult<TemplateOutput> {
  return createToolError(msg) as unknown as ToolResult<TemplateOutput>
}

// ── Template Meta ─────────────────────────────────────────────────────────

export interface TemplateMeta {
  id: string
  name: string
  description: string
  category: 'landing' | 'dashboard' | 'ecommerce' | 'blog' | 'saas' | 'portfolio'
  uiFramework: 'element-plus' | 'tailwind-only' | 'radix-vue'
  cssApproach: 'tailwind' | 'scoped-scss' | 'css-modules'
  tailwindColors?: Record<string, string>
  fonts?: string[]
  spacing?: Record<string, string>
  darkMode?: 'class' | 'media' | false
  allowedDeps: string[]
  features: string[]
  complexity: 'low' | 'medium' | 'high'
}

// ── Schemas ───────────────────────────────────────────────────────────────

const TemplateInputSchema = z.object({
  action: z.enum([
    'list_templates',
    'get_template_details',
    'recommend_template',
  ]).describe('Template operation to perform'),

  templateId: z.string().optional()
    .describe('Template ID for get_template_details'),

  requirements: z.string().optional()
    .describe('Natural language description of what you need, for recommendation'),

  categoryFilter: z.enum([
    'landing', 'dashboard', 'ecommerce', 'blog', 'saas', 'portfolio',
  ]).optional().describe('Filter templates by category'),

  complexityFilter: z.enum(['low', 'medium', 'high']).optional()
    .describe('Filter templates by complexity'),
})

const TemplateOutputSchema = z.object({
  success: z.boolean(),
  templates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.string(),
    uiFramework: z.string(),
    features: z.array(z.string()),
    complexity: z.string(),
  })).optional(),
  template: z.any().optional(),
  recommendation: z.string().optional(),
  recommendationReason: z.string().optional(),
  error: z.string().optional(),
})

export type TemplateInput = z.infer<typeof TemplateInputSchema>
export type TemplateOutput = z.infer<typeof TemplateOutputSchema>

// ── Template Registry ─────────────────────────────────────────────────────

const TEMPLATE_REGISTRY: TemplateMeta[] = [
  {
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
    features: [
      'Dark/light mode toggle',
      'Responsive hero with CTA',
      'Feature grid with icons',
      'Pricing table (3 tiers)',
      'Testimonial carousel',
      'Newsletter signup form',
      'Footer with social links',
    ],
    complexity: 'medium',
  },
  {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    description: 'Data-rich analytics dashboard with charts, tables, and filters',
    category: 'dashboard',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      accent: '#f59e0b',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
    },
    fonts: ['Inter'],
    spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
    darkMode: 'class',
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'echarts', 'vue-echarts', 'pinia'],
    features: [
      'Sidebar navigation',
      'KPI cards with trend indicators',
      'Line/bar/pie charts (ECharts)',
      'Data table with sorting/filtering',
      'Date range picker',
      'Export to CSV',
    ],
    complexity: 'high',
  },
  {
    id: 'blog-minimal',
    name: 'Minimal Blog',
    description: 'Clean, typography-focused blog with MDX support',
    category: 'blog',
    uiFramework: 'tailwind-only',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#0f172a',
      secondary: '#475569',
      accent: '#0ea5e9',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
    },
    fonts: ['Merriweather', 'Inter'],
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2.5rem', xl: '4rem' },
    darkMode: 'class',
    allowedDeps: ['@nuxt/content', 'pinia'],
    features: [
      'MDX-powered blog posts',
      'Tag/category system',
      'Reading time estimate',
      'Table of contents (auto-generated)',
      'Social sharing buttons',
      'RSS feed',
    ],
    complexity: 'low',
  },
  {
    id: 'ecommerce-storefront',
    name: 'E-Commerce Storefront',
    description: 'Full product catalog with cart, checkout, and user accounts',
    category: 'ecommerce',
    uiFramework: 'element-plus',
    cssApproach: 'tailwind',
    tailwindColors: {
      primary: '#dc2626',
      secondary: '#f97316',
      accent: '#facc15',
      background: '#fafafa',
      surface: '#ffffff',
      text: '#171717',
    },
    fonts: ['Inter'],
    spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
    darkMode: false,
    allowedDeps: ['element-plus', '@element-plus/icons-vue', 'pinia', 'vue-router'],
    features: [
      'Product grid with filters',
      'Product detail page with image gallery',
      'Shopping cart (Pinia store)',
      'Checkout form with validation',
      'User profile page',
      'Search with debounce',
    ],
    complexity: 'high',
  },
]

// ── Keyword-Based Recommendation ──────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  landing: ['landing', 'homepage', 'hero', 'cta', 'pricing', 'testimonial', 'newsletter'],
  dashboard: ['dashboard', 'analytics', 'charts', 'kpi', 'metrics', 'data', 'admin'],
  blog: ['blog', 'articles', 'posts', 'writing', 'content', 'mdx', 'typography'],
  ecommerce: ['ecommerce', 'shop', 'store', 'cart', 'checkout', 'product', 'catalog'],
}

// ── Tool Implementation ───────────────────────────────────────────────────

export const TemplateTool = buildToolV2({
  name: 'template',
  description:
    'Browse, inspect, and get recommendations for Nuxt 3 project templates. ' +
    'Use this before generating code to pick the right starting point.',
  category: 'read',
  aliases: ['templates', 'scaffold'],

  inputSchema: TemplateInputSchema,
  outputSchema: TemplateOutputSchema,

  isReadOnly: () => true,
  isDestructive: () => false,
  isConcurrencySafe: () => true,

  async call(
    rawInput,
    _context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _assistantMessage,
  ) {
    const input = rawInput as TemplateInput
    try {
      switch (input.action) {
        case 'list_templates': {
          let filtered = TEMPLATE_REGISTRY
          if (input.categoryFilter) {
            filtered = filtered.filter((t) => t.category === input.categoryFilter)
          }
          if (input.complexityFilter) {
            filtered = filtered.filter((t) => t.complexity === input.complexityFilter)
          }

          const templates = filtered.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            uiFramework: t.uiFramework,
            features: t.features.slice(0, 5),
            complexity: t.complexity,
          }))

          return createToolResult(
            { success: true, templates },
            {
              resultForAssistant:
                `Available templates (${templates.length}):\n` +
                templates.map((t) => `- ${t.id} (${t.category}, ${t.complexity}): ${t.description}`).join('\n'),
            }
          )
        }

        case 'get_template_details': {
          const template = TEMPLATE_REGISTRY.find((t) => t.id === input.templateId)
          if (!template) {
            return fail(`Template not found: ${input.templateId}`)
          }

          return createToolResult(
            { success: true, template },
            {
              resultForAssistant:
                `Template: ${template.name}\n` +
                `UI Framework: ${template.uiFramework}\n` +
                `Colors: ${JSON.stringify(template.tailwindColors)}\n` +
                `Fonts: ${template.fonts?.join(', ')}\n` +
                `Dependencies: ${template.allowedDeps.join(', ')}\n` +
                `Features: ${template.features.join(', ')}\n`,
            }
          )
        }

        case 'recommend_template': {
          if (!input.requirements) {
            return fail('requirements is required for recommend_template')
          }

          const requirements = input.requirements.toLowerCase()
          let bestMatch: { template: TemplateMeta; score: number } | null = null

          for (const template of TEMPLATE_REGISTRY) {
            let score = 0
            const catKeywords = CATEGORY_KEYWORDS[template.category] ?? []
            for (const kw of catKeywords) {
              if (requirements.includes(kw)) score += 3
            }
            for (const feature of template.features) {
              if (requirements.includes(feature.toLowerCase())) score += 2
            }
            if (requirements.includes(template.complexity)) score += 1

            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { template, score }
            }
          }

          if (!bestMatch) {
            return createToolResult({
              success: true,
              recommendation: 'landing-saas-starter',
              recommendationReason: 'Default recommendation — no specific keywords matched',
            })
          }

          return createToolResult(
            {
              success: true,
              recommendation: bestMatch.template.id,
              recommendationReason:
                `Best match: ${bestMatch.template.name} (score: ${bestMatch.score}). ` +
                `Category: ${bestMatch.template.category}, Complexity: ${bestMatch.template.complexity}`,
            },
            {
              resultForAssistant:
                `Recommended template: **${bestMatch.template.id}** (${bestMatch.template.name})\n` +
                `Reason: ${bestMatch.template.description}\n` +
                `Use \`template\` with \`get_template_details\` to inspect it.`,
            }
          )
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return fail(`TemplateTool error: ${msg}`)
    }
  },

  checkPermissions: async () => ({ behavior: 'allow' }),

  renderToolUseMessage(input) {
    return `Template: ${(input as any).action}${(input as any).templateId ? ` ${(input as any).templateId}` : ''}`
  },

  toAutoClassifierInput(input) {
    return `template ${(input as any).action}`
  },

  userFacingName() { return 'Template Browser' },
})

export default TemplateTool
