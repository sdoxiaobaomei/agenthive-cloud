import { defineStore } from 'pinia'

/** 商品类型 */
export type ProductType = 'template' | 'website' | 'component'

/** 商品信息 */
export interface Product {
  id: string
  name: string
  description: string
  type: ProductType
  category: string
  tags: string[]
  price: number
  creditsPrice: number
  currency: 'credits' | 'fiat'
  rating: number
  reviewCount: number
  salesCount: number
  sellerId: string
  sellerName: string
  sellerAvatar?: string
  previewImages: string[]
  demoUrl?: string
  techStack: string[]
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

/** 市场状态 */
interface MarketplaceState {
  products: Product[]
  currentProduct: Product | null
  purchasedProductIds: Set<string>
  loading: boolean
  error: string | null
  categoryFilter: ProductType | 'all'
  sortBy: 'hot' | 'newest' | 'rating' | 'price_asc'
  searchQuery: string
}

// Mock 商品数据
const mockProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'Vue Admin Dashboard',
    description: 'A modern admin dashboard built with Vue 3, Element Plus, and Tailwind CSS. Includes dark mode, i18n, and role-based access control.',
    type: 'template',
    category: 'Dashboard',
    tags: ['vue', 'admin', 'dashboard', 'element-plus'],
    price: 29.99,
    creditsPrice: 299,
    currency: 'credits',
    rating: 4.8,
    reviewCount: 124,
    salesCount: 856,
    sellerId: 'user-001',
    sellerName: 'Alice Chen',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/admin1/800/600', 'https://picsum.photos/seed/admin2/800/600'],
    demoUrl: 'https://demo.example.com/admin',
    techStack: ['Vue 3', 'Element Plus', 'Tailwind'],
    status: 'active',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-20T08:30:00Z',
  },
  {
    id: 'prod-002',
    name: 'React E-commerce Template',
    description: 'Full-featured e-commerce template with cart, checkout, and payment integration. Responsive design with mobile-first approach.',
    type: 'template',
    category: 'E-commerce',
    tags: ['react', 'ecommerce', 'shopping', 'stripe'],
    price: 49.99,
    creditsPrice: 499,
    currency: 'credits',
    rating: 4.6,
    reviewCount: 89,
    salesCount: 634,
    sellerId: 'user-002',
    sellerName: 'Bob Smith',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/shop1/800/600', 'https://picsum.photos/seed/shop2/800/600'],
    demoUrl: 'https://demo.example.com/shop',
    techStack: ['React', 'Next.js', 'Stripe'],
    status: 'active',
    createdAt: '2026-02-20T14:00:00Z',
    updatedAt: '2026-04-18T12:00:00Z',
  },
  {
    id: 'prod-003',
    name: 'Portfolio Website',
    description: 'Minimalist portfolio website for designers and developers. Clean animations, SEO optimized, and easy to customize.',
    type: 'website',
    category: 'Portfolio',
    tags: ['portfolio', 'minimal', 'animation'],
    price: 19.99,
    creditsPrice: 199,
    currency: 'credits',
    rating: 4.9,
    reviewCount: 215,
    salesCount: 1203,
    sellerId: 'user-003',
    sellerName: 'Carol Wang',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/portfolio1/800/600'],
    demoUrl: 'https://demo.example.com/portfolio',
    techStack: ['Vue 3', 'GSAP', 'Tailwind'],
    status: 'active',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-04-15T16:00:00Z',
  },
  {
    id: 'prod-004',
    name: 'Chat Component Library',
    description: 'A set of reusable chat UI components including message bubbles, typing indicators, and file upload widgets.',
    type: 'component',
    category: 'UI Components',
    tags: ['chat', 'components', 'ui'],
    price: 9.99,
    creditsPrice: 99,
    currency: 'credits',
    rating: 4.4,
    reviewCount: 56,
    salesCount: 432,
    sellerId: 'user-001',
    sellerName: 'Alice Chen',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/chat1/800/600'],
    techStack: ['React', 'TypeScript'],
    status: 'active',
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-04-10T10:00:00Z',
  },
  {
    id: 'prod-005',
    name: 'Node.js API Boilerplate',
    description: 'Production-ready Node.js API starter with JWT auth, rate limiting, OpenAPI docs, and Docker setup.',
    type: 'template',
    category: 'Backend',
    tags: ['node', 'api', 'backend', 'docker'],
    price: 24.99,
    creditsPrice: 249,
    currency: 'credits',
    rating: 4.7,
    reviewCount: 78,
    salesCount: 567,
    sellerId: 'user-004',
    sellerName: 'David Lee',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/api1/800/600'],
    techStack: ['Node.js', 'Express', 'PostgreSQL'],
    status: 'active',
    createdAt: '2026-02-05T08:00:00Z',
    updatedAt: '2026-04-12T09:00:00Z',
  },
  {
    id: 'prod-006',
    name: 'Landing Page Kit',
    description: 'Conversion-optimized landing page components with A/B testing hooks and analytics integration.',
    type: 'component',
    category: 'Marketing',
    tags: ['landing', 'marketing', 'conversion'],
    price: 14.99,
    creditsPrice: 149,
    currency: 'credits',
    rating: 4.5,
    reviewCount: 43,
    salesCount: 378,
    sellerId: 'user-002',
    sellerName: 'Bob Smith',
    sellerAvatar: '',
    previewImages: ['https://picsum.photos/seed/landing1/800/600', 'https://picsum.photos/seed/landing2/800/600'],
    demoUrl: 'https://demo.example.com/landing',
    techStack: ['Vue 3', 'Tailwind'],
    status: 'active',
    createdAt: '2026-03-20T13:00:00Z',
    updatedAt: '2026-04-22T11:00:00Z',
  },
]

export const useMarketplaceStore = defineStore('marketplace', {
  state: (): MarketplaceState => ({
    products: mockProducts,
    currentProduct: null,
    purchasedProductIds: new Set(),
    loading: false,
    error: null,
    categoryFilter: 'all',
    sortBy: 'hot',
    searchQuery: '',
  }),

  getters: {
    filteredProducts: (state): Product[] => {
      let result = [...state.products]

      // 分类过滤
      if (state.categoryFilter !== 'all') {
        result = result.filter(p => p.type === state.categoryFilter)
      }

      // 搜索过滤
      const query = state.searchQuery.trim().toLowerCase()
      if (query) {
        result = result.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.tags.some(t => t.toLowerCase().includes(query))
        )
      }

      // 排序
      switch (state.sortBy) {
        case 'hot':
          result.sort((a, b) => b.salesCount - a.salesCount)
          break
        case 'newest':
          result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          break
        case 'rating':
          result.sort((a, b) => b.rating - a.rating)
          break
        case 'price_asc':
          result.sort((a, b) => a.creditsPrice - b.creditsPrice)
          break
      }

      return result
    },

    isPurchased: (state) => (productId: string): boolean => {
      return state.purchasedProductIds.has(productId)
    },
  },

  actions: {
    setCategoryFilter(filter: ProductType | 'all'): void {
      this.categoryFilter = filter
    },

    setSortBy(sort: 'hot' | 'newest' | 'rating' | 'price_asc'): void {
      this.sortBy = sort
    },

    setSearchQuery(query: string): void {
      this.searchQuery = query
    },

    selectProduct(product: Product | null): void {
      this.currentProduct = product
    },

    async purchaseProduct(productId: string): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // TODO: 对接真实购买 API（等待 JAVA-002）
        // const { post } = useApi()
        // const response = await post(`/api/marketplace/orders`, { productId, payChannel: 'credits' })

        // Mock 成功
        await new Promise(resolve => setTimeout(resolve, 800))
        this.purchasedProductIds.add(productId)
      } catch (err: any) {
        this.error = err.message || '购买失败'
        throw err
      } finally {
        this.loading = false
      }
    },

    clearError(): void {
      this.error = null
    },
  },

  persist: {
    key: 'agenthive:marketplace',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    pick: ['purchasedProductIds'],
  },
})
