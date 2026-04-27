# Pattern: Nuxt BFF 代理

```typescript
// server/api/users/[id].ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const javaResult = await $fetch(`http://gateway/api/v1/users/${id}`, {
    headers: { 'X-Internal-Key': useRuntimeConfig().internalKey }
  })
  // 转换 Java Result<T> -> 前端格式
  return { id: javaResult.data.id, name: javaResult.data.name }
})
```

规则:
- 前端通过 $fetch('/api/...') 调用 BFF
- BFF 负责调用 Java Gateway 并转换响应格式
- 禁止前端直接请求 Java Gateway
