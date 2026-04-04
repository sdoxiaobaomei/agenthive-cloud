# AgentHive Landing

AgentHive Cloud 营销站点 - 基于 Nuxt 3 构建

## 特性

- **SEO 优化**: 完整的 SEO 元标签、Open Graph、Sitemap
- **静态生成**: 预渲染所有页面，CDN 友好
- **响应式设计**: 适配桌面端和移动端
- **性能优化**: 自动代码分割、图片优化

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run generate

# 预览
npm run preview
```

## 部署

站点配置为静态生成，可部署到任何静态托管服务：

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- AWS S3 + CloudFront

## 目录结构

```
landing/
├── components/      # Vue 组件
├── layouts/         # 布局
├── pages/           # 页面
├── public/          # 静态资源
├── assets/          # 资源文件
├── composables/     # 组合函数
├── nuxt.config.ts   # Nuxt 配置
└── tailwind.config.js  # Tailwind 配置
```

## 环境变量

创建 `.env` 文件：

```
NUXT_PUBLIC_SITE_URL=https://agenthive.cloud
```
