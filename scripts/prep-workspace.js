const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyFilesForT004() {
  copyFile('agents/orchestrator.ts', 'agents/workspace/T004/repo/agents/orchestrator.ts');
  copyFile('agents/AGENTS.md', 'agents/workspace/T004/repo/agents/AGENTS.md');
  for (const f of fs.readdirSync('agents/shared/prompts')) {
    copyFile('agents/shared/prompts/' + f, 'agents/workspace/T004/repo/agents/shared/prompts/' + f);
  }
}

function copyFilesForT005() {
  copyFile('agents/orchestrator.ts', 'agents/workspace/T005/repo/agents/orchestrator.ts');
  copyFile('agents/AGENTS.md', 'agents/workspace/T005/repo/agents/AGENTS.md');
  for (const f of fs.readdirSync('agents/shared/prompts')) {
    copyFile('agents/shared/prompts/' + f, 'agents/workspace/T005/repo/agents/shared/prompts/' + f);
  }
}

function copyFilesForT006() {
  const srcRoot = 'apps/web/src';
  const destRoot = 'agents/workspace/T006/repo/apps/web/src';
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      const rel = path.relative(srcRoot, p);
      const d = path.join(destRoot, rel);
      if (entry.isDirectory()) walk(p);
      else {
        fs.mkdirSync(path.dirname(d), { recursive: true });
        fs.copyFileSync(p, d);
      }
    }
  }
  walk(srcRoot);
  fs.mkdirSync('agents/workspace/T006/repo/apps/web', { recursive: true });
  fs.copyFileSync('apps/web/package.json', 'agents/workspace/T006/repo/apps/web/package.json');
}

copyFilesForT004();
copyFilesForT005();
copyFilesForT006();
console.log('Workspace prepared for T-004, T-005, T-006');
