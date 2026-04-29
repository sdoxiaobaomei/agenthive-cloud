# Pattern: Hosting Deployment Config Generation

## Context

当用户需要将 workspace 一键部署为可访问的网站时，Node.js BFF 需要根据项目技术栈生成对应的 Dockerfile 和 Nginx 配置。

## Solution

```typescript
export async function generateDeployConfig(
  projectId: string,
  workspacePath: string,
  techStack?: string
): Promise<{ dockerfile: string; nginxConfig: string; staticFiles: string[] }> {
  const stack = techStack || 'static'
  const isStatic = ['html', 'static', 'vue', 'react', 'nuxt'].some((s) => stack.includes(s))

  const dockerfile = isStatic
    ? `FROM nginx:alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 80\n`
    : `FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install && npm run build\nEXPOSE 3000\nCMD ["node", "dist/index.js"]\n`

  const nginxConfig = `server {\n  listen 80;\n  server_name ${projectId}.${HOSTING_DOMAIN};\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n`

  // Scan workspace for static files
  const entries = await readdir(workspacePath, { withFileTypes: true })
  const staticFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => ['.html', '.css', '.js', '.png', '.jpg', '.svg', '.json'].includes(extname(name)))

  return { dockerfile, nginxConfig, staticFiles }
}
```

## Trade-offs

- **Pros**: 简单、无外部依赖、生成速度快。
- **Cons**: 每新增一种技术栈都需要修改代码；复杂 SSR 场景（如 Nuxt server）需要更复杂的模板。

## When to Use

适合 MVP 阶段的静态站点托管，或作为更复杂 CI/CD pipeline 的前置配置生成步骤。

## When NOT to Use

如果需要支持动态运行时（如 Node.js 服务端渲染、Python Flask 等），应使用容器镜像仓库 + Helm chart 模板化方案。

## Related

- `docker-compose.prod.yml` 中的 Nginx 服务配置
- Platform 团队的 K8s deployment 模板
