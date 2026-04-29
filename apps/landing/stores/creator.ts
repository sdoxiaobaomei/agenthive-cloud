import { defineStore } from 'pinia'
import type { Product, ProductType } from './marketplace'

/** 销售记录 */
export interface SaleRecord {
  id: string
  productId: string
  productName: string
  buyerId: string
  buyerName: string
  price: number
  platformFee: number
  netEarning: number
  createdAt: string
}

/** 收益数据点 */
export interface EarningPoint {
  date: string
  amount: number
}

/** 创作者状态 */
interface CreatorState {
  products: Product[]
  sales: SaleRecord[]
  earnings: EarningPoint[]
  loading: boolean
  error: string | null
  productFilter: 'all' | 'active' | 'inactive'
}

// Mock 创作者商品
const mockCreatorProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'Vue Admin Dashboard',
    description: 'A modern admin dashboard built with Vue 3',
    type: 'template',
    category: 'Dashboard',
    tags: ['vue', 'admin'],
    price: 29.99,
    creditsPrice: 299,
    currency: 'credits',
    rating: 4.8,
    reviewCount: 124,
    salesCount: 856,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/admin1/800/600'],
    demoUrl: 'https://demo.example.com/admin',
    techStack: ['Vue 3', 'Element Plus'],
    status: 'active',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-20T08:30:00Z',
  },
  {
    id: 'prod-004',
    name: 'Chat Component Library',
    description: 'Reusable chat UI components',
    type: 'component',
    category: 'UI Components',
    tags: ['chat', 'components'],
    price: 9.99,
    creditsPrice: 99,
    currency: 'credits',
    rating: 4.4,
    reviewCount: 56,
    salesCount: 432,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/chat1/800/600'],
    techStack: ['React', 'TypeScript'],
    status: 'active',
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-04-10T10:00:00Z',
  },
]

// Mock 销售记录
const mockSales: SaleRecord[] = [
  { id: 'sale-1', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u1', buyerName: 'User A', price: 299, platformFee: 59.8, netEarning: 239.2, createdAt: '2026-04-27T10:00:00Z' },
  { id: 'sale-2', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u2', buyerName: 'User B', price: 299, platformFee: 59.8, netEarning: 239.2, createdAt: '2026-04-26T14:00:00Z' },
  { id: 'sale-3', productId: 'prod-004', productName: 'Chat Component Library', buyerId: 'u3', buyerName: 'User C', price: 99, platformFee: 19.8, netEarning: 79.2, createdAt: '2026-04-25T09:00:00Z' },
  { id: 'sale-4', productId: 'prod-001', productName: 'Vue Admin Dashboard', buyerId: 'u4', buyerName: 'User D', price: 299, platformFee: 59.8, netEarning: 239.2, createdAt: '2026-04-24T16:00:00Z' },
  { id: 'sale-5', productId: 'prod-004', productName: 'Chat Component Library', buyerId: 'u5', buyerName: 'User E', price: 99, platformFee: 19.8, netEarning: 79.2, createdAt: '2026-04-23T11:00:00Z' },
]

// Mock 收益趋势（近30天）
const generateEarnings = (): EarningPoint[] => {
  const points: EarningPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    points.push({
      date: d.toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 500) + 100,
    })
  }
  return points
}

export const useCreatorStore = defineStore('creator', {
  state: (): CreatorState => ({
    products: mockCreatorProducts,
    sales: mockSales,
    earnings: generateEarnings(),
    loading: false,
    error: null,
    productFilter: 'all',
  }),

  getters: {
    totalProducts: (state): number => state.products.length,
    totalSales: (state): number => state.products.reduce((sum, p) => sum + p.salesCount, 0),
    totalEarnings: (state): number => state.sales.reduce((sum, s) => sum + s.netEarning, 0),
    monthlyEarnings: (state): number => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return state.sales
        .filter(s => new Date(s.createdAt) >= monthStart)
        .reduce((sum, s) => sum + s.netEarning, 0)
    },
    filteredProducts: (state): Product[] => {
      if (state.productFilter === 'all') return state.products
      return state.products.filter(p =>
        state.productFilter === 'active' ? p.status === 'active' : p.status === 'inactive'
      )
    },
  },

  actions: {
    setProductFilter(filter: 'all' | 'active' | 'inactive'): void {
      this.productFilter = filter
    },

    async publishProduct(data: Partial<Product>): Promise<Product> {
      this.loading = true
      try {
        // TODO: 对接真实 API
        await new Promise(resolve => setTimeout(resolve, 1000))
        const newProduct: Product = {
          id: `prod-${Date.now()}`,
          name: data.name || 'Untitled',
          description: data.description || '',
          type: (data.type as ProductType) || 'template',
          category: data.category || '',
          tags: data.tags || [],
          price: data.price || 0,
          creditsPrice: data.creditsPrice || 0,
          currency: 'credits',
          rating: 0,
          reviewCount: 0,
          salesCount: 0,
          sellerId: 'current-user',
          sellerName: 'You',
          previewImages: data.previewImages || [],
          demoUrl: data.demoUrl,
          techStack: data.techStack || [],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        this.products.push(newProduct)
        return newProduct
      } finally {
        this.loading = false
      }
    },

    async toggleProductStatus(productId: string): Promise<void> {
      const product = this.products.find(p => p.id === productId)
      if (product) {
        product.status = product.status === 'active' ? 'inactive' : 'active'
      }
    },

    clearError(): void {
      this.error = null
    },
  },
})
