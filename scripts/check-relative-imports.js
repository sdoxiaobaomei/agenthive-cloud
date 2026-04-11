const fs = require('fs');
const files = [
  'packages/ui/src/components/AppHeader.vue',
  'packages/ui/src/components/ChatView.vue',
  'packages/ui/src/components/CodeViewer.vue',
  'packages/ui/src/components/TerminalView.vue',
  'packages/ui/src/components/AgentDock.vue',
  'packages/ui/src/components/agent/AgentCard.vue',
  'packages/ui/src/components/agent/AgentPanel.vue',
  'packages/ui/src/components/agent/AgentList.vue',
  'packages/ui/src/components/agent/CreateAgentDialog.vue',
  'packages/ui/src/components/agent/TaskList.vue',
];
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(/^import .* from ['"]\.[^'"]+['"]$/gm);
  if (m) {
    console.log('=== ' + f + ' ===');
    m.forEach(line => console.log(line));
  }
});
