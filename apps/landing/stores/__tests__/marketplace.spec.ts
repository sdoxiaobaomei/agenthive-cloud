import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMarketplaceStore } from '../marketplace'

describe('useMarketplaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('getters', () => {
    it('returns correct initial state', () => {
      const store = useMarketplaceStore()
      expect(store.products.length).toBeGreaterThan(0)
      expect(store.currentProduct).toBeNull()
      expect(store.categoryFilter).toBe('all')
      expect(store.sortBy).toBe('hot')
      expect(store.searchQuery).toBe('')
    })

    it('filteredProducts returns all when no filter', () => {
      const store = useMarketplaceStore()
      store.categoryFilter = 'all'
      store.searchQuery = ''
      expect(store.filteredProducts.length).toBe(store.products.length)
    })

    it('filteredProducts filters by category', () => {
      const store = useMarketplaceStore()
      store.categoryFilter = 'template'
      const result = store.filteredProducts
      expect(result.every(p => p.type === 'template')).toBe(true)
      expect(result.length).toBeLessThan(store.products.length)
    })

    it('filteredProducts filters by website category', () => {
      const store = useMarketplaceStore()
      store.categoryFilter = 'website'
      const result = store.filteredProducts
      expect(result.every(p => p.type === 'website')).toBe(true)
    })

    it('filteredProducts filters by component category', () => {
      const store = useMarketplaceStore()
      store.categoryFilter = 'component'
      const result = store.filteredProducts
      expect(result.every(p => p.type === 'component')).toBe(true)
    })

    it('filteredProducts filters by search query in name', () => {
      const store = useMarketplaceStore()
      store.searchQuery = 'Vue'
      const result = store.filteredProducts
      expect(result.every(p =>
        p.name.toLowerCase().includes('vue') ||
        p.tags.some(t => t.toLowerCase().includes('vue'))
      )).toBe(true)
    })

    it('filteredProducts filters by search query in tags', () => {
      const store = useMarketplaceStore()
      store.searchQuery = 'react'
      const result = store.filteredProducts
      expect(result.length).toBeGreaterThan(0)
      expect(result.some(p =>
        p.tags.some(t => t.toLowerCase().includes('react'))
      )).toBe(true)
    })

    it('filteredProducts sorts by hot (salesCount desc)', () => {
      const store = useMarketplaceStore()
      store.sortBy = 'hot'
      const result = store.filteredProducts
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].salesCount).toBeGreaterThanOrEqual(result[i].salesCount)
      }
    })

    it('filteredProducts sorts by newest (createdAt desc)', () => {
      const store = useMarketplaceStore()
      store.sortBy = 'newest'
      const result = store.filteredProducts
      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1].createdAt).getTime()
        const curr = new Date(result[i].createdAt).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    })

    it('filteredProducts sorts by rating desc', () => {
      const store = useMarketplaceStore()
      store.sortBy = 'rating'
      const result = store.filteredProducts
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].rating).toBeGreaterThanOrEqual(result[i].rating)
      }
    })

    it('filteredProducts sorts by price_asc', () => {
      const store = useMarketplaceStore()
      store.sortBy = 'price_asc'
      const result = store.filteredProducts
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].creditsPrice).toBeLessThanOrEqual(result[i].creditsPrice)
      }
    })

    it('isPurchased returns false for unpurchased product', () => {
      const store = useMarketplaceStore()
      expect(store.isPurchased('prod-001')).toBe(false)
    })

    it('isPurchased returns true after purchase', async () => {
      const store = useMarketplaceStore()
      await store.purchaseProduct('prod-001')
      expect(store.isPurchased('prod-001')).toBe(true)
    })
  })

  describe('actions', () => {
    it('setCategoryFilter updates filter', () => {
      const store = useMarketplaceStore()
      store.setCategoryFilter('website')
      expect(store.categoryFilter).toBe('website')
    })

    it('setSortBy updates sort', () => {
      const store = useMarketplaceStore()
      store.setSortBy('newest')
      expect(store.sortBy).toBe('newest')
    })

    it('setSearchQuery updates query', () => {
      const store = useMarketplaceStore()
      store.setSearchQuery('dashboard')
      expect(store.searchQuery).toBe('dashboard')
    })

    it('selectProduct sets current product', () => {
      const store = useMarketplaceStore()
      const product = store.products[0]
      store.selectProduct(product)
      expect(store.currentProduct).toEqual(product)
    })

    it('selectProduct with null clears selection', () => {
      const store = useMarketplaceStore()
      store.currentProduct = store.products[0]
      store.selectProduct(null)
      expect(store.currentProduct).toBeNull()
    })

    it('purchaseProduct adds to purchased set', async () => {
      const store = useMarketplaceStore()
      expect(store.purchasedProductIds.has('prod-002')).toBe(false)
      await store.purchaseProduct('prod-002')
      expect(store.purchasedProductIds.has('prod-002')).toBe(true)
    })

    it('purchaseProduct sets loading state', async () => {
      const store = useMarketplaceStore()
      const promise = store.purchaseProduct('prod-003')
      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('clearError resets error', () => {
      const store = useMarketplaceStore()
      store.error = 'Network error'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
