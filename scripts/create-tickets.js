const fs = require('fs');

const tickets = [];

// Epic 1: Infrastructure (1-10)
tickets.push(
  {id:'T001',role:'backend_dev',task:'Create shared UI package structure at packages/ui/ with build config',context:{relevant_files:['packages/ui/package.json','packages/ui/tsconfig.json','packages/ui/vite.config.ts'],constraints:['Use TypeScript','Export both components and composables']}},
  {id:'T002',role:'frontend_dev',task:'Migrate design tokens from landing tailwind config to packages/ui/styles',context:{relevant_files:['apps/landing/tailwind.config.js','packages/ui/src/styles/tokens.css','packages/ui/src/styles/variables.ts'],constraints:['Keep Tailwind compatibility','Export as CSS variables']}},
  {id:'T003',role:'frontend_dev',task:'Create ShibaAvatar shared component in packages/ui',context:{relevant_files:['apps/web/src/components/agent/AgentAvatar.vue','packages/ui/src/components/ShibaAvatar.vue'],constraints:['Framework agnostic props','Support Vue 3 only']}},
  {id:'T004',role:'frontend_dev',task:'Create unified AppHeader supporting landing, studio and app modes',context:{relevant_files:['apps/landing/components/AppHeader.vue','packages/ui/src/components/AppHeader.vue'],constraints:['Accept mode prop','Responsive']}},
  {id:'T005',role:'frontend_dev',task:'Create FeatureGate and LockedPanel components',context:{relevant_files:['packages/ui/src/components/FeatureGate.vue','packages/ui/src/components/LockedPanel.vue'],constraints:['Accept tier and feature props','Smooth animation']}},
  {id:'T006',role:'backend_dev',task:'Create shared type definitions package packages/types/',context:{relevant_files:['packages/types/package.json','packages/types/src/index.ts','packages/types/src/agent.ts'],constraints:['No framework dependencies']}},
  {id:'T007',role:'backend_dev',task:'Create shared API client composables useApi and useAuth',context:{relevant_files:['packages/ui/src/composables/useApi.ts','packages/ui/src/composables/useAuth.ts'],constraints:['Handle visitor mode','Axios interceptors']}},
  {id:'T008',role:'backend_dev',task:'Set up workspace linking for packages/ui and packages/types',context:{relevant_files:['pnpm-workspace.yaml','package.json','apps/landing/package.json'],constraints:['Keep builds working']}},
  {id:'T009',role:'frontend_dev',task:'Create visitor session composable useVisitorSession',context:{relevant_files:['packages/ui/src/composables/useVisitorSession.ts'],constraints:['localStorage persistence','Sync on login']}},
  {id:'T010',role:'frontend_dev',task:'Create unified error boundary and toast system',context:{relevant_files:['packages/ui/src/components/ErrorBoundary.vue','packages/ui/src/composables/useToast.ts'],constraints:['Nuxt and Vue compatible']}}
);

// Epic 2: Studio Core (11-22)
tickets.push(
  {id:'T011',role:'frontend_dev',task:'Refactor landing/pages/studio.vue into core Studio canvas layout',context:{relevant_files:['apps/landing/pages/studio.vue','apps/landing/components/StudioCanvas.vue'],constraints:['Large central canvas','Keep Tailwind']}},
  {id:'T012',role:'frontend_dev',task:'Create bottom Agent Dock component for Studio',context:{relevant_files:['packages/ui/src/components/AgentDock.vue','apps/landing/pages/studio.vue'],constraints:['Show 4 shiba members','Expandable']}},
  {id:'T013',role:'frontend_dev',task:'Create left collapsible toolbox panel',context:{relevant_files:['packages/ui/src/components/StudioToolbox.vue'],constraints:['Icons for tools','Collapsed on mobile']}},
  {id:'T014',role:'frontend_dev',task:'Create right drawer system for panels',context:{relevant_files:['packages/ui/src/components/StudioDrawer.vue'],constraints:['Slide animation','Multi-tab']}},
  {id:'T015',role:'frontend_dev',task:'Integrate ExecutionBoard into Studio bottom panel',context:{relevant_files:['apps/web/src/components/execution/ExecutionBoard.vue','packages/ui/src/components/StudioExecutionPanel.vue'],constraints:['Demo plan for visitors','Real when auth']}},
  {id:'T016',role:'frontend_dev',task:'Create login transition overlay and auth intercept',context:{relevant_files:['packages/ui/src/components/LoginOverlay.vue','packages/ui/src/composables/useAuthGate.ts'],constraints:['Blur background','Preserve state']}},
  {id:'T017',role:'frontend_dev',task:'Implement responsive Studio layout',context:{relevant_files:['apps/landing/pages/studio.vue','packages/ui/src/components/StudioLayout.vue'],constraints:['Mobile stacked','Desktop canvas+dock']}},
  {id:'T018',role:'frontend_dev',task:'Add requirement prompt input to Studio canvas center',context:{relevant_files:['apps/landing/pages/studio.vue','packages/ui/src/components/PromptInput.vue'],constraints:['Auto-resize','Demo animation']}},
  {id:'T019',role:'frontend_dev',task:'Migrate PropertyPanel to shared package',context:{relevant_files:['apps/landing/components/PropertyPanel.vue','packages/ui/src/components/PropertyPanel.vue'],constraints:['Props-based customization']}},
  {id:'T020',role:'frontend_dev',task:'Migrate ColorSchemePicker to shared package',context:{relevant_files:['apps/landing/components/ColorSchemePicker.vue','packages/ui/src/components/ColorSchemePicker.vue'],constraints:['Emit events']}},
  {id:'T021',role:'frontend_dev',task:'Migrate RequirementWizard to shared package',context:{relevant_files:['apps/landing/components/RequirementWizard.vue','packages/ui/src/components/RequirementWizard.vue'],constraints:['Step form','Export data']}},
  {id:'T022',role:'frontend_dev',task:'Unify landing layouts for Studio full-screen',context:{relevant_files:['apps/landing/layouts/default.vue','apps/landing/layouts/studio.vue'],constraints:['Remove footer in studio','Keep header']}}
);

// Epic 3: Web Migration (23-42)
tickets.push(
  {id:'T023',role:'frontend_dev',task:'Migrate Workspace view logic to landing Studio',context:{relevant_files:['apps/web/src/views/Workspace.vue','apps/landing/pages/studio.vue'],constraints:['Merge Overview+Studio','Use shared']}},
  {id:'T024',role:'frontend_dev',task:'Migrate Dashboard to landing pages/app/dashboard.vue',context:{relevant_files:['apps/web/src/views/Dashboard.vue','apps/landing/pages/app/dashboard.vue'],constraints:['Use shared AppHeader','Tailwind style']}},
  {id:'T025',role:'frontend_dev',task:'Migrate AgentDetail to landing pages/app/agents/[id].vue',context:{relevant_files:['apps/web/src/views/AgentDetail.vue','apps/landing/pages/app/agents/[id].vue'],constraints:['Nuxt dynamic route','Preserve func']}},
  {id:'T026',role:'frontend_dev',task:'Migrate TaskBoard to landing pages/app/tasks.vue',context:{relevant_files:['apps/web/src/views/TaskBoard.vue','apps/landing/pages/app/tasks.vue'],constraints:['Shared UI','Responsive']}},
  {id:'T027',role:'frontend_dev',task:'Migrate SprintBoard to landing pages/app/sprints.vue',context:{relevant_files:['apps/web/src/views/SprintBoard.vue','apps/landing/pages/app/sprints.vue'],constraints:['Keep calendar']}},
  {id:'T028',role:'frontend_dev',task:'Migrate CodeViewer to shared component',context:{relevant_files:['apps/web/src/views/CodeViewer.vue','packages/ui/src/components/CodeViewer.vue'],constraints:['Monaco lazy load']}},
  {id:'T029',role:'frontend_dev',task:'Migrate TerminalView to shared component',context:{relevant_files:['apps/web/src/views/TerminalView.vue','packages/ui/src/components/TerminalView.vue'],constraints:['Xterm','Readonly visitor']}},
  {id:'T030',role:'frontend_dev',task:'Migrate ChatView to shared component',context:{relevant_files:['apps/web/src/views/ChatView.vue','packages/ui/src/components/ChatView.vue'],constraints:['Socket.io','Demo messages']}},
  {id:'T031',role:'frontend_dev',task:'Migrate execution store to packages/ui/stores',context:{relevant_files:['apps/web/src/stores/execution.ts','packages/ui/src/stores/execution.ts'],constraints:['Pinia','Visitor mode']}},
  {id:'T032',role:'frontend_dev',task:'Migrate websocket store to packages/ui/stores',context:{relevant_files:['apps/web/src/stores/websocket.ts','packages/ui/src/stores/websocket.ts'],constraints:['Offline fallback']}},
  {id:'T033',role:'frontend_dev',task:'Migrate messageHub store to packages/ui/stores',context:{relevant_files:['apps/web/src/stores/messageHub.ts','packages/ui/src/stores/messageHub.ts'],constraints:['Event bus']}},
  {id:'T034',role:'frontend_dev',task:'Migrate execution types and demo utils',context:{relevant_files:['apps/web/src/types/execution.ts','packages/types/src/execution.ts','apps/web/src/utils/execution-demo.ts'],constraints:['Framework agnostic']}},
  {id:'T035',role:'frontend_dev',task:'Migrate remaining web agent components to packages/ui',context:{relevant_files:['apps/web/src/components/agent/*.vue','packages/ui/src/components/agent/*.vue'],constraints:['Batch migration']}},
  {id:'T036',role:'frontend_dev',task:'Update landing nuxt.config for shared packages',context:{relevant_files:['apps/landing/nuxt.config.ts','apps/landing/package.json'],constraints:['Auto-import shared']}},
  {id:'T037',role:'frontend_dev',task:'Create landing pages/app/index.vue redirect',context:{relevant_files:['apps/landing/pages/app/index.vue'],constraints:['Redirect to dashboard']}},
  {id:'T038',role:'frontend_dev',task:'Adapt Element Plus overrides for Tailwind/Nuxt',context:{relevant_files:['apps/landing/assets/css/element-plus-override.css'],constraints:['Minimal global']}},
  {id:'T039',role:'frontend_dev',task:'Migrate Login.vue to landing pages/login.vue',context:{relevant_files:['apps/web/src/views/Login.vue','apps/landing/pages/login.vue'],constraints:['Preserve validation']}},
  {id:'T040',role:'frontend_dev',task:'Migrate Settings to landing pages/app/settings.vue',context:{relevant_files:['apps/web/src/views/Settings.vue','apps/landing/pages/app/settings.vue'],constraints:['Shared form comps']}},
  {id:'T041',role:'frontend_dev',task:'Update all web routes to Nuxt file-based routing',context:{relevant_files:['apps/web/src/router/index.ts','apps/landing/pages/**/*.vue'],constraints:['Map all old routes']}},
  {id:'T042',role:'frontend_dev',task:'Create NotFound in landing and remove web version',context:{relevant_files:['apps/landing/pages/[...slug].vue','apps/web/src/views/NotFound.vue'],constraints:['Consistent design']}}
);

// Epic 4: Backend (43-48)
tickets.push(
  {id:'T043',role:'backend_dev',task:'Update API for visitor mode session cookies',context:{relevant_files:['apps/api/src/routes/auth.ts','apps/api/src/middleware/visitor.ts'],constraints:['Rate limit','No PII']}},
  {id:'T044',role:'backend_dev',task:'Create demo data endpoints for studio preview',context:{relevant_files:['apps/api/src/routes/demo.ts'],constraints:['Static realistic data']}},
  {id:'T045',role:'backend_dev',task:'Update WebSocket for visitor read-only rooms',context:{relevant_files:['apps/api/src/websocket/hub.ts'],constraints:['Read-only broadcast','Timeout']}},
  {id:'T046',role:'backend_dev',task:'Create project migration API visitor-to-user',context:{relevant_files:['apps/api/src/routes/projects.ts'],constraints:['Accept localStorage snapshot']}},
  {id:'T047',role:'backend_dev',task:'Update auth middleware for unified routes',context:{relevant_files:['apps/api/src/middleware/auth.ts'],constraints:['Allow /demo/*']}},
  {id:'T048',role:'backend_dev',task:'Add CORS and security headers for unified domain',context:{relevant_files:['apps/api/src/app.ts','apps/api/src/config/cors.ts'],constraints:['Single origin','CSRF']}}
);

// Epic 5: Testing & Docs (49-55)
tickets.push(
  {id:'T049',role:'qa_engineer',task:'Write e2e tests for visitor-to-login flow',context:{relevant_files:['apps/landing/e2e/studio-auth.spec.ts'],constraints:['Test demo animation','Test persistence']}},
  {id:'T050',role:'frontend_dev',task:'Implement lazy loading for Studio heavy components',context:{relevant_files:['apps/landing/pages/studio.vue','packages/ui/src/components/CodeViewer.vue'],constraints:['Dynamic imports']}},
  {id:'T051',role:'frontend_dev',task:'Optimize SEO meta tags for all pages',context:{relevant_files:['apps/landing/pages/**/*.vue'],constraints:['useSeoMeta']}},
  {id:'T052',role:'frontend_dev',task:'Mobile responsiveness audit for Studio',context:{relevant_files:['apps/landing/pages/studio.vue','packages/ui/src/components/StudioLayout.vue'],constraints:['Touch friendly']}},
  {id:'T053',role:'frontend_dev',task:'Add error boundaries and API fallback UI',context:{relevant_files:['apps/landing/plugins/error-handler.ts'],constraints:['Fallback UI','Retry']}},
  {id:'T054',role:'backend_dev',task:'Update AGENTS.md for unified architecture',context:{relevant_files:['agents/AGENTS.md','docs/ARCHITECTURE.md'],constraints:['Reflect routing']}},
  {id:'T055',role:'qa_engineer',task:'Final regression QA type-check unit e2e manual',context:{relevant_files:['apps/landing/','packages/ui/'],constraints:['0 type errors','All tests pass']}}
);

for (const t of tickets) {
  fs.writeFileSync('agents/workspace/' + t.id + '.json', JSON.stringify(t, null, 2));
}
console.log('Created ' + tickets.length + ' tickets');
