const fs = require('fs');
const files = [
  'packages/ui/src/components/organisms/MessageHub.vue',
  'packages/ui/src/components/organisms/HeroSection.vue',
  'packages/ui/src/components/organisms/FeaturesSection.vue',
  'packages/ui/src/components/organisms/CTASection.vue',
  'packages/ui/src/components/organisms/AppFooter.vue',
  'packages/ui/src/components/organisms/StudioExecutionPanel.vue',
  'packages/ui/src/components/templates/MainLayout.vue',
];
const re1 = /^import .* from ['"]@[^'"]+['"]$/gm;
const re2 = /^import .* from ['"]~\/[^'"]+['"]$/gm;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const c = fs.readFileSync(f, 'utf8');
  const m1 = c.match(re1) || [];
  const m2 = c.match(re2) || [];
  const m = m1.concat(m2);
  if (m.length > 0) {
    console.log('=== ' + f + ' ===');
    m.forEach(line => console.log(line));
  }
});
