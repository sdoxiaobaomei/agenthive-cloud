const fs = require('fs');
const path = require('path');
const LANDING = 'apps/landing/components';

const toDelete = [
  'AgentTracker.vue',
  'AppFooter.vue',
  'AppHeader.spec.ts',
  'ClientProgress.vue',
  'CTASection.vue',
  'DeployPipeline.vue',
  'DocCard.vue',
  'FeatureCard.vue',
  'FeatureDetail.vue',
  'FeaturesSection.vue',
  'HeroSection.spec.ts',
  'HeroSection.vue',
  'MessageHub.vue',
  'PricingCard.vue',
  'StudioExecutionPanel.vue',
  'WorkflowSection.vue',
  'WorkflowStep.vue',
];

for (const f of toDelete) {
  const p = path.join(LANDING, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('DELETED:', f);
  } else {
    console.log('MISSING:', f);
  }
}

console.log('\nRemaining in landing/components:');
console.log(fs.readdirSync(LANDING).join('\n'));
