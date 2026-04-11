const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, cb);
    else if (p.endsWith('.vue') || p.endsWith('.ts')) cb(p);
  }
}

walk('packages/ui/src', (p) => {
  const content = fs.readFileSync(p, 'utf8');
  const matches = content.match(/from ['"]@\/[^'"]+['"]/g);
  if (matches) {
    console.log(p);
    matches.forEach(m => console.log('  ', m));
  }
});
