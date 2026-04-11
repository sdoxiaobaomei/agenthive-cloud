const fs = require('fs');
const path = require('path');

const UI = 'packages/ui/src/components';
const LANDING = 'apps/apps/landing/components';
const WEB = 'apps/apps/web/src/components';

const moves = [
  // landing -> organisms
  { from: 'AppFooter.vue', to: 'organisms/AppFooter.vue', src: LANDING },
  { from: 'CTASection.vue', to: 'organisms/CTASection.vue', src: LANDING },
  { from: 'FeaturesSection.vue', to: 'organisms/FeaturesSection.vue', src: LANDING },
  { from: 'HeroSection.vue', to: 'organisms/HeroSection.vue', src: LANDING },
  { from: 'StudioExecutionPanel.vue', to: 'organisms/StudioExecutionPanel.vue', src: LANDING },
  { from: 'WorkflowSection.vue', to: 'organisms/WorkflowSection.vue', src: LANDING },
  { from: 'MessageHub.vue', to: 'organisms/MessageHub.vue', src: LANDING },
  { from: 'AgentTracker.vue', to: 'organisms/AgentTracker.vue', src: LANDING },
  { from: 'ClientProgress.vue', to: 'organisms/ClientProgress.vue', src: LANDING },
  { from: 'DeployPipeline.vue', to: 'organisms/DeployPipeline.vue', src: LANDING },
  { from: 'FeatureDetail.vue', to: 'organisms/FeatureDetail.vue', src: LANDING },
  // landing -> molecules
  { from: 'DocCard.vue', to: 'molecules/DocCard.vue', src: LANDING },
  { from: 'FeatureCard.vue', to: 'molecules/FeatureCard.vue', src: LANDING },
  { from: 'PricingCard.vue', to: 'molecules/PricingCard.vue', src: LANDING },
  { from: 'WorkflowStep.vue', to: 'molecules/WorkflowStep.vue', src: LANDING },
  // web -> templates
  { from: 'layout/MainLayout.vue', to: 'templates/MainLayout.vue', src: WEB },
];

// Ensure dirs exist
const dirs = new Set(moves.map(m => path.dirname(path.join(UI, m.to))));
for (const d of dirs) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

for (const { from, to, src } of moves) {
  const s = path.join(src, from);
  const d = path.join(UI, to);
  if (!fs.existsSync(s)) {
    console.log('SKIP (missing):', s);
    continue;
  }
  fs.copyFileSync(s, d);
  console.log('COPIED:', from, '->', to);
}

// Move test files
const tests = [
  { from: 'AppHeader.spec.ts', to: 'tests/AppHeader.spec.ts', src: LANDING },
  { from: 'HeroSection.spec.ts', to: 'tests/HeroSection.spec.ts', src: LANDING },
];
const testDir = path.join(UI, 'tests');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
for (const { from, to, src } of tests) {
  const s = path.join(src, from);
  const d = path.join(UI, to);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log('COPIED TEST:', from, '->', to);
  }
}

// Delete duplicated components in landing
const toDelete = [
  'AppHeader.vue',
  'ColorSchemePicker.vue',
  'PropertyPanel.vue',
  'RequirementWizard.vue',
];
for (const f of toDelete) {
  const p = path.join(LANDING, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('DELETED (dup):', f);
  }
}

console.log('\nDone.');
