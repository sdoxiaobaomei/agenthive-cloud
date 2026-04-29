<template>
  <div class="product-detail-page">
    <!-- Back Button -->
    <div class="detail-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        Back to Marketplace
      </el-button>
    </div>

    <!-- Loading -->
    <div v-if="!product" class="detail-loading">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- Product Content -->
    <div v-else class="detail-content">
      <!-- Left: Preview -->
      <div class="detail-preview">
        <div class="preview-gallery">
          <img
            :src="activeImage"
            :alt="product.name"
            class="preview-main-image"
          />
        </div>
        <div v-if="product.previewImages.length > 1" class="preview-thumbnails">
          <img
            v-for="(img, idx) in product.previewImages"
            :key="idx"
            :src="img"
            :class="{ active: activeImage === img }"
            @click="activeImage = img"
          />
        </div>

        <!-- Demo Link -->
        <div v-if="product.demoUrl" class="demo-section">
          <h4>Live Preview</h4>
          <div class="demo-frame-wrapper">
            <iframe
              :src="product.demoUrl"
              class="demo-frame"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <!-- Right: Info -->
      <div class="detail-info">
        <div class="info-header">
          <el-tag size="small" effect="dark" class="info-type">{{ product.type }}</el-tag>
          <h1 class="info-name">{{ product.name }}</h1>
          <div class="info-meta">
            <span class="meta-rating">
              <el-icon><StarFilled /></el-icon>
              {{ product.rating }} ({{ product.reviewCount }} reviews)
            </span>
            <span class="meta-sales">{{ product.salesCount }} sales</span>
          </div>
        </div>

        <p class="info-desc">{{ product.description }}</p>

        <!-- Tech Stack -->
        <div class="info-section">
          <h4>Tech Stack</h4>
          <div class="tech-tags">
            <el-tag
              v-for="tech in product.techStack"
              :key="tech"
              size="small"
              effect="light"
              type="info"
            >
              {{ tech }}
            </el-tag>
          </div>
        </div>

        <!-- Tags -->
        <div class="info-section">
          <h4>Tags</h4>
          <div class="tag-list">
            <el-tag
              v-for="tag in product.tags"
              :key="tag"
              size="small"
              effect="plain"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>

        <!-- Seller -->
        <div class="info-section">
          <h4>Seller</h4>
          <div class="seller-card">
            <div class="seller-avatar-large">{{ product.sellerName.charAt(0) }}</div>
            <div class="seller-info">
              <span class="seller-name">{{ product.sellerName }}</span>
              <span class="seller-products">More products from this seller</span>
            </div>
          </div>
        </div>

        <!-- Purchase -->
        <div class="purchase-card">
          <div class="purchase-price">
            <span class="price-value">{{ product.creditsPrice }}</span>
            <span class="price-unit">credits</span>
            <span v-if="product.price" class="price-fiat">${{ product.price }}</span>
          </div>

          <div v-if="isPurchased" class="purchased-badge">
            <el-icon><Check /></el-icon>
            <span>Purchased</span>
          </div>

          <template v-else>
            <el-button
              type="primary"
              size="large"
              class="buy-btn"
              :loading="marketplaceStore.loading"
              @click="handlePurchase"
            >
              Buy with Credits
            </el-button>
            <el-button
              size="large"
              class="buy-btn"
              :loading="marketplaceStore.loading"
              @click="handleFiatPurchase"
            >
              Buy with ${{ product.price }}
            </el-button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  StarFilled,
  Check,
} from '@element-plus/icons-vue'
import { useMarketplaceStore } from '~/stores/marketplace'

definePageMeta({
  layout: 'app',
})

const route = useRoute()
const router = useRouter()
const marketplaceStore = useMarketplaceStore()

const productId = computed(() => route.params.id as string)
const activeImage = ref('')

const product = computed(() => {
  return marketplaceStore.products.find(p => p.id === productId.value) || null
})

const isPurchased = computed(() => {
  return product.value ? marketplaceStore.isPurchased(product.value.id) : false
})

const goBack = () => {
  router.push('/marketplace')
}

const handlePurchase = async () => {
  if (!product.value) return
  try {
    await marketplaceStore.purchaseProduct(product.value.id)
    ElMessage.success(`Purchased ${product.value.name}!`)
  } catch (err: any) {
    ElMessage.error(err.message || 'Purchase failed')
  }
}

const handleFiatPurchase = () => {
  // 法币支付使用 mock（等待 Java Payment 接口）
  ElMessage.info('Fiat payment is coming soon')
}

onMounted(() => {
  if (product.value?.previewImages.length) {
    activeImage.value = product.value.previewImages[0]
  }
})
</script>

<style scoped>
.product-detail-page {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

/* ============ Header ============ */
.detail-header {
  margin-bottom: 20px;
}

/* ============ Loading ============ */
.detail-loading {
  padding: 40px;
}

/* ============ Content Layout ============ */
.detail-content {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 32px;
}

/* ============ Preview Section ============ */
.detail-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-gallery {
  border-radius: 12px;
  overflow: hidden;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.preview-main-image {
  width: 100%;
  height: 360px;
  object-fit: cover;
  display: block;
}

.preview-thumbnails {
  display: flex;
  gap: 8px;
}

.preview-thumbnails img {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}

.preview-thumbnails img:hover {
  border-color: #bfdbfe;
}

.preview-thumbnails img.active {
  border-color: #4f46e5;
}

/* Demo */
.demo-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.demo-frame-wrapper {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.demo-frame {
  width: 100%;
  height: 300px;
  border: none;
  display: block;
}

/* ============ Info Section ============ */
.detail-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-header {
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 16px;
}

.info-type {
  text-transform: capitalize;
  margin-bottom: 8px;
}

.info-name {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
  line-height: 1.3;
}

.info-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.meta-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #f59e0b;
}

.meta-rating .el-icon {
  font-size: 16px;
}

.info-desc {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.7;
  margin: 0;
}

.info-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tech-tags,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Seller Card */
.seller-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.seller-avatar-large {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #4f46e5;
  color: white;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seller-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.seller-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.seller-products {
  font-size: 12px;
  color: #9ca3af;
}

/* Purchase Card */
.purchase-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.purchase-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.price-value {
  font-size: 28px;
  font-weight: 700;
  color: #4f46e5;
}

.price-unit {
  font-size: 14px;
  color: #9ca3af;
}

.price-fiat {
  font-size: 14px;
  color: #6b7280;
  text-decoration: line-through;
  margin-left: auto;
}

.buy-btn {
  width: 100%;
  justify-content: center;
}

.purchased-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #ecfdf5;
  color: #10b981;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.purchased-badge .el-icon {
  font-size: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .product-detail-page {
    padding: 16px;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .preview-main-image {
    height: 240px;
  }
}
</style>
