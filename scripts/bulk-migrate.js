const fs = require('fs');
const path = require('path');

function copyAndRewrite(src, dest, replacements) {
  if (!fs.existsSync(src)) {
    console.log('SKIP (not found):', src);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let content = fs.readFileSync(src, 'utf8');
  for (const [from, to] of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(dest, content);
  console.log('MIGRATED:', src, '->', dest);
}

// Epic 3: Web view migrations to landing
const migrations = [
  // T024 Dashboard
  {
    src: 'apps/apps/web/src/views/Dashboard.vue',
    dest: 'apps/apps/landing/pages/app/dashboard.vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
      [/@\/components\/layout\/MainLayout\.vue/g, '~/components/AppHeader.vue'],
      [/el-/g, 'El-'],
    ]
  },
  // T025 AgentDetail -> dynamic route
  {
    src: 'apps/apps/web/src/views/AgentDetail.vue',
    dest: 'apps/apps/landing/pages/app/agents/[id].vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
      [/@\/components\/agent\/AgentAvatar\.vue/g, '@agenthive/ui/components/ShibaAvatar.vue'],
    ]
  },
  // T026 TaskBoard
  {
    src: 'apps/apps/web/src/views/TaskBoard.vue',
    dest: 'apps/apps/landing/pages/app/tasks.vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
    ]
  },
  // T027 SprintBoard
  {
    src: 'apps/apps/web/src/views/SprintBoard.vue',
    dest: 'apps/apps/landing/pages/app/sprints.vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
    ]
  },
  // T039 Login
  {
    src: 'apps/apps/web/src/views/Login.vue',
    dest: 'apps/apps/landing/pages/login.vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
    ]
  },
  // T040 Settings
  {
    src: 'apps/apps/web/src/views/Settings.vue',
    dest: 'apps/apps/landing/pages/app/settings.vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
    ]
  },
  // T042 NotFound
  {
    src: 'apps/apps/web/src/views/NotFound.vue',
    dest: 'apps/apps/landing/pages/[...slug].vue',
    reps: [
      [/@\/types/g, '@agenthive/types'],
    ]
  },
];

for (const m of migrations) {
  copyAndRewrite(m.src, m.dest, m.reps);
}

// T037 app index redirect
fs.mkdirSync('apps/apps/landing/pages/app', { recursive: true });
fs.writeFileSync('apps/apps/landing/pages/app/index.vue', `<script setup>
navigateTo('/app/dashboard', { replace: true })
</script>
<template><div /></template>
`);
console.log('CREATED: app/index.vue');

// T041: create route mapping doc instead of actual routing (Nuxt uses file-based)
fs.mkdirSync('apps/apps/landing/middleware', { recursive: true });
fs.writeFileSync('apps/apps/landing/middleware/auth.global.ts', `export default defineNuxtRouteMiddleware((to) => {
  const publicPaths = ['/', '/features', '/pricing', '/docs', '/login', '/studio', '/about', '/blog']
  if (publicPaths.includes(to.path)) return
  if (to.path.startsWith('/app') && !to.path.startsWith('/app/dashboard')) {
    // Allow app routes
  }
})
`);
console.log('CREATED: middleware/auth.global.ts');

// T028-T030: migrate heavy views to packages/ui shared components
copyAndRewrite(
  'apps/apps/web/src/views/CodeViewer.vue',
  'packages/ui/src/components/CodeViewer.vue',
  [[/@\/types/g, '@agenthive/types']]
);
copyAndRewrite(
  'apps/apps/web/src/views/TerminalView.vue',
  'packages/ui/src/components/TerminalView.vue',
  [[/@\/types/g, '@agenthive/types']]
);
copyAndRewrite(
  'apps/apps/web/src/views/ChatView.vue',
  'packages/ui/src/components/ChatView.vue',
  [[/@\/types/g, '@agenthive/types']]
);

// T031-T033: migrate stores
copyAndRewrite(
  'apps/apps/web/src/stores/execution.ts',
  'packages/ui/src/stores/execution.ts',
  [[/@\/types\/execution/g, '@agenthive/types']]
);
copyAndRewrite(
  'apps/apps/web/src/stores/websocket.ts',
  'packages/ui/src/stores/websocket.ts',
  [[/@\/types/g, '@agenthive/types']]
);
copyAndRewrite(
  'apps/apps/web/src/stores/messageHub.ts',
  'packages/ui/src/stores/messageHub.ts',
  [[/@\/types/g, '@agenthive/types']]
);

// T034: types and demo utils
copyAndRewrite(
  'apps/apps/web/src/types/execution.ts',
  'packages/types/src/execution.ts',
  []
);
copyAndRewrite(
  'apps/apps/web/src/utils/execution-demo.ts',
  'packages/ui/src/utils/execution-demo.ts',
  [[/@\/types\/execution/g, '@agenthive/types']]
);

// T035: agent components migration
fs.mkdirSync('packages/ui/src/components/agent', { recursive: true });
const agentComps = fs.readdirSync('apps/apps/web/src/components/agent');
for (const f of agentComps) {
  copyAndRewrite(
    `apps/apps/web/src/components/agent/${f}`,
    `packages/ui/src/components/agent/${f}`,
    [[/@\/types/g, '@agenthive/types'], [/@\/components\/agent\//g, './']]
  );
}

console.log('Bulk migration complete');
