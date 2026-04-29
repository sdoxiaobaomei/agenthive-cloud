> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: 鎬ц兘浼樺寲

```typescript
// shallowRef for large data
const tableData = shallowRef<Row[]>([])

// v-memo for long lists
<div v-for="item in list" :key="item.id" v-memo="[item.status]">
  <RowComponent :item="item" />
</div>

// Prop Stability 鈥?浼犻€掑師濮嬪€?
<!-- 閿欒 鈥?user 瀵硅薄姣忔閲嶆覆鏌撻兘鏂板缓 -->
<UserRow v-for="u in users" :key="u.id" :user="u" />

<!-- 姝ｇ‘ 鈥?鍙紶闇€瑕佺殑鍘熷鍊?-->
<UserRow v-for="u in users" :key="u.id" :name="u.name" :isActive="u.id === activeId" />

// Lazy loading
const Dashboard = () => import('@/features/dashboard/views/Dashboard.vue')
```
