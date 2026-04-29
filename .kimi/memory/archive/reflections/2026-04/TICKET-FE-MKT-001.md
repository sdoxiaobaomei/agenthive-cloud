# Reflection: TICKET-FE-MKT-001 — 市场页面 /marketplace

## 任务概述
实现 Marketplace 商品浏览与购买页面，包含列表页和详情页。

## 关键决策回顾

### 1. Mock 数据先行
**选择**: Store 中内置 6 个 mock 商品数据，而非等待后端 API。

**理由**:
- JAVA-002 尚未完成，无法对接真实 API
- mock 数据可以立即验证 UI 和交互
- 后端就绪后，只需替换数据获取逻辑，UI 零改动

**数据结构**:
```typescript
interface Product {
  id: string
  name: string
  description: string
  type: 'template' | 'website' | 'component'
  price: number
  creditsPrice: number
  rating: number
  reviewCount: number
  salesCount: number
  sellerName: string
  previewImages: string[]
  demoUrl?: string
  techStack: string[]
  tags: string[]
}
```

### 2. 双货币定价
**选择**: 同时显示 credits 价格和法币价格（美元）。

**实现**:
- 列表页只显示 credits 价格（平台主要货币）
- 详情页显示 credits 为主、法币为辅（划线价风格）
- 购买按钮提供两种支付方式

### 3. iframe Sandbox 预览
**选择**: 详情页使用 `iframe sandbox="allow-scripts allow-same-origin"` 展示演示。

**理由**:
- 安全：限制第三方脚本权限
- 用户体验：无需跳转即可预览
- 符合 Ticket 约束："商品预览使用 iframe sandbox"

## 技术细节

### 响应式网格
```css
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
```

无需媒体查询即可实现 1280px+ 3-4 列、小屏单列的自适应。

### 购买状态持久化
```typescript
persist: {
  key: 'agenthive:marketplace',
  pick: ['purchasedProductIds'],
}
```

用户刷新页面后仍保持已购买标记。

### 分类与排序
Store getter `filteredProducts` 中按顺序处理：
1. 分类过滤（type）
2. 搜索过滤（name/tags）
3. 排序（salesCount/createdAt/rating/creditsPrice）

## 可复用模式

### 商品卡片组件模式
```
卡片容器（hover 效果）
├── 图片区域（badge + lazy load）
├── 信息区域
│   ├── 名称
│   ├── 描述（2 行截断）
│   ├── 标签
│   └── 底部（价格 + 评分/销量 + 卖家）
```

可复用于任何电商/内容平台的卡片列表。

## 后续衔接
- **JAVA-002**: 后端市场 API 就绪后，替换 mock 数据为真实 API 调用
- **FE-MKT-002**: 创作者中心（发布与管理）可复用商品卡片组件
- **FE-MKT-003**: Credits 中心对接后，购买流程可切换为真实扣费
