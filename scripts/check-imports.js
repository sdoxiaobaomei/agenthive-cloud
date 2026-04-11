const fs = require('fs');
const c = fs.readFileSync('apps/apps/landing/pages/studio.vue', 'utf8');
const matches = c.match(/from ['"]@agenthive\/ui[^'"]+['"]/g);
console.log([...new Set(matches)].join('\n'));
