const fs = require('fs');
const names = ['AppHeader','StudioLayout','StudioToolbox','StudioDrawer','AgentDock','PromptInput','LoginOverlay','FeatureGate'];
names.forEach(name => {
  const p = 'packages/ui/src/components/' + name + '.vue';
  if (!fs.existsSync(p)) { console.log(name + ': FILE MISSING'); return; }
  const c = fs.readFileSync(p, 'utf8');
  const matches = c.match(/from ['"]@[^'"]+['"]/g);
  console.log(name + ':');
  if (matches) matches.forEach(m => console.log(' ', m));
});
