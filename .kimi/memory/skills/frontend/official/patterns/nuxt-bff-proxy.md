> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Nuxt BFF 浠ｇ悊

```typescript
// server/api/users/[id].ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const javaResult = await $fetch(`http://gateway/api/v1/users/${id}`, {
    headers: { 'X-Internal-Key': useRuntimeConfig().internalKey }
  })
  // 杞崲 Java Result<T> -> 鍓嶇鏍煎紡
  return { id: javaResult.data.id, name: javaResult.data.name }
})
```

瑙勫垯:
- 鍓嶇閫氳繃 $fetch('/api/...') 璋冪敤 BFF
- BFF 璐熻矗璋冪敤 Java Gateway 骞惰浆鎹㈠搷搴旀牸寮?
- 绂佹鍓嶇鐩存帴璇锋眰 Java Gateway
