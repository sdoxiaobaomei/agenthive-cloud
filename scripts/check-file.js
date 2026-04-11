const fs = require('fs');
const f = process.argv[2];
const c = fs.readFileSync(f, 'utf8');
const m = c.match(/from ['"]@[^'"]+['"]/g);
console.log(f);
if (m) m.forEach(x => console.log(' ', x));
