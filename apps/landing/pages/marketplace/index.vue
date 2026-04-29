<template>
  <div class="marketplace-page">
    <!-- Header -->
    <div class="marketplace-header">
      <h1 class="page-title">Marketplace</h1>
      <p class="page-subtitle">Discover templates, websites, and components from top creators</p>
    </div>

    <!-- Toolbar -->
    <div class="marketplace-toolbar">
      <el-input
        v-model="marketplaceStore.searchQuery"
        placeholder="Search by name or tags..."
        clearable
        class="search-input"
        size="large"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div class="filter-group">
        <el-radio-group v-model="marketplaceStore.categoryFilter" size="small">
          <el-radio-button label="all">All</el-radio-button>
          <el-radio-button label="template">Templates</el-radio-button>
          <el-radio-button label="website">Websites</el-radio-button>
          <el-radio-button label="component">Components</el-radio-button>
        </el-radio-group>

        <el-select v-model="marketplaceStore.sortBy" size="small" class="sort-select">
          <el-option label="Hot" value="hot" />
          <el-option label="Newest" value="newest" />
          <el-option label="Top Rated" value="rating" />
          <el-option label="Price: Low to High" value="price_asc" />
        </el-select>
      </div>
    </div>

    <!-- Product Grid -->
    <div v-if="marketplaceStore.filteredProducts.length > 0" class="product-grid">
      <div
        v-for="product in marketplaceStore.filteredProducts"
        :key="product.id"
        class="product-card"
        @click="goToProduct(product.id)"
      >
        <div class="product-image">
          <img :src="product.previewImages[0]" :alt="product.name" loading="lazy" />
          <div class="product-type-badge">
            <el-tag size="small" effect="dark">{{ product.type }}</el-tag>
          </div>
        </div>

        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-desc">{{ product.description }}</p>

          <div class="product-tags">
            <el-tag
              v-for="tag in product.tags.slice(0, 3)"
              :key="tag"
              size="small"
              effect="plain"
              class="product-tag"
            >
              {{ tag }}
            </el-tag>
          </div>

          <div class="product-footer">
            <div class="product-price">
              <span class="price-value">{{ product.creditsPrice }}</span>
              <span class="price-unit">credits</span>
            </div>
            <div class="product-meta">
              <span class="meta-item">
                <el-icon><StarFilled /></el-icon>
                {{ product.rating }}
              </span>
              <span class="meta-item">
                <el-icon><ShoppingBag /></el-icon>
                {{ product.salesCount }}
              </span>
            </div>
          </div>

          <div class="product-seller">
            <div class="seller-avatar">{{ product.sellerName.charAt(0) }}</div>
            <span class="seller-name">{{ product.sellerName }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <el-empty
      v-else
      description="No products found"
      :image-size="180"
    >
      <template #description>
        <div class="empty-desc">
          <p class="empty-title">No products found</p>
          <p class="empty-subtitle">Try adjusting your search or filters</p>
        </div>
      </template>
      <el-button text @click="clearFilters">Clear Filters</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Search,
  StarFilled,
  ShoppingBag,
} from '@element-plus/icons-vue'
import { useMarketplaceStore } from '~/stores/marketplace'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const marketplaceStore = useMarketplaceStore()

const goToProduct = (productId: string) => {
  router.push(`/marketplace/${productId}`)
}

const clearFilters = () => {
  marketplaceStore.setSearchQuery('')
  marketplaceStore.setCategoryFilter('all')
  marketplaceStore.setSortBy('hot')
}
</script>

<style scoped>
.marketplace-page {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
}

/* ============ Header ============ */
.marketplace-header {
  text-align: center;
  margin-bottom: 28px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}

.page-subtitle {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

/* ============ Toolbar ============ */
.marketplace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input {
  width: 320px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sort-select {
  width: 160px;
}

/* ============ Product Grid ============ */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.product-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.product-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Product Image */
.product-image {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: #f3f4f6;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-image img {
  transform: scale(1.03);
}

.product-type-badge {
  position: absolute;
  top: 12px;
  left: 12px;
}

.product-type-badge :deep(.el-tag) {
  text-transform: capitalize;
}

/* Product Info */
.product-info {
  padding: 16px;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.product-tag {
  font-size: 11px;
}

/* Product Footer */
.product-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
  margin-bottom: 10px;
}

.product-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price-value {
  font-size: 18px;
  font-weight: 700;
  color: #4f46e5;
}

.price-unit {
  font-size: 12px;
  color: #9ca3af;
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.meta-item .el-icon {
  font-size: 14px;
}

/* Seller */
.product-seller {
  display: flex;
  align-items: center;
  gap: 8px;
}

.seller-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seller-name {
  font-size: 12px;
  color: #6b7280;
}

/* Empty State */
.empty-desc {
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 4px;
}

.empty-subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .marketplace-page {
    padding: 16px;
  }

  .marketplace-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .filter-group {
    flex-wrap: wrap;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
