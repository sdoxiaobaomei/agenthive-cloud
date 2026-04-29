/**
 * 商品管理 Mock API 组合式函数
 * Product Management Mock API Composable
 *
 * 设计原则：
 * - interface 与实现分离，后端 API 就绪时只需替换此文件
 * - 模拟网络延迟
 * - 所有数据操作均为本地内存操作
 */

import { ref, shallowRef, computed } from 'vue'
import type { ICreatorProduct, CreatorProductStatus, CreatorProductType } from '~/types/economy'

const MOCK_DELAY_MS = 600

const mockDelay = (ms: number = MOCK_DELAY_MS): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// Mock 商品数据
const mockProducts: ICreatorProduct[] = [
  {
    id: 'prod-001',
    name: 'Vue Admin Dashboard',
    description: 'A modern admin dashboard built with Vue 3, Element Plus, and Tailwind CSS.',
    type: 'template',
    category: 'Dashboard',
    tags: ['vue', 'admin', 'dashboard'],
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
    techStack: ['Vue 3', 'Element Plus', 'Tailwind CSS'],
    status: 'active',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-04-20T08:30:00Z',
  },
  {
    id: 'prod-002',
    name: 'Chat Component Library',
    description: 'Reusable chat UI components for React and Vue.',
    type: 'component',
    category: 'UI Components',
    tags: ['chat', 'components', 'react', 'vue'],
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
  {
    id: 'prod-003',
    name: 'Nuxt 3 Starter Kit',
    description: 'Production-ready Nuxt 3 starter with SSR, i18n, and auth.',
    type: 'template',
    category: 'Starter',
    tags: ['nuxt', 'starter', 'ssr'],
    price: 19.99,
    creditsPrice: 199,
    currency: 'credits',
    rating: 4.9,
    reviewCount: 89,
    salesCount: 645,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/nuxt1/800/600'],
    demoUrl: 'https://demo.example.com/nuxt-starter',
    techStack: ['Nuxt 3', 'TypeScript', 'Pinia'],
    status: 'active',
    createdAt: '2026-02-20T09:00:00Z',
    updatedAt: '2026-04-15T14:00:00Z',
  },
  {
    id: 'prod-004',
    name: 'API Dashboard Pro',
    description: 'Beautiful API documentation and management dashboard.',
    type: 'template',
    category: 'Dashboard',
    tags: ['api', 'dashboard', 'docs'],
    price: 39.99,
    creditsPrice: 399,
    currency: 'credits',
    rating: 4.6,
    reviewCount: 42,
    salesCount: 312,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/api1/800/600'],
    techStack: ['Vue 3', 'Element Plus'],
    status: 'inactive',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'prod-005',
    name: 'Vue Form Builder',
    description: 'Drag-and-drop form builder with validation rules.',
    type: 'plugin',
    category: 'Form',
    tags: ['form', 'builder', 'vue'],
    price: 14.99,
    creditsPrice: 149,
    currency: 'credits',
    rating: 4.7,
    reviewCount: 35,
    salesCount: 198,
    sellerId: 'current-user',
    sellerName: 'You',
    previewImages: ['https://picsum.photos/seed/form1/800/600'],
    techStack: ['Vue 3', 'Vite'],
    status: 'active',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-25T16:00:00Z',
  },
]

export interface PublishProductData {
  name: string
  description: string
  type: CreatorProductType
  techStack: string[]
  tags: string[]
  creditsPrice: number
  price?: number
  demoUrl?: string
  previewImages: string[]
  sourceProjectId?: string
}

export function useMockProducts() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const products = shallowRef<ICreatorProduct[]>([...mockProducts])
  const statusFilter = ref<CreatorProductStatus | 'all'>('all')

  const filteredProducts = computed(() => {
    if (statusFilter.value === 'all') return products.value
    return products.value.filter(p => p.status === statusFilter.value)
  })

  const totalProducts = computed(() => products.value.length)

  /** 刷新列表 */
  const refresh = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      await mockDelay(300)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  /** 发布商品 */
  const publish = async (data: PublishProductData): Promise<ICreatorProduct> => {
    loading.value = true
    error.value = null
    try {
      await mockDelay(800)
      const newProduct: ICreatorProduct = {
        id: `prod-${Date.now()}`,
        name: data.name,
        description: data.description,
        type: data.type,
        category: data.type,
        tags: data.tags,
        price: data.price || 0,
        creditsPrice: data.creditsPrice,
        currency: 'credits',
        rating: 0,
        reviewCount: 0,
        salesCount: 0,
        sellerId: 'current-user',
        sellerName: 'You',
        previewImages: data.previewImages.length > 0
          ? data.previewImages
          : ['https://picsum.photos/seed/product/800/600'],
        demoUrl: data.demoUrl,
        techStack: data.techStack,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      products.value = [...products.value, newProduct]
      return newProduct
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Publish failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 切换商品状态 */
  const toggleStatus = async (productId: string): Promise<void> => {
    loading.value = true
    try {
      await mockDelay(400)
      const list = [...products.value]
      const product = list.find(p => p.id === productId)
      if (product) {
        product.status = product.status === 'active' ? 'inactive' : 'active'
        product.updatedAt = new Date().toISOString()
        products.value = list
      }
    } finally {
      loading.value = false
    }
  }

  /** 删除商品 */
  const remove = async (productId: string): Promise<void> => {
    loading.value = true
    try {
      await mockDelay(400)
      products.value = products.value.filter(p => p.id !== productId)
    } finally {
      loading.value = false
    }
  }

  /** 设置状态过滤 */
  const setFilter = (filter: CreatorProductStatus | 'all') => {
    statusFilter.value = filter
  }

  return {
    products,
    filteredProducts,
    totalProducts,
    loading,
    error,
    statusFilter,
    refresh,
    publish,
    toggleStatus,
    remove,
    setFilter,
  }
}
