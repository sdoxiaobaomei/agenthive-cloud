const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.nuxt') {
      walk(p, cb);
    } else if (entry.isFile() && (p.endsWith('.vue') || p.endsWith('.ts'))) {
      cb(p);
    }
  }
}

walk('apps/landing', (p) => {
  const content = fs.readFileSync(p, 'utf8');
  const matches = content.match(/from ['"]@agenthive\/ui\/[^'"]+['"]/g);
  if (matches) {
    console.log(p);
    matches.forEach(m => console.log('  ', m));
  }
});
