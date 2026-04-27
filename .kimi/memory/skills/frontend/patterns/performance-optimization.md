# Pattern: 性能优化

```typescript
// shallowRef for large data
const tableData = shallowRef<Row[]>([])

// v-memo for long lists
<div v-for="item in list" :key="item.id" v-memo="[item.status]">
  <RowComponent :item="item" />
</div>

// Prop Stability — 传递原始值
<!-- 错误 — user 对象每次重渲染都新建 -->
<UserRow v-for="u in users" :key="u.id" :user="u" />

<!-- 正确 — 只传需要的原始值 -->
<UserRow v-for="u in users" :key="u.id" :name="u.name" :isActive="u.id === activeId" />

// Lazy loading
const Dashboard = () => import('@/features/dashboard/views/Dashboard.vue')
```
