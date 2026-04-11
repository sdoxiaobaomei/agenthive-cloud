const fs = require('fs');
const files = process.argv.slice(2);
const re = /^import .* from ['"]@[^'"]+['"]$/gm;
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const m = c.match(re);
  if (m) {
    console.log('=== ' + f + ' ===');
    m.forEach(line => console.log(line));
  }
});
