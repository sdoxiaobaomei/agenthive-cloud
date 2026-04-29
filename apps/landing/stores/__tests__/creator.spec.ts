import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCreatorStore } from '../creator'

describe('useCreatorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('getters', () => {
    it('totalProducts returns number of products', () => {
      const store = useCreatorStore()
      expect(store.totalProducts).toBe(store.products.length)
    })

    it('totalSales sums all product salesCount', () => {
      const store = useCreatorStore()
      const expected = store.products.reduce((sum, p) => sum + p.salesCount, 0)
      expect(store.totalSales).toBe(expected)
    })

    it('totalEarnings sums netEarning from all sales', () => {
      const store = useCreatorStore()
      const expected = store.sales.reduce((sum, s) => sum + s.netEarning, 0)
      expect(store.totalEarnings).toBe(expected)
    })

    it('monthlyEarnings filters sales by current month', () => {
      const store = useCreatorStore()
      // All mock sales are in April 2026
      const now = new Date()
      const isApril2026 = now.getFullYear() === 2026 && now.getMonth() === 3
      if (isApril2026) {
        expect(store.monthlyEarnings).toBeGreaterThan(0)
      } else {
        expect(store.monthlyEarnings).toBe(0)
      }
    })

    it('filteredProducts returns all when filter is "all"', () => {
      const store = useCreatorStore()
      store.setProductFilter('all')
      expect(store.filteredProducts).toHaveLength(store.products.length)
    })

    it('filteredProducts returns only active products', () => {
      const store = useCreatorStore()
      store.setProductFilter('active')
      expect(store.filteredProducts.every(p => p.status === 'active')).toBe(true)
    })

    it('filteredProducts returns only inactive products', () => {
      const store = useCreatorStore()
      // Set one product to inactive first
      const target = store.products[0]
      if (target) target.status = 'inactive'
      store.setProductFilter('inactive')
      expect(store.filteredProducts.every(p => p.status === 'inactive')).toBe(true)
    })
  })

  describe('publishProduct', () => {
    it('adds a new product to the list', async () => {
      const store = useCreatorStore()
      const initialCount = store.products.length

      const newProduct = await store.publishProduct({
        name: 'Test Product',
        description: 'A test product',
        type: 'template',
        creditsPrice: 50,
      })

      expect(store.products).toHaveLength(initialCount + 1)
      expect(newProduct.name).toBe('Test Product')
      expect(newProduct.status).toBe('active')
      expect(newProduct.sellerId).toBe('current-user')
    })

    it('defaults missing fields', async () => {
      const store = useCreatorStore()
      const product = await store.publishProduct({})

      expect(product.name).toBe('Untitled')
      expect(product.description).toBe('')
      expect(product.type).toBe('template')
      expect(product.creditsPrice).toBe(0)
    })
  })

  describe('toggleProductStatus', () => {
    it('toggles active to inactive', async () => {
      const store = useCreatorStore()
      const product = store.products.find(p => p.status === 'active')
      if (!product) return

      await store.toggleProductStatus(product.id)
      expect(product.status).toBe('inactive')
    })

    it('toggles inactive to active', async () => {
      const store = useCreatorStore()
      const product = store.products[0]
      product.status = 'inactive'

      await store.toggleProductStatus(product.id)
      expect(product.status).toBe('active')
    })

    it('does nothing for non-existent product', async () => {
      const store = useCreatorStore()
      const before = store.products.map(p => p.status)
      await store.toggleProductStatus('non-existent-id')
      const after = store.products.map(p => p.status)
      expect(after).toEqual(before)
    })
  })
})
