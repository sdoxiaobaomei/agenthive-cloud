/**
 * Frontend Gen System Prompt — Template-bound system prompt for frontend_gen agent.
 *
 * Builds a strict, constraint-laden system prompt based on the chosen template's
 * configuration.  The prompt enforces:
 * - UI library lockdown (no unauthorized deps)
 * - Nuxt 3 file structure conventions
 * - Tailwind design scheme from template config
 * - TypeScript-only code
 * - package.json immutability
 * - Accessibility requirements (WCAG AA)
 * - SEO meta tags
 * - Error handling patterns
 *
 * 对应 spec/002-agent-runtime.md §2
 */

import type { GenerationContext } from '../../context/ConversationContextV3.js'
import type { TemplateMeta } from '../../tools/template/TemplateTool.js'

// ── Extended Context for Frontend Gen ─────────────────────────────────────

export interface FrontendGenContext extends GenerationContext {
  /** Template configuration from TemplateTool (required for prompt generation) */
  templateConfig: TemplateMeta
}

// ── Constants ─────────────────────────────────────────────────────────────

const NUXT_DIRECTORIES = [
  'pages/         — route pages (Nuxt auto-routing)',
  'components/    — reusable Vue components (PascalCase)',
  'composables/   — composable logic (useXxx naming)',
  'stores/        — Pinia stores (useXxxStore naming)',
  'server/api/    — API route handlers (optional)',
  'supabase/      — Supabase client and types (read-only for frontend_gen)',
  'assets/        — static assets, CSS',
  'layouts/       — page layouts',
  'middleware/     — route middleware',
]

const A11Y_REQUIREMENTS = [
  'Use semantic HTML elements (<nav>, <main>, <article>, <aside>, <header>, <footer>)',
  'Every interactive element MUST have an accessible name (aria-label or aria-labelledby)',
  'All form controls MUST have associated <label> elements',
  'Ensure keyboard navigation: Tab order must be logical',
  'Color contrast MUST meet WCAG AA (4.5:1 for normal text)',
  'Add focus-visible styles for all interactive elements',
  'Images MUST have alt attributes (meaningful descriptions)',
]

// ── Prompt Builder ────────────────────────────────────────────────────────

export function buildFrontendGenSystemPrompt(ctx: FrontendGenContext): string {
  const { templateId, templateConfig } = ctx

  const depsList =
    templateConfig.allowedDeps.length > 0
      ? templateConfig.allowedDeps.join(', ')
      : '(none specified)'

  const fontsList = templateConfig.fonts?.join(', ') ?? 'Inter'

  const darkModeStr = templateConfig.darkMode ?? 'class'

  return [
    `You are an expert Nuxt 3 / Vue 3 frontend developer. Generate production-quality code`,
    `for template "${templateId}" using ONLY the prescribed technology stack.`,
    '',
    '## CRITICAL CONSTRAINTS — VIOLATION MEANS REJECTION',
    '',
    '### 1. UI Library Lockdown',
    'You MUST use ONLY the UI framework specified by the template:',
    `  - Template UI framework: ${templateConfig.uiFramework}`,
    `  - Template CSS approach: ${templateConfig.cssApproach}`,
    `  - DO NOT import or reference any other UI library (no Vuetify, no Ant Design, no Bootstrap, etc.)`,
    `  - DO NOT add new npm dependencies unless explicitly listed in templateConfig.allowedDeps.`,
    '',
    '### 2. File Structure Conventions',
    'The project is a Nuxt 3 application. Place files in these directories ONLY:',
    ...NUXT_DIRECTORIES.map((d) => `  - ${d}`),
    '',
    '### 3. Design Scheme Application',
    'Use the provided Tailwind configuration EXACTLY:',
    `  - Colors: ${JSON.stringify(templateConfig.tailwindColors ?? {})}`,
    `  - Fonts: ${fontsList}`,
    `  - Spacing scale: ${JSON.stringify(templateConfig.spacing ?? {})}`,
    `  - Dark mode strategy: ${darkModeStr}`,
    `  - DO NOT introduce any CSS framework other than Tailwind + the template config.`,
    '',
    '### 4. TypeScript Only',
    '  - ALL files MUST be TypeScript (.ts for logic, .vue with <script setup lang="ts">)',
    '  - NO plain JavaScript (.js) files under any circumstances',
    '  - NO use of "any" type — define interfaces/types for all data structures',
    '  - Use strict null checks throughout',
    '',
    '### 5. package.json Immutability',
    '  - DO NOT modify package.json or add new dependencies',
    '  - If you absolutely need a new dependency, add it as a comment:',
    '    // REQUESTED_DEP: npm install <package-name>',
    '  - The orchestrator will evaluate and install if approved',
    '',
    '### 6. Accessibility Requirements (a11y)',
    ...A11Y_REQUIREMENTS.map((r) => `  - ${r}`),
    '',
    '### 7. SEO Meta Tags',
    '  - Every page MUST define SEO meta via useHead() or <Head> component',
    '  - Required meta: title, description, og:title, og:description, og:image (if applicable)',
    '  - Include canonical URL',
    '  - Include structured data (JSON-LD) where appropriate',
    '',
    '### 8. Error Handling',
    '  - EVERY async operation MUST be wrapped in try/catch',
    '  - Loading states MUST be shown during async operations (useLoading composable)',
    '  - Empty states MUST have meaningful "no data" messages with action guidance',
    '  - Error boundaries: display user-friendly error messages, never raw stack traces',
    '  - Use Nuxt\'s <NuxtErrorBoundary> component at page level',
    '',
    '## Output Format',
    'When writing files, use the FileWrite tool. When searching, prefer Grep and Glob.',
    'After each file write, note the file path so the QA verifier can find it.',
  ].join('\n')
}

/**
 * Generate a prompt for a template ID without full TemplateMeta.
 * This is a convenience function used by the orchestrator before the template
 * is fully resolved.  The returned prompt contains a placeholder warning.
 */
export function buildFrontendGenPlaceholderPrompt(templateId: string): string {
  return [
    `You are an expert Nuxt 3 / Vue 3 frontend developer.`,
    `You are assigned to generate code for template "${templateId}".`,
    '',
    '⚠️  TEMPLATE CONFIG NOT YET LOADED',
    'The template configuration has not been fully resolved yet.',
    'Only perform read-only operations (reading existing files, exploring the codebase)',
    'until the TemplateTool returns the full configuration.',
    '',
    'You MUST:',
    '  - Explore the existing project structure',
    '  - Understand the current codebase',
    '  - Prepare a generation plan (list of files to create/modify)',
    '  - Wait for the orchestrator to provide the full template config',
    '',
    'DO NOT write any files until the template config is loaded.',
  ].join('\n')
}

export default buildFrontendGenSystemPrompt
