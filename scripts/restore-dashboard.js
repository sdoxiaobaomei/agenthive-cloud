const fs = require('fs');
let content = fs.readFileSync('apps/apps/web/src/views/Dashboard.vue', 'utf8');
content = content.replace('<script setup lang="ts">', '<script setup lang="ts">\nuseSeoMeta({\n  title: "Dashboard - AgentHive",\n  description: "AgentHive 项目仪表�?\n})');
content = content.replace(/@\/types/g, '@agenthive/types');
fs.writeFileSync('apps/apps/landing/pages/app/dashboard.vue', content);
console.log('restored dashboard');
