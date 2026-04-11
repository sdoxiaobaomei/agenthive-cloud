const fs = require('fs');
['ChatView','CodeViewer','TerminalView'].forEach(name => {
  const p = 'packages/ui/src/components/' + name + '.vue';
  const c = fs.readFileSync(p, 'utf8');
  const matches = c.match(/from ['"]@[^'"]+['"]/g);
  console.log(name + ':');
  if (matches) matches.forEach(m => console.log(' ', m));
});
