const fs = require('fs');
const path = require('path');

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
  }
}

// Fix execution components
const execDir = 'packages/ui/src/components/execution';
for (const f of fs.readdirSync(execDir)) {
  if (f.endsWith('.vue')) {
    replaceInFile(path.join(execDir, f), [
      ["@/types/execution", "@agenthive/types"],
      ["@/stores/execution", "@agenthive/ui"],
      ["@/utils/execution-demo", "@agenthive/ui"],
      ["@/components/agent/AgentAvatar.vue", "../agent/AgentAvatar.vue"],
    ]);
  }
}

// Fix agent components (only if they use @agenthive/types)
const agentDir = 'packages/ui/src/components/agent';
for (const f of fs.readdirSync(agentDir)) {
  if (f.endsWith('.vue')) {
    replaceInFile(path.join(agentDir, f), [
      ["@/types", "@agenthive/types"],
    ]);
  }
}

console.log('Import fixes applied');
