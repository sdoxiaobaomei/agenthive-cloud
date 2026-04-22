const fs = require('fs');
const c = fs.readFileSync('apps/landing/components/StudioExecutionPanel.vue','utf8');
const m = c.match(/from ['"]@[^'"]+['"]/g);
console.log('StudioExecutionPanel:');
if (m) m.forEach(x => console.log(' ', x));
