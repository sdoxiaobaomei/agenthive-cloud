# AGENTHIVE-001: AI App Generation Pipeline

**Status**: Draft
**Author**: AgentHive Architecture
**Date**: 2026-05-09
**Target Codebase**: `agenthive-cloud` (monorepo at `e:\Git\agenthive-cloud`)

---

## 1. Pipeline Overview

```
User Input (ChatPanel)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. Intent Classification                            │
│     apps/api/src/chat-controller/service.ts:271-293 │
│     classifyIntent() → ChatIntent                   │
│     NEW: generate_app, modify_app, deploy_app,       │
│          export_app added to ChatIntent union        │
└───────────────────┬─────────────────────────────────┘
                    │ intent === 'generate_app'
                    ▼
┌─────────────────────────────────────────────────────┐
│  2. Template Selection                               │
│     NEW: apps/api/src/pipeline/templateMatcher.ts    │
│     Phase 1: keyword matching (user input)           │
│     Phase 2: LLM recommendation (fallback)           │
│     Returns: AppTemplate                             │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  3. Design Scheme Selection                          │
│     NEW: apps/api/src/pipeline/designSchemeStore.ts  │
│     12 preset DesignSchemes                          │
│     Returns: DesignScheme                            │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  4. Workspace Initialization                         │
│     NEW: apps/api/src/pipeline/workspaceInit.ts      │
│     copy template → var replacement → git init       │
│     → write AGENTHIVE.json                           │
│     Based on: apps/api/src/config/workspace.ts:43-45 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  5. Orchestrator Ticket Generation                   │
│     NEW: apps/api/src/pipeline/ticketGenerator.ts    │
│     Pattern: AGENTS/orchestrator.ts:29-47 (Ticket)   │
│     Frontend Gen + Supabase Gen + QA (NO backend)    │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  6. Task Execution (existing)                        │
│     apps/api/src/services/taskExecution.ts:68-140    │
│     LLM streaming → file output → WS broadcast       │
│     apps/api/src/websocket/hub.ts:331-376            │
│     apps/api/src/chat-controller/websocket.ts:86-108 │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  7. Verification Pipeline                            │
│     NEW: apps/api/src/pipeline/verification.ts       │
│     verifyProject() → verifyWithRetry(maxRetries=3)  │
│     Rollback: git reset --hard on failure            │
│     Snapshot: git commit on success                  │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  8. Preview / Deploy                                 │
│     run previewCommand from template                 │
│     expose via previewPort                           │
│     project_deployments table                        │
└─────────────────────────────────────────────────────┘
```

**Key existing integration points:**

| Integration Point | File | Lines |
|---|---|---|
| Chat session lifecycle | `apps/api/src/chat-controller/service.ts` | 62-108 |
| Intent classification | `apps/api/src/chat-controller/service.ts` | 271-293 |
| Intent→ticket mapping | `apps/api/src/chat-controller/service.ts` | 756-821 |
| LLM structured reply | `apps/api/src/chat-controller/service.ts` | 640-659 |
| WebSocket broadcast | `apps/api/src/chat-controller/websocket.ts` | 86-108 |
| Task execution | `apps/api/src/services/taskExecution.ts` | 68-140 |
| Billing | `apps/api/src/services/taskExecution.ts` | 351-397 |
| Orchestrator Ticket/YAML | `AGENTS/orchestrator.ts` | 29-65, 85-204 |
| Worker base | `AGENTS/workers/_base.ts` | 11-88 |
| Workspace path config | `apps/api/src/config/workspace.ts` | 30-44 |
| DB schema | `apps/api/src/db/schema.sql` | 1-288 |

---

## 2. Intent Classification — Extended

### 2.1 ChatIntent Extension

**File to modify**: `apps/api/src/chat-controller/types.ts:5-13`

```typescript
// BEFORE (current):
export type ChatIntent =
  | 'create_project'
  | 'modify_code'
  | 'code_review'
  | 'run_tests'
  | 'fix_bug'
  | 'deploy'
  | 'explain'
  | 'chat'

// AFTER (extended):
export type ChatIntent =
  | 'create_project'
  | 'modify_code'
  | 'code_review'
  | 'run_tests'
  | 'fix_bug'
  | 'deploy'
  | 'explain'
  | 'chat'
  // ---- NEW: app generation pipeline ----
  | 'generate_app'    // User asks to create a new app from template
  | 'modify_app'      // User asks to change generated app
  | 'deploy_app'      // User asks to deploy generated app
  | 'export_app'      // User asks to download the generated app
```

### 2.2 Enhanced Classification Prompt

**File to modify**: `apps/api/src/chat-controller/service.ts:31-53`

Replace `INTENT_CLASSIFICATION_PROMPT` with the enhanced version:

```typescript
const INTENT_CLASSIFICATION_PROMPT = `分析用户输入的意图，从以下选项中选择最匹配的一个：

可选意图：
- generate_app: 用户想要创建一个新的 Web 应用、网站、后台管理系统或落地页
- modify_app: 用户想要修改之前生成的应用（改颜色、改布局、加功能等）
- deploy_app: 用户想要部署/上线应用
- export_app: 用户想要下载或导出应用的代码
- create_project: 用户想要创建一个新的软件项目或功能（传统代码开发）
- modify_code: 用户想要修改、添加或删除代码
- code_review: 用户想要审查代码质量
- run_tests: 用户想要运行测试用例
- fix_bug: 用户想要修复一个错误
- deploy: 用户想要部署应用（传统 CI/CD 流程）
- explain: 用户想要理解某段代码或概念
- chat: 普通聊天，不涉及具体开发任务

示例：
用户: "帮我做一个待办事项应用" → generate_app
用户: "帮我生成一个电商落地页" → generate_app
用户: "做一个后台管理系统" → generate_app
用户: "把按钮颜色改成蓝色" → modify_app
用户: "把这个应用部署上线" → deploy_app
用户: "帮我导出项目的源代码" → export_app
用户: "帮我做个登录页面" → create_project
用户: "这个函数好像有bug，返回不对" → fix_bug
用户: "帮我看看这段代码写得怎么样" → code_review
用户: "你好，今天天气怎么样" → chat
用户: "我想给订单列表加个搜索功能" → modify_code
用户: "为什么这里要用递归" → explain

用户输入: {userInput}

请只返回意图标识符，不要解释。如果难以判断，默认返回 chat。`
```

### 2.3 Intent Routing Map

**New file**: `apps/api/src/pipeline/intentRouter.ts`

```typescript
import type { ChatIntent } from '../chat-controller/types.js'

/**
 * Maps each intent to its pipeline stage and required data.
 * generate_app, modify_app, deploy_app, export_app are handled
 * by the app generation pipeline; all others follow the existing
 * code path (service.ts:756-821).
 */
export interface IntentRoute {
  /** Whether this intent is handled by the app generation pipeline */
  isAppPipeline: boolean
  /** The orchestrator ticket creation strategy */
  ticketStrategy: 'generate' | 'modify' | 'deploy' | 'export' | 'legacy'
  /** Whether a project must exist for this intent */
  requiresProject: boolean
  /** Whether an AGENTHIVE.json must exist in the workspace */
  requiresAgentHiveConfig: boolean
}

const INTENT_ROUTE_MAP: Record<ChatIntent, IntentRoute> = {
  generate_app:      { isAppPipeline: true,  ticketStrategy: 'generate', requiresProject: false, requiresAgentHiveConfig: false },
  modify_app:        { isAppPipeline: true,  ticketStrategy: 'modify',   requiresProject: true,  requiresAgentHiveConfig: true  },
  deploy_app:        { isAppPipeline: true,  ticketStrategy: 'deploy',   requiresProject: true,  requiresAgentHiveConfig: true  },
  export_app:        { isAppPipeline: true,  ticketStrategy: 'export',   requiresProject: true,  requiresAgentHiveConfig: true  },
  create_project:    { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: false, requiresAgentHiveConfig: false },
  modify_code:       { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: true,  requiresAgentHiveConfig: false },
  code_review:       { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: true,  requiresAgentHiveConfig: false },
  run_tests:         { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: true,  requiresAgentHiveConfig: false },
  fix_bug:           { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: true,  requiresAgentHiveConfig: false },
  deploy:            { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: true,  requiresAgentHiveConfig: false },
  explain:           { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: false, requiresAgentHiveConfig: false },
  chat:              { isAppPipeline: false, ticketStrategy: 'legacy',   requiresProject: false, requiresAgentHiveConfig: false },
}

export function getIntentRoute(intent: ChatIntent): IntentRoute {
  return INTENT_ROUTE_MAP[intent]
}

export function isAppPipelineIntent(intent: ChatIntent): boolean {
  return INTENT_ROUTE_MAP[intent]?.isAppPipeline ?? false
}
```

---

## 3. AppTemplate System

### 3.1 AppTemplate Interface

**New file**: `apps/api/src/pipeline/types.ts`

```typescript
/**
 * Design tokens for a color scheme.
 */
export interface DesignTokens {
  primary: string       // e.g. '#2563EB'
  secondary: string     // e.g. '#7C3AED'
  accent: string        // e.g. '#F59E0B'
  background: string    // e.g. '#FFFFFF'
  surface: string       // e.g. '#F9FAFB'
  text: string          // e.g. '#111827'
  textMuted: string     // e.g. '#6B7280'
  border: string        // e.g. '#E5E7EB'
  borderRadius: string  // e.g. '8px'
  fontFamily: string    // e.g. 'Inter, sans-serif'
}

/**
 * A preset design scheme with full tokens and Tailwind config generator.
 */
export interface DesignScheme {
  id: string
  name: string
  description: string
  tokens: DesignTokens
  /** Generate a tailwind.config.ts partial for this scheme */
  generateTailwindConfig(): string
  /** Generate CSS custom properties for this scheme */
  generateCSSVariables(): string
}

/**
 * An app template: a complete starting codebase for a specific tech stack.
 * Templates live in apps/api/src/pipeline/templates/<id>/
 */
export interface AppTemplate {
  id: string
  name: string
  description: string
  /** Category for UI browsing: 'webapp' | 'landing' | 'admin' | 'static' */
  category: 'webapp' | 'landing' | 'admin' | 'static'
  /** Stored as JSONB in DB, used as string[] in code */
  techStack: string[]
  /**
   * Variables that are replaced during workspace initialization.
   * Format: {{VAR_NAME}} in template files.
   */
  variables: TemplateVariable[]
  /** Relative path to the template source directory */
  sourcePath: string
  /** IDs of DesignSchemes recommended for this template */
  recommendedSchemes: string[]
  /**
   * Verification commands to run after generation.
   * Each command is executed in the project root.
   * Example: ['npm install', 'npm run type-check', 'npm run test']
   */
  verificationCommands: string[]
  /** Command to start preview: e.g. 'npm run dev' */
  previewCommand: string
  /** Port the preview server listens on: e.g. 5173 */
  previewPort: number
}

export interface TemplateVariable {
  name: string            // e.g. 'PROJECT_NAME'
  description: string     // e.g. 'The name of the project'
  defaultValue: string    // e.g. 'my-app'
  required: boolean
}
```

### 3.2 Template Catalog

**New directory**: `apps/api/src/pipeline/templates/`

Each template is a subdirectory containing a complete starter project:

```
apps/api/src/pipeline/templates/
├── react-vite/
│   ├── TEMPLATE.json                # Template metadata
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   ├── components/
│   │   │   └── ui/
│   │   └── pages/
│   └── public/
├── vue-vite/
│   ├── TEMPLATE.json
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── style.css
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   ├── components/
│   │   └── pages/
│   └── public/
├── nextjs-app/
│   ├── TEMPLATE.json
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   └── supabase.ts
│   └── public/
├── landing-page/
│   ├── TEMPLATE.json
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── style.css
│   │   └── sections/
│   │       ├── Hero.vue
│   │       ├── Features.vue
│   │       ├── Pricing.vue
│   │       └── Footer.vue
│   └── public/
└── dashboard/
    ├── TEMPLATE.json
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── index.html
    ├── src/
    │   ├── main.ts
    │   ├── App.vue
    │   ├── style.css
    │   ├── router/
    │   │   └── index.ts
    │   ├── layouts/
    │   │   └── DashboardLayout.vue
    │   ├── components/
    │   │   ├── Sidebar.vue
    │   │   └── DataTable.vue
    │   └── pages/
    │       ├── Dashboard.vue
    │       ├── Users.vue
    │       └── Settings.vue
    └── public/
```

### 3.3 Template Metadata — TEMPLATE.json

**New file**: `apps/api/src/pipeline/templates/react-vite/TEMPLATE.json`

```json
{
  "id": "react-vite",
  "name": "React + Vite + Tailwind",
  "description": "React 18 with Vite, Tailwind CSS, and Supabase integration. Modern SPA starter.",
  "category": "webapp",
  "techStack": ["react", "vite", "typescript", "tailwind", "supabase"],
  "variables": [
    { "name": "PROJECT_NAME", "description": "The package name", "defaultValue": "my-app", "required": true },
    { "name": "APP_TITLE", "description": "The HTML title", "defaultValue": "My App", "required": true },
    { "name": "SUPABASE_URL", "description": "Supabase project URL", "defaultValue": "", "required": false },
    { "name": "SUPABASE_ANON_KEY", "description": "Supabase anonymous key", "defaultValue": "", "required": false },
    { "name": "PRIMARY_COLOR", "description": "CSS variable for primary color", "defaultValue": "#2563EB", "required": false }
  ],
  "recommendedSchemes": ["professional-blue", "minimalist-gray", "vibrant-purple"],
  "verificationCommands": [
    "npm install",
    "npm run build",
    "npm run type-check"
  ],
  "previewCommand": "npm run dev",
  "previewPort": 5173
}
```

Same pattern for: `vue-vite/TEMPLATE.json`, `nextjs-app/TEMPLATE.json`, `landing-page/TEMPLATE.json`, `dashboard/TEMPLATE.json`.

### 3.4 Template Selection Logic

**New file**: `apps/api/src/pipeline/templateMatcher.ts`

```typescript
import { getLLMService } from '../services/llm.js'
import logger from '../utils/logger.js'
import type { AppTemplate } from './types.js'
import type { LLMMessage } from '../services/llm.js'

/**
 * Preloaded template catalog. In production this would be loaded from
 * the filesystem at startup and cached.
 */
const TEMPLATE_CATALOG: AppTemplate[] = [
  // Loaded at startup via loadTemplateCatalog()
]

/**
 * Phase 1: Keyword-based matching from user input.
 * Fast, deterministic, no LLM cost.
 */
function keywordMatch(userInput: string): AppTemplate | null {
  const lower = userInput.toLowerCase()

  const keywordMap: Array<{ keywords: string[]; templateId: string }> = [
    { keywords: ['todo', '待办', 'task', '任务', 'crud'], templateId: 'react-vite' },
    { keywords: ['dashboard', '后台', '管理', 'admin', 'panel', '数据'], templateId: 'dashboard' },
    { keywords: ['landing', '落地页', '主页', '官网', '营销', '介绍'], templateId: 'landing-page' },
    { keywords: ['next', 'nextjs', 'next.js', 'ssr', '服务端渲染'], templateId: 'nextjs-app' },
    { keywords: ['vue', 'vue3', 'vue.js'], templateId: 'vue-vite' },
    { keywords: ['react', 'react.js', 'spa'], templateId: 'react-vite' },
  ]

  for (const { keywords, templateId } of keywordMap) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const template = TEMPLATE_CATALOG.find(t => t.id === templateId)
        if (template) {
          logger.info('[TemplateMatcher] Phase 1 keyword match', { keyword: kw, templateId })
          return template
        }
      }
    }
  }

  return null
}

/**
 * Phase 2: LLM-based recommendation when keyword matching fails.
 */
async function llmRecommend(userInput: string): Promise<AppTemplate> {
  const llmService = getLLMService()

  const catalog = TEMPLATE_CATALOG.map(t =>
    `- ${t.id}: ${t.name} (${t.techStack.join(', ')}) — ${t.description}`
  ).join('\n')

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个模板推荐器。根据用户的需求，从以下模板中选择最合适的一个。只返回模板ID，不要解释。\n\n可用模板:\n${catalog}`
    },
    { role: 'user', content: userInput },
  ]

  const result = await llmService.complete(messages, {
    temperature: 0.1,
    maxTokens: 32,
    timeoutMs: 5000,
  })

  const rawId = result.content.trim().toLowerCase()
  const matched = TEMPLATE_CATALOG.find(t => t.id === rawId)
    ?? TEMPLATE_CATALOG.find(t => t.id === 'react-vite') // default fallback

  logger.info('[TemplateMatcher] Phase 2 LLM recommendation', { rawId, selected: matched.id })
  return matched
}

/**
 * Select a template using two-phase matching.
 */
export async function selectTemplate(userInput: string): Promise<AppTemplate> {
  const phase1Result = keywordMatch(userInput)
  if (phase1Result) return phase1Result

  return llmRecommend(userInput)
}

/**
 * Load the template catalog from filesystem at runtime.
 */
export async function loadTemplateCatalog(): Promise<AppTemplate[]> {
  // Implementation: read all templates/*/TEMPLATE.json,
  // validate against AppTemplate interface, populate TEMPLATE_CATALOG.
  // Called once at server startup.
  return []
}
```

---

## 4. DesignScheme System

### 4.1 DesignScheme Implementation

**New file**: `apps/api/src/pipeline/designSchemeStore.ts`

```typescript
import type { DesignScheme, DesignTokens } from './types.js'

/**
 * 12 preset design schemes. Each scheme can generate both a Tailwind config
 * partial and CSS custom properties, enabling framework-agnostic theming.
 */
export const DESIGN_SCHEMES: DesignScheme[] = [
  {
    id: 'professional-blue',
    name: 'Professional Blue',
    description: 'Corporate-friendly blue palette. Clean and trustworthy.',
    tokens: {
      primary: '#2563EB', secondary: '#3B82F6', accent: '#F59E0B',
      background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A',
      textMuted: '#64748B', border: '#E2E8F0', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    description: 'Warm orange-red tones. Energetic and inviting.',
    tokens: {
      primary: '#EA580C', secondary: '#F97316', accent: '#FBBF24',
      background: '#FFFBEB', surface: '#FFF7ED', text: '#431407',
      textMuted: '#9A3412', border: '#FED7AA', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Nature-inspired greens. Calm and balanced.',
    tokens: {
      primary: '#166534', secondary: '#22C55E', accent: '#A3E635',
      background: '#F0FDF4', surface: '#DCFCE7', text: '#052E16',
      textMuted: '#166534', border: '#BBF7D0', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'minimalist-gray',
    name: 'Minimalist Gray',
    description: 'Neutral grayscale. Minimal and elegant.',
    tokens: {
      primary: '#374151', secondary: '#6B7280', accent: '#111827',
      background: '#FFFFFF', surface: '#F9FAFB', text: '#111827',
      textMuted: '#9CA3AF', border: '#E5E7EB', borderRadius: '4px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'vibrant-purple',
    name: 'Vibrant Purple',
    description: 'Bold purple-violet scheme. Creative and expressive.',
    tokens: {
      primary: '#7C3AED', secondary: '#A855F7', accent: '#F472B6',
      background: '#FAF5FF', surface: '#F3E8FF', text: '#2E1065',
      textMuted: '#7E22CE', border: '#DDD6FE', borderRadius: '12px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    description: 'Soft rose and gold. Feminine and luxurious.',
    tokens: {
      primary: '#BE123C', secondary: '#FB7185', accent: '#FBBF24',
      background: '#FFF1F2', surface: '#FFE4E6', text: '#4C0519',
      textMuted: '#9F1239', border: '#FECDD3', borderRadius: '16px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    description: 'Fresh teal-aqua tones. Modern and refreshing.',
    tokens: {
      primary: '#0D9488', secondary: '#14B8A6', accent: '#FDE047',
      background: '#F0FDFA', surface: '#CCFBF1', text: '#042F2E',
      textMuted: '#115E59', border: '#99F6E4', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'OLED-friendly dark theme. Sleek and modern.',
    tokens: {
      primary: '#818CF8', secondary: '#A5B4FC', accent: '#F472B6',
      background: '#0F172A', surface: '#1E293B', text: '#E2E8F0',
      textMuted: '#94A3B8', border: '#334155', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'nordic-light',
    name: 'Nordic Light',
    description: 'Scandinavian-inspired cool tones. Clean and airy.',
    tokens: {
      primary: '#475569', secondary: '#94A3B8', accent: '#67E8F9',
      background: '#F8FAFC', surface: '#F1F5F9', text: '#1E293B',
      textMuted: '#64748B', border: '#CBD5E1', borderRadius: '4px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'retro-amber',
    name: 'Retro Amber',
    description: 'Vintage amber and brown. Warm and nostalgic.',
    tokens: {
      primary: '#B45309', secondary: '#D97706', accent: '#FDE68A',
      background: '#FFFBEB', surface: '#FEF3C7', text: '#451A03',
      textMuted: '#92400E', border: '#FCD34D', borderRadius: '4px',
      fontFamily: 'Georgia, serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    description: 'Neon lights on dark background. Futuristic and bold.',
    tokens: {
      primary: '#22D3EE', secondary: '#A78BFA', accent: '#F43F5E',
      background: '#09090B', surface: '#18181B', text: '#F4F4F5',
      textMuted: '#A1A1AA', border: '#27272A', borderRadius: '2px',
      fontFamily: 'JetBrains Mono, monospace',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
  {
    id: 'earth-tones',
    name: 'Earth Tones',
    description: 'Natural earth colors. Grounded and organic.',
    tokens: {
      primary: '#78350F', secondary: '#92400E', accent: '#CA8A04',
      background: '#FEFCE8', surface: '#FEF3C7', text: '#1C1917',
      textMuted: '#78716C', border: '#D6D3D1', borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    generateTailwindConfig,
    generateCSSVariables,
  },
]

function generateTailwindConfig(this: DesignScheme): string {
  const t = this.tokens
  return `// Auto-generated by AgentHive DesignScheme "${this.id}"
export default {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '${t.primary}', 50: '${t.surface}' },
        secondary: { DEFAULT: '${t.secondary}' },
        accent: { DEFAULT: '${t.accent}' },
        surface: { DEFAULT: '${t.surface}' },
      },
      borderRadius: {
        DEFAULT: '${t.borderRadius}',
      },
      fontFamily: {
        sans: ['${t.fontFamily}'],
      },
    },
  },
}`
}

function generateCSSVariables(this: DesignScheme): string {
  const t = this.tokens
  return `/* Auto-generated by AgentHive DesignScheme "${this.id}" */
:root {
  --color-primary: ${t.primary};
  --color-secondary: ${t.secondary};
  --color-accent: ${t.accent};
  --color-background: ${t.background};
  --color-surface: ${t.surface};
  --color-text: ${t.text};
  --color-text-muted: ${t.textMuted};
  --color-border: ${t.border};
  --border-radius: ${t.borderRadius};
  --font-family: ${t.fontFamily};
}`
}

export function getDesignScheme(id: string): DesignScheme | undefined {
  return DESIGN_SCHEMES.find(s => s.id === id)
}

export function getRecommendedSchemes(templateSchemeIds: string[]): DesignScheme[] {
  return templateSchemeIds
    .map(id => getDesignScheme(id))
    .filter((s): s is DesignScheme => s != null)
}

export function getAllSchemes(): DesignScheme[] {
  return DESIGN_SCHEMES
}
```

---

## 5. Workspace Initialization

### 5.1 initWorkspace Implementation

**New file**: `apps/api/src/pipeline/workspaceInit.ts`

```typescript
import path from 'path'
import { mkdir, cp, writeFile, readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { AppTemplate, DesignScheme } from './types.js'
import { WORKSPACE_BASE } from '../config/workspace.js'
import logger from '../utils/logger.js'

const execAsync = promisify(exec)

/**
 * AgentHive project configuration stored at the root of every generated app.
 */
export interface AgentHiveConfig {
  version: 1
  projectId: string
  templateId: string
  designSchemeId: string
  variables: Record<string, string>
  createdAt: string
  generatedBy: string
}

/**
 * Initialize a workspace for app generation:
 * 1. Create directory at {WORKSPACE_BASE}/{userId}/{projectId}
 * 2. Copy template files from apps/api/src/pipeline/templates/{templateId}/
 * 3. Replace {{VAR_NAME}} placeholders with resolved variable values
 * 4. Inject design scheme (Tailwind config + CSS variables)
 * 5. git init for version tracking
 * 6. Write AGENTHIVE.json manifest
 *
 * Pattern adapted from:
 *   - scripts/archive/init-workspace.js (copy + symlink approach)
 *   - apps/api/src/config/workspace.ts:30-44 (path resolution)
 */
export async function initWorkspace(
  projectId: string,
  userId: string,
  template: AppTemplate,
  designScheme: DesignScheme,
  variables: Record<string, string>
): Promise<string> {
  const workspacePath = path.join(WORKSPACE_BASE, userId, projectId)
  const templatePath = path.join(
    import.meta.dirname,  // apps/api/src/pipeline/
    '..',                  // apps/api/src/
    '..',                  // apps/api/
    '..',                  // agenthive-cloud/
    'apps', 'api', 'src', 'pipeline', 'templates', template.id
  )

  logger.info('[WorkspaceInit] Creating workspace', { projectId, userId, templateId: template.id, workspacePath })

  // 1. Create directory
  await mkdir(workspacePath, { recursive: true })

  // 2. Copy template (excluding TEMPLATE.json)
  await cp(templatePath, workspacePath, {
    recursive: true,
    filter: (src) => !src.endsWith('TEMPLATE.json'),
  })

  // 3. Variable replacement: walk all files, replace {{VAR_NAME}}
  await replaceVariables(workspacePath, variables, template.variables)

  // 4. Inject design scheme
  await injectDesignScheme(workspacePath, designScheme, template)

  // 5. Git init
  await execAsync('git init', { cwd: workspacePath })
  await execAsync('git add -A', { cwd: workspacePath })
  await execAsync('git commit -m "feat: initial project from template" --no-gpg-sign', { cwd: workspacePath })
    .catch(async () => {
      // git config may not be set; add manually
      await execAsync('git add -A', { cwd: workspacePath })
      await execAsync(
        'git -c user.name="AgentHive" -c user.email="bot@agenthive.dev" commit -m "feat: initial project from template" --no-gpg-sign',
        { cwd: workspacePath }
      )
    })

  // 6. Write AGENTHIVE.json
  const config: AgentHiveConfig = {
    version: 1,
    projectId,
    templateId: template.id,
    designSchemeId: designScheme.id,
    variables,
    createdAt: new Date().toISOString(),
    generatedBy: userId,
  }
  await writeFile(
    path.join(workspacePath, 'AGENTHIVE.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  )

  logger.info('[WorkspaceInit] Workspace initialized successfully', { projectId, workspacePath })
  return workspacePath
}

/**
 * Replace {{VAR_NAME}} placeholders in all template files.
 */
async function replaceVariables(
  rootPath: string,
  values: Record<string, string>,
  varDefs: { name: string; defaultValue: string }[]
): Promise<void> {
  const { readdir, stat, readFile, writeFile } = await import('fs/promises')
  const path = await import('path')

  const resolved: Record<string, string> = {}
  for (const v of varDefs) {
    resolved[v.name] = values[v.name] || v.defaultValue
  }

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      // Skip node_modules, .git, and binary-ish folders
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.venv') continue

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        // Only process text files (skip images, fonts, etc.)
        const textExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.vue', '.css', '.html', '.md', '.yaml', '.yml', '.env', '.gitignore', '.toml']
        const ext = path.extname(entry.name)
        if (!textExts.includes(ext) && entry.name !== 'Dockerfile') continue

        let content = await readFile(fullPath, 'utf-8')
        let changed = false
        for (const [name, value] of Object.entries(resolved)) {
          const placeholder = `{{${name}}}`
          if (content.includes(placeholder)) {
            content = content.replaceAll(placeholder, value)
            changed = true
          }
        }
        if (changed) {
          await writeFile(fullPath, content, 'utf-8')
        }
      }
    }
  }

  await walk(rootPath)
}

/**
 * Inject design scheme into the generated project.
 * Merges into existing tailwind.config.* / style.css / globals.css
 * based on the template's tech stack.
 */
async function injectDesignScheme(
  workspacePath: string,
  scheme: DesignScheme,
  template: AppTemplate
): Promise<void> {
  const hasTailwind = template.techStack.includes('tailwind')
  const cssVars = scheme.generateCSSVariables()

  if (hasTailwind) {
    // Write a tailwind.preset.ts that can be imported by tailwind.config
    const presetPath = path.join(workspacePath, 'tailwind.preset.ts')
    await writeFile(presetPath, scheme.generateTailwindConfig(), 'utf-8')
  }

  // Always inject CSS variables into the main stylesheet
  // The file name varies by template:
  const styleCandidates = ['src/style.css', 'src/index.css', 'src/styles/globals.css', 'app/globals.css', 'src/assets/main.css']
  for (const candidate of styleCandidates) {
    const p = path.join(workspacePath, candidate)
    try {
      const existing = await readFile(p, 'utf-8')
      if (!existing.includes('--color-primary')) {
        const updated = `${cssVars}\n\n${existing}`
        await writeFile(p, updated, 'utf-8')
        logger.info('[WorkspaceInit] Injected CSS variables into', { file: candidate })
      }
      return
    } catch {
      // file doesn't exist, try next
    }
  }

  // Fallback: create src/style.css if none found
  const fallbackPath = path.join(workspacePath, 'src', 'style.css')
  await mkdir(path.dirname(fallbackPath), { recursive: true })
  await writeFile(fallbackPath, cssVars, 'utf-8')
}
```

### 5.2 AGENTHIVE.json Schema

```typescript
// TypeScript schema for AGENTHIVE.json (also exists as JSON Schema for validation)
export interface AgentHiveConfig {
  /** Schema version for migration support */
  version: 1
  /** The project UUID in the projects table */
  projectId: string
  /** Template ID used to generate the app */
  templateId: string
  /** DesignScheme ID applied */
  designSchemeId: string
  /** Resolved variable values */
  variables: Record<string, string>
  /** ISO timestamp of workspace creation */
  createdAt: string
  /** User ID who initiated generation */
  generatedBy: string
}
```

---

## 6. Orchestrator Ticket Generation

### 6.1 Ticket Schema for App Generation

**New file**: `apps/api/src/pipeline/ticketGenerator.ts`

```typescript
import type { AppTemplate, DesignScheme } from './types.js'
import logger from '../utils/logger.js'

/**
 * Ticket types specific to the app generation pipeline.
 * Follows the same pattern as AGENTS/orchestrator.ts:29-47.
 */
export interface GenerationTicket {
  id: string              // e.g. "GEN-001-FE"
  role: 'frontend_dev' | 'supabase_dev' | 'qa_engineer'
  task: string
  prompt: string
  context: {
    workspacePath: string
    templateId: string
    designSchemeId: string
    relevant_files: string[]
    constraints: string[]
    depends_on: string[]
    variables: Record<string, string>
  }
}

/**
 * Generate the 3 tickets for app creation:
 * 1. Frontend Gen Ticket (小花) — modify generated template code
 * 2. Supabase Gen Ticket (阿铁) — create DB tables, set up auth
 * 3. QA Ticket (阿镜) — verify the result
 *
 * NOTE: No traditional "backend" ticket because the template already
 *       provides the client-side code. Supabase handles the backend.
 */
export function generateAppTickets(
  projectId: string,
  workspacePath: string,
  template: AppTemplate,
  designScheme: DesignScheme,
  userInput: string,
  variables: Record<string, string>
): GenerationTicket[] {
  const tickets: GenerationTicket[] = []

  // Ticket 1: Frontend Generation (小花)
  tickets.push({
    id: `${projectId}-FE`,
    role: 'frontend_dev',
    task: `根据需求和设计生成前端代码: ${userInput.substring(0, 80)}`,
    prompt: `
## App Generation Task — Frontend

**Template**: ${template.name} (${template.id})
**Design Scheme**: ${designScheme.name} (${designScheme.id})

### User Requirement
${userInput}

### Design Tokens
Primary: ${designScheme.tokens.primary}
Secondary: ${designScheme.tokens.secondary}
Accent: ${designScheme.tokens.accent}
Background: ${designScheme.tokens.background}
Surface: ${designScheme.tokens.surface}
Text: ${designScheme.tokens.text}
Border Radius: ${designScheme.tokens.borderRadius}
Font: ${designScheme.tokens.fontFamily}

### Instructions
1. Read the generated template files in the workspace
2. Customize the app based on the user's requirement above
3. Apply the design tokens consistently across all components
4. Use the existing tech stack (${template.techStack.join(', ')})
5. Do NOT modify package.json, tsconfig.json, or any config files
6. Focus on src/ directory: pages, components, styles
7. Ensure all imports are correct and the type-check passes
    `.trim(),
    context: {
      workspacePath,
      templateId: template.id,
      designSchemeId: designScheme.id,
      relevant_files: ['src/'],
      constraints: [
        'Preserve existing tech stack configuration',
        'Use the provided design tokens consistently',
        'Ensure responsive design (mobile-first)',
        'All text must be in Chinese if the user input is in Chinese',
      ],
      depends_on: [],
      variables,
    },
  })

  // Ticket 2: Supabase Generation (阿铁)
  if (template.techStack.includes('supabase')) {
    tickets.push({
      id: `${projectId}-SB`,
      role: 'supabase_dev',
      task: `为项目配置 Supabase 数据库和后端: ${userInput.substring(0, 80)}`,
      prompt: `
## App Generation Task — Supabase Backend

**Project ID**: ${projectId}
**Template**: ${template.name}

### User Requirement
${userInput}

### Instructions
1. Analyze the user's requirement and identify required database tables
2. Generate a Supabase migration SQL file at supabase/migrations/00001_init.sql
3. Set up Row Level Security (RLS) policies
4. Configure authentication settings (email/password, OAuth providers if needed)
5. Generate TypeScript types from the schema
6. Update src/lib/supabase.ts with the correct client initialization
    `.trim(),
      context: {
        workspacePath,
        templateId: template.id,
        designSchemeId: designScheme.id,
        relevant_files: ['supabase/', 'src/lib/supabase.ts'],
        constraints: [
          'Use PostgreSQL best practices for schema design',
          'Enable RLS on all tables by default',
          'Use UUID primary keys (gen_random_uuid())',
          'Create appropriate indexes for foreign keys',
        ],
        depends_on: [], // Can run in parallel with FE
        variables,
      },
    })
  }

  // Ticket 3: QA Verification (阿镜)
  tickets.push({
    id: `${projectId}-QA`,
    role: 'qa_engineer',
    task: `审查生成的应用: ${projectId}`,
    prompt: `
## QA Verification — App Generation

**Project ID**: ${projectId}
**Template**: ${template.name}
**Design Scheme**: ${designScheme.name}

### Verification Checklist
1. TypeScript type-check passes: \`npx tsc --noEmit\`
2. Build succeeds: \`npm run build\`
3. All pages render without runtime errors
4. Design tokens are consistently applied
5. Supabase client is correctly configured (if applicable)
6. Responsive design works on mobile/tablet/desktop
7. No hardcoded secrets or API keys in the source code
    `.trim(),
    context: {
      workspacePath,
      templateId: template.id,
      designSchemeId: designScheme.id,
      relevant_files: [], // QA reviews everything
      constraints: [
        'Report all issues with severity: critical | warning | suggestion',
        'Block merge if any critical issues found',
        'Auto-fix loop: max 3 iterations (matching AGENTS/orchestrator.ts:333)',
      ],
      depends_on: [tickets[0]?.id, tickets[1]?.id].filter(Boolean) as string[],
      variables,
    },
  })

  logger.info('[TicketGenerator] Generated tickets', {
    projectId,
    ticketCount: tickets.length,
    ticketIds: tickets.map(t => t.id),
  })

  return tickets
}

/**
 * YAML serialization matching the pattern in AGENTS/orchestrator.ts:85-111.
 */
export interface TicketYaml {
  ticket_id: string
  role: string
  task: string
  prompt: string
  workspace_path: string
  template_id: string
  design_scheme_id: string
  relevant_files: string[]
  constraints: string[]
  depends_on: string[]
  variables: Record<string, string>
  created_at: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export function ticketToYaml(ticket: GenerationTicket): TicketYaml {
  return {
    ticket_id: ticket.id,
    role: ticket.role,
    task: ticket.task,
    prompt: ticket.prompt,
    workspace_path: ticket.context.workspacePath,
    template_id: ticket.context.templateId,
    design_scheme_id: ticket.context.designSchemeId,
    relevant_files: ticket.context.relevant_files,
    constraints: ticket.context.constraints,
    depends_on: ticket.context.depends_on,
    variables: ticket.context.variables,
    created_at: new Date().toISOString(),
    status: 'pending',
  }
}
```

### 6.2 Integration with Existing chat-controller

**File to modify**: `apps/api/src/chat-controller/service.ts:297-331`

The `executeAgentTask` method needs a new branch for app pipeline intents:

```typescript
// In chatService.executeAgentTask (around line 297-331):
async executeAgentTask(
  sessionId: string,
  intent: ChatIntent,
  content: string,
  userId?: string,
  estimatedCost?: number
): Promise<AgentTask[]> {
  const workspacePath = getChatWorkspacePath(sessionId)
  await redis.setex(key('chat:workspace', sessionId), 86400, workspacePath)

  // NEW: App pipeline intents go through the generation pipeline
  if (isAppPipelineIntent(intent)) {
    const tickets = await executeAppPipelineTask({
      sessionId, intent, content, userId, workspacePath, estimatedCost,
    })
    return tickets
  }

  // Existing code for legacy intents...
  const tickets = await createTicketsForIntent(sessionId, intent, content, workspacePath)
  // ...
}
```

---

## 7. Verification Pipeline

### 7.1 Verification Implementation

**New file**: `apps/api/src/pipeline/verification.ts`

```typescript
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import logger from '../utils/logger.js'
import type { AppTemplate } from './types.js'
import type { Socket } from 'socket.io'

const execAsync = promisify(exec)

export interface VerificationResult {
  passed: boolean
  errors: VerificationError[]
  totalSteps: number
  completedSteps: number
  durationMs: number
}

export interface VerificationError {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  stepIndex: number
}

/**
 * Execute verification commands step-by-step and collect errors.
 * Pattern: runs each command from template.verificationCommands in sequence,
 * streaming real-time progress via WebSocket to the chat namespace.
 * Based on: apps/api/src/chat-controller/websocket.ts:86-108 (broadcast pattern)
 */
export async function verifyProject(
  workspacePath: string,
  commands: string[],
  onProgress?: (step: number, total: number, currentCommand: string) => void
): Promise<VerificationResult> {
  const errors: VerificationError[] = []
  const startTime = Date.now()

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i]
    onProgress?.(i + 1, commands.length, command)

    logger.info('[Verification] Running command', { step: i + 1, total: commands.length, command })

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspacePath,
        timeout: 120_000, // 2 minutes per command
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'production', // skip dev-only behaviors
        },
      })

      if (stderr && !stderr.includes('warning')) {
        logger.warn('[Verification] Command produced stderr', { command, stderr: stderr.substring(0, 200) })
      }

      logger.info('[Verification] Command passed', { command, outputLength: stdout.length })
    } catch (err: any) {
      const error: VerificationError = {
        command,
        exitCode: err.code ?? 1,
        stdout: err.stdout?.substring(0, 1000) ?? '',
        stderr: err.stderr?.substring(0, 1000) ?? err.message ?? '',
        stepIndex: i,
      }
      errors.push(error)
      logger.error('[Verification] Command failed', error, { command, exitCode: error.exitCode })
    }
  }

  const durationMs = Date.now() - startTime
  const result: VerificationResult = {
    passed: errors.length === 0,
    errors,
    totalSteps: commands.length,
    completedSteps: commands.length - errors.length,
    durationMs,
  }

  logger.info('[Verification] Complete', { passed: result.passed, errors: errors.length, durationMs })
  return result
}

/**
 * Verify with automatic retry on failure.
 * After each failed run, inject error context and issue a fix command
 * before retrying. Maximum 3 retries, matching the orchestrator pattern
 * in AGENTS/orchestrator.ts:333.
 */
export async function verifyWithRetry(
  workspacePath: string,
  template: AppTemplate,
  onProgress?: (step: number, total: number, currentCommand: string) => void
): Promise<VerificationResult> {
  const maxRetries = template.id === 'nextjs-app' ? 4 : 3  // Next.js needs an extra retry for SSR builds
  let lastResult: VerificationResult | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info('[Verification] Attempt', { attempt, maxRetries })

    const result = await verifyProject(workspacePath, template.verificationCommands, onProgress)

    if (result.passed) {
      logger.info('[Verification] Passed on attempt', { attempt })
      return result
    }

    lastResult = result

    if (attempt < maxRetries) {
      logger.warn('[Verification] Failed, attempting fix', {
        attempt,
        errors: result.errors.map(e => e.command),
      })

      // Inject fix: clean node_modules and reinstall
      try {
        const { rm } = await import('fs/promises')
        await rm(path.join(workspacePath, 'node_modules'), { recursive: true, force: true })
        await rm(path.join(workspacePath, 'package-lock.json'), { force: true }).catch(() => {})
        logger.info('[Verification] Cleaned node_modules for retry')
      } catch {
        // ignore cleanup failures
      }

      // Attempt auto-fix: run npm install --legacy-peer-deps as a fallback
      try {
        await execAsync('npm install --legacy-peer-deps', {
          cwd: workspacePath,
          timeout: 180_000,
        })
        logger.info('[Verification] Reinstalled dependencies with legacy peer deps')
      } catch {
        logger.warn('[Verification] npm install failed during auto-fix')
      }
    }
  }

  logger.error('[Verification] All retries exhausted', undefined, {
    finalErrors: lastResult?.errors.map(e => e.command),
  })
  return lastResult!
}

/**
 * Rollback: git reset --hard on repeated verification failure.
 */
export async function rollbackWorkspace(workspacePath: string): Promise<void> {
  logger.warn('[Verification] Rolling back workspace', { workspacePath })
  await execAsync('git reset --hard HEAD~1', { cwd: workspacePath })
  await execAsync('git clean -fd', { cwd: workspacePath })
}

/**
 * Snapshot: git commit on successful verification.
 */
export async function snapshotWorkspace(workspacePath: string, tag: string): Promise<void> {
  await execAsync('git add -A', { cwd: workspacePath })
  await execAsync(
    `git -c user.name="AgentHive" -c user.email="bot@agenthive.dev" commit -m "verify: ${tag} passed" --no-gpg-sign`,
    { cwd: workspacePath }
  )
  logger.info('[Verification] Snapshot created', { workspacePath, tag })
}
```

---

## 8. Incremental Modification Engine

### 8.1 Modification Context

**New file**: `apps/api/src/pipeline/modificationEngine.ts`

```typescript
import path from 'path'
import { readFile, writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { AppTemplate, DesignScheme } from './types.js'
import { getLLMService } from '../services/llm.js'
import logger from '../utils/logger.js'
import type { LLMMessage } from '../services/llm.js'

const execAsync = promisify(exec)

/**
 * Context for an incremental modification to an existing generated app.
 */
export interface ModificationContext {
  /** Project ID (for AGENTHIVE.json lookup) */
  projectId: string
  /** Local filesystem path to the workspace */
  workspacePath: string
  /** The parsed AGENTHIVE.json */
  config: {
    templateId: string
    designSchemeId: string
    variables: Record<string, string>
  }
  /** The user's modification request */
  userInput: string
  /** Session ID for WebSocket progress broadcasting */
  sessionId: string
}

/**
 * Analyze which files are affected by a modification request.
 * Uses git diff to find changes and LLM to identify which files need modification.
 */
export async function analyzeAffectedFiles(ctx: ModificationContext): Promise<string[]> {
  const llmService = getLLMService()

  // Get current file listing (relative paths only, exclude node_modules/.git)
  const { stdout: fileList } = await execAsync(
    'git ls-files --cached --others --exclude-standard',
    { cwd: ctx.workspacePath }
  )
  const allFiles = fileList.trim().split('\n').filter(f => f.length > 0)

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个代码修改分析器。用户的改动请求可能影响多个文件。请列出所有需要修改的文件路径（每行一个），只输出文件路径，不要解释。

项目文件列表:
${allFiles.map(f => `- ${f}`).join('\n')}`
    },
    { role: 'user', content: ctx.userInput },
  ]

  const result = await llmService.complete(messages, {
    temperature: 0.1,
    maxTokens: 500,
    timeoutMs: 10000,
  })

  const files = result.content
    .trim()
    .split('\n')
    .map(f => f.trim())
    .filter(f => allFiles.includes(f))

  logger.info('[ModificationEngine] Affected files analysis', {
    projectId: ctx.projectId,
    totalFiles: allFiles.length,
    affectedCount: files.length,
  })

  return files
}

/**
 * Diff-only strategy: generate and apply modifications to specific files.
 * Integrates with the existing modify_app intent from the ChatPanel.
 *
 * This approach:
 * - Only transmits changed files (not the entire project)
 * - Leverages git for diff generation and application
 * - Supports the existing ChatPanel modify workflow
 */
export async function applyIncrementalModification(
  ctx: ModificationContext,
  affectedFiles: string[]
): Promise<{ changedFiles: string[]; diff: string }> {
  const llmService = getLLMService()

  // Read current content of all affected files
  const fileContents: Record<string, string> = {}
  for (const file of affectedFiles) {
    const fullPath = path.join(ctx.workspacePath, file)
    try {
      fileContents[file] = await readFile(fullPath, 'utf-8')
    } catch {
      fileContents[file] = ''
    }
  }

  // Build LLM prompt with file contents
  const filesSection = Object.entries(fileContents)
    .map(([file, content]) => `### ${file}\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\``)
    .join('\n\n')

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个精确的代码修改器。对于每个需要修改的文件，输出完整的修改后内容。使用以下格式：

<file path="src/App.tsx">
...完整的新内容...
</file>

<file path="src/lib/supabase.ts">
...完整的新内容...
</file>

要求:
- 只输出需要修改的文件（在 <file> 块中）
- 每个文件输出完整内容，不是 diff
- 保持现有代码结构和风格
- 不要修改 package.json 或配置文件`
    },
    { role: 'user', content: `修改需求: ${ctx.userInput}\n\n当前文件:\n${filesSection}` },
  ]

  const result = await llmService.complete(messages, {
    temperature: 0.3,
    maxTokens: 4096,
    timeoutMs: 30000,
  })

  // Parse <file path="..."> blocks
  const fileRegex = /<file path="([^"]+)">\s*([\s\S]*?)\s*<\/file>/g
  const changedFiles: string[] = []
  let match: RegExpExecArray | null

  while ((match = fileRegex.exec(result.content)) !== null) {
    const [, filePath, newContent] = match

    if (!affectedFiles.includes(filePath)) {
      logger.warn('[ModificationEngine] LLM returned file not in affected list', { file: filePath })
      continue
    }

    const absolutePath = path.join(ctx.workspacePath, filePath)
    await writeFile(absolutePath, newContent.trim(), 'utf-8')
    changedFiles.push(filePath)
  }

  // Generate git diff for the changes
  const { stdout: diff } = await execAsync('git diff', { cwd: ctx.workspacePath })

  // Auto-commit the changes
  if (changedFiles.length > 0) {
    await execAsync('git add -A', { cwd: ctx.workspacePath })
    await execAsync(
      `git -c user.name="AgentHive" -c user.email="bot@agenthive.dev" commit -m "modify: ${ctx.userInput.substring(0, 72)}" --no-gpg-sign`,
      { cwd: ctx.workspacePath }
    )
  }

  logger.info('[ModificationEngine] Incremental modification applied', {
    projectId: ctx.projectId,
    changedFiles: changedFiles.length,
    diffSize: diff.length,
  })

  return { changedFiles, diff }
}

/**
 * Main entry point for modify_app intent.
 */
export async function executeModification(ctx: ModificationContext): Promise<{
  affectedFiles: string[]
  changedFiles: string[]
  diff: string
}> {
  logger.info('[ModificationEngine] Starting incremental modification', {
    projectId: ctx.projectId,
    input: ctx.userInput.substring(0, 100),
  })

  const affectedFiles = await analyzeAffectedFiles(ctx)

  if (affectedFiles.length === 0) {
    logger.warn('[ModificationEngine] No files identified for modification')
    return { affectedFiles: [], changedFiles: [], diff: '' }
  }

  const { changedFiles, diff } = await applyIncrementalModification(ctx, affectedFiles)

  return { affectedFiles, changedFiles, diff }
}
```

---

## 9. File Manifest

### 9.1 New Files (12 total)

| # | File Path | Purpose | Lines (est.) |
|---|-----------|---------|-------------|
| 1 | `apps/api/src/pipeline/types.ts` | AppTemplate, DesignScheme, DesignTokens, TemplateVariable, GenerationTicket interfaces | ~120 |
| 2 | `apps/api/src/pipeline/intentRouter.ts` | IntentRoute map, isAppPipelineIntent() | ~60 |
| 3 | `apps/api/src/pipeline/templateMatcher.ts` | Two-phase template selection (keyword + LLM) | ~100 |
| 4 | `apps/api/src/pipeline/designSchemeStore.ts` | 12 DesignScheme presets with generateTailwindConfig/generateCSSVariables | ~350 |
| 5 | `apps/api/src/pipeline/workspaceInit.ts` | initWorkspace(), replaceVariables(), injectDesignScheme() | ~180 |
| 6 | `apps/api/src/pipeline/ticketGenerator.ts` | generateAppTickets(), TicketYaml, ticketToYaml() | ~150 |
| 7 | `apps/api/src/pipeline/verification.ts` | verifyProject(), verifyWithRetry(), rollbackWorkspace(), snapshotWorkspace() | ~160 |
| 8 | `apps/api/src/pipeline/modificationEngine.ts` | ModificationContext, analyzeAffectedFiles(), applyIncrementalModification(), executeModification() | ~160 |
| 9 | `apps/api/src/pipeline/templates/react-vite/TEMPLATE.json` | React+Vite template metadata | ~25 |
| 10 | `apps/api/src/pipeline/templates/vue-vite/TEMPLATE.json` | Vue 3+Vite template metadata | ~25 |
| 11 | `apps/api/src/pipeline/templates/nextjs-app/TEMPLATE.json` | Next.js 14 template metadata | ~25 |
| 12 | `apps/api/src/pipeline/templates/landing-page/TEMPLATE.json` | Landing page template metadata | ~25 |

Plus additional TEMPLATE.json for `dashboard` (13th).

### 9.2 Modified Files (12 total)

| # | File Path | Change Description |
|---|-----------|-------------------|
| 1 | `apps/api/src/chat-controller/types.ts:5-13` | Add `generate_app`, `modify_app`, `deploy_app`, `export_app` to `ChatIntent` union |
| 2 | `apps/api/src/chat-controller/types.ts:17` | Add `'template'` to `SessionType` (already there at line 17: `'default' \| 'review' \| 'debug' \| 'template'`) |
| 3 | `apps/api/src/chat-controller/service.ts:31-53` | Replace `INTENT_CLASSIFICATION_PROMPT` with enhanced version including app generation examples |
| 4 | `apps/api/src/chat-controller/service.ts:297-331` | Add `isAppPipelineIntent()` branch in `executeAgentTask()` |
| 5 | `apps/api/src/chat-controller/service.ts:756-821` | Extend `createTicketsForIntent()` with cases for new intents |
| 6 | `apps/api/src/chat-controller/service.ts:661-713` | Extend `buildReplySystemPrompt()` to mention app generation capabilities |
| 7 | `apps/api/src/services/taskExecution.ts:22-30` | Add `type: 'generate_app' \| 'modify_app' \| 'deploy_app' \| 'export_app'` to `TaskInfo.type` |
| 8 | `apps/api/src/services/taskExecution.ts:228-293` | Add `app_generation` and `app_modification` to `getSystemPrompt()` type-specific prompts |
| 9 | `apps/api/src/services/taskExecution.ts:399-404` | Extend `inferWorkerRole()` with `supabase_dev` role |
| 10 | `apps/api/src/websocket/hub.ts:330-376` | Add `broadcast.appPipeline` method for pipeline-specific events |
| 11 | `apps/api/src/config/workspace.ts:30-44` | Add `getAppGenerationPath()` alongside `getWorkspacePath()` and `getChatWorkspacePath()` |
| 12 | `AGENTS/orchestrator.ts:29-47` | Add `supabase_dev` to `Ticket.role` union |

### 9.3 Database Changes (2 migrations)

| # | Migration | Change Description |
|---|-----------|-------------------|
| 1 | `20260509000000_add-app-templates.sql` | New table `app_templates` (id, name, description, category, tech_stack JSONB, variables JSONB, source_path, recommended_schemes TEXT[], verification_commands TEXT[], preview_command TEXT, preview_port INTEGER) |
| 2 | `20260509000001_add-design-schemes.sql` | New table `design_schemes` (id, name, description, tokens JSONB) |

---

## 10. Integration Flow — End-to-End Example

```
User: "帮我做一个待办事项应用，用蓝色主题"

1. classifyIntent("帮我做一个待办事项应用，用蓝色主题")
   → { intent: 'generate_app', confidence: 0.9 }
   [apps/api/src/chat-controller/service.ts:271-293]

2. selectTemplate("帮我做一个待办事项应用，用蓝色主题")
   → Phase 1 keyword "todo" matches → react-vite template
   [apps/api/src/pipeline/templateMatcher.ts]

3. getDesignScheme('professional-blue')  // "蓝色主题" → keyword match
   [apps/api/src/pipeline/designSchemeStore.ts]

4. initWorkspace(projectId, userId, template, scheme, variables)
   → Copy react-vite template → replace {{PROJECT_NAME}} etc.
   → Inject CSS variables + Tailwind preset
   → git init → write AGENTHIVE.json
   [apps/api/src/pipeline/workspaceInit.ts]

5. generateAppTickets(projectId, workspacePath, template, scheme, userInput, variables)
   → Ticket 1 (FE): 创建待办事项UI
   → Ticket 2 (SB): 设置 Supabase todos 表
   → Ticket 3 (QA): 审查验证
   [apps/api/src/pipeline/ticketGenerator.ts]

6. Execute tickets via TaskExecutionService
   → LLM streaming via apps/api/src/services/taskExecution.ts:143-225
   → Progress broadcast via apps/api/src/chat-controller/websocket.ts:86-108
   → Billing via apps/api/src/services/taskExecution.ts:351-397

7. verifyWithRetry(workspacePath, template)
   → npm install → npm run build → npm run type-check
   → On failure: retry up to 3× with auto-fix (clean node_modules, reinstall)
   → On success: git commit snapshot
   → On 3× failure: git reset --hard rollback
   [apps/api/src/pipeline/verification.ts]

8. Preview
   → Start dev server per template.previewCommand
   → Expose via template.previewPort (e.g. 5173)
   → Record in project_deployments table
```

---

## 11. Design Decisions

| Decision | Rationale | Reference |
|----------|-----------|-----------|
| NO backend ticket for app generation | Templates are full-stack with Supabase client built-in; backend is database schema (Supabase migration), not a separate Node.js service | `CLAUDE.md` line 2: "Node.js 不做事务性业务" |
| Two-phase template selection | Phase 1 (keyword) is free and fast; Phase 2 (LLM) is fallback. Avoids LLM cost for obvious cases | Existing pattern: `chatService.classifyIntent()` has `temperature: 0.1` for classification |
| Template sourcePath is local, not remote | Templates ship with the API server; copied via `fs/promises.cp()`. No git clone needed at generation time | Existing pattern: `scripts/archive/init-workspace.js:33-52` (copy source) |
| DesignScheme stored as code, not DB | 12 presets with embedded generator functions. Fast, no DB round-trip, trivially extensible | Simplicity over dynamic configuration |
| Verification uses `npm install` + `npm run build` | The universal bar. Any template that can't do this is broken. | Matches `AGENTS/AGENT_COLLABORATION_SPEC.md` verification standards |
| Diff-only modification (not full rebuild) | Saves tokens and time. Only affected files are read + rewritten | Key optimization for modify_app flow |
| 3-retry auto-fix loop | Matches existing orchestrator pattern (`AGENTS/orchestrator.ts:333`); proven effective | Existing orchestrator behavior |
| Rollback via git reset | Simpler than filesystem snapshots. Works on any OS. Leverages git init in workspaceInit | `AGENTS/orchestrator.ts:319`: `initStagingBranch()` |
