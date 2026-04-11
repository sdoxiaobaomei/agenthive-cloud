const fs = require('fs');
const path = require('path');

const UI = 'packages/ui/src/components';

const moves = [
  // atoms
  { from: 'ShibaAvatar.vue', to: 'atoms/ShibaAvatar.vue' },
  { from: 'agent/AgentAvatar.vue', to: 'atoms/AgentAvatar.vue' },
  // molecules
  { from: 'agent/AgentCard.vue', to: 'molecules/AgentCard.vue' },
  { from: 'agent/AgentWorkflowCard.vue', to: 'molecules/AgentWorkflowCard.vue' },
  { from: 'code/CodeDiffViewer.vue', to: 'molecules/CodeDiffViewer.vue' },
  { from: 'code/CodeEditor.vue', to: 'molecules/CodeEditor.vue' },
  { from: 'execution/TicketCard.vue', to: 'molecules/TicketCard.vue' },
  // organisms
  { from: 'AgentDock.vue', to: 'organisms/AgentDock.vue' },
  { from: 'AppHeader.vue', to: 'organisms/AppHeader.vue' },
  { from: 'ChatView.vue', to: 'organisms/ChatView.vue' },
  { from: 'CodeViewer.vue', to: 'organisms/CodeViewer.vue' },
  { from: 'TerminalView.vue', to: 'organisms/TerminalView.vue' },
  { from: 'LoginOverlay.vue', to: 'organisms/LoginOverlay.vue' },
  { from: 'PromptInput.vue', to: 'organisms/PromptInput.vue' },
  { from: 'PropertyPanel.vue', to: 'organisms/PropertyPanel.vue' },
  { from: 'RequirementWizard.vue', to: 'organisms/RequirementWizard.vue' },
  { from: 'agent/AgentList.vue', to: 'organisms/AgentList.vue' },
  { from: 'agent/AgentPanel.vue', to: 'organisms/AgentPanel.vue' },
  { from: 'agent/ArtifactViewer.vue', to: 'organisms/ArtifactViewer.vue' },
  { from: 'agent/CreateAgentDialog.vue', to: 'organisms/CreateAgentDialog.vue' },
  { from: 'agent/TaskList.vue', to: 'organisms/TaskList.vue' },
  { from: 'execution/ExecutionBoard.vue', to: 'organisms/ExecutionBoard.vue' },
  { from: 'execution/TicketDetailPanel.vue', to: 'organisms/TicketDetailPanel.vue' },
  { from: 'terminal/Terminal.vue', to: 'organisms/Terminal.vue' },
  // templates
  { from: 'StudioDrawer.vue', to: 'templates/StudioDrawer.vue' },
  { from: 'StudioLayout.vue', to: 'templates/StudioLayout.vue' },
  { from: 'StudioToolbox.vue', to: 'templates/StudioToolbox.vue' },
  // specials
  { from: 'AsyncCodeViewer.vue', to: 'specials/AsyncCodeViewer.vue' },
  { from: 'ColorSchemePicker.vue', to: 'specials/ColorSchemePicker.vue' },
  { from: 'ErrorBoundary.vue', to: 'specials/ErrorBoundary.vue' },
  { from: 'FeatureGate.vue', to: 'specials/FeatureGate.vue' },
  { from: 'LockedPanel.vue', to: 'specials/LockedPanel.vue' },
];

const dirs = new Set(moves.map(m => path.dirname(path.join(UI, m.to))));
for (const d of dirs) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

for (const { from, to } of moves) {
  const src = path.join(UI, from);
  const dst = path.join(UI, to);
  if (!fs.existsSync(src)) {
    console.log('SKIP (missing):', from);
    continue;
  }
  fs.renameSync(src, dst);
  console.log('MOVED:', from, '->', to);
}

// Remove empty directories
['agent', 'code', 'execution', 'terminal'].forEach(d => {
  const p = path.join(UI, d);
  if (fs.existsSync(p) && fs.readdirSync(p).length === 0) {
    fs.rmdirSync(p);
    console.log('RMDIR:', d);
  }
});

// Fix relative imports inside moved files
const importFixes = [
  // organisms
  { file: 'organisms/AppHeader.vue', replacements: [{ old: "from './ShibaAvatar.vue'", new: "from '../atoms/ShibaAvatar.vue'" }] },
  { file: 'organisms/AgentDock.vue', replacements: [{ old: "from './ShibaAvatar.vue'", new: "from '../atoms/ShibaAvatar.vue'" }] },
  { file: 'organisms/ChatView.vue', replacements: [{ old: "from './agent/AgentAvatar.vue'", new: "from '../atoms/AgentAvatar.vue'" }] },
  { file: 'organisms/CodeViewer.vue', replacements: [
    { old: "from './code/CodeEditor.vue'", new: "from '../molecules/CodeEditor.vue'" },
    { old: "from './code/CodeDiffViewer.vue'", new: "from '../molecules/CodeDiffViewer.vue'" }
  ]},
  { file: 'organisms/TerminalView.vue', replacements: [{ old: "from './terminal/Terminal.vue'", new: "from '../organisms/Terminal.vue'" }] },
  // molecules
  { file: 'molecules/AgentCard.vue', replacements: [{ old: "from './AgentAvatar.vue'", new: "from '../atoms/AgentAvatar.vue'" }] },
  { file: 'molecules/AgentWorkflowCard.vue', replacements: [{ old: "from './AgentAvatar.vue'", new: "from '../atoms/AgentAvatar.vue'" }] },
  // organisms from agent/
  { file: 'organisms/AgentPanel.vue', replacements: [{ old: "from './AgentAvatar.vue'", new: "from '../atoms/AgentAvatar.vue'" }] },
  { file: 'organisms/AgentList.vue', replacements: [{ old: "from './AgentCard.vue'", new: "from '../molecules/AgentCard.vue'" }] },
  // execution/
  { file: 'organisms/ExecutionBoard.vue', replacements: [{ old: "from './TicketCard.vue'", new: "from '../molecules/TicketCard.vue'" }] },
  { file: 'organisms/TicketDetailPanel.vue', replacements: [{ old: "from './TicketCard.vue'", new: "from '../molecules/TicketCard.vue'" }] },
];

for (const { file, replacements } of importFixes) {
  const p = path.join(UI, file);
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;
  for (const { old, new: n } of replacements) {
    if (content.includes(old)) {
      content = content.replace(old, n);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('FIXED IMPORTS:', file);
  }
}

console.log('\nDone. Next: update packages/ui/src/index.ts and landing components.');
