<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ProductForm from '~/components/creator/ProductForm.vue'
import { useMockProducts } from '~/composables/useMockProducts'
import type { ProductFormData } from '~/components/creator/ProductForm.vue'
import type { CreatorProductType } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const productsApi = useMockProducts()

const formData = ref<ProductFormData>({
  name: '',
  description: '',
  type: 'template',
  techStack: [],
  tags: [],
  creditsPrice: null,
  price: null,
  demoUrl: '',
  previewImages: [],
  sourceProjectId: '',
})

const goBack = () => router.push('/creator/products')

const handleSubmit = async () => {
  try {
    const product = await productsApi.publish({
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
      type: formData.value.type as CreatorProductType,
      techStack: formData.value.techStack,
      tags: formData.value.tags,
      creditsPrice: formData.value.creditsPrice ?? 0,
      price: formData.value.price ?? undefined,
      demoUrl: formData.value.demoUrl || undefined,
      previewImages: formData.value.previewImages.map(img => img.url),
      sourceProjectId: formData.value.sourceProjectId || undefined,
    })
    ElMessage.success('Product published successfully!')
    // Redirect to product detail page (mock placeholder)
    router.push(`/marketplace/${product.id}`)
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to publish product')
  }
}
</script>

<template>
  <div class="publish-page">
    <div class="publish-container">
      <!-- Header -->
      <div class="page-header">
        <ElButton text @click="goBack">
          <ElIcon><ArrowLeft /></ElIcon>
          Back
        </ElButton>
        <h1 class="page-title">Publish New Product</h1>
        <div class="header-spacer" />
      </div>

      <!-- Form -->
      <ProductForm
        v-model="formData"
        :loading="productsApi.loading.value"
        @submit="handleSubmit"
        @cancel="goBack"
      />
    </div>
  </div>
</template>

<style scoped>
.publish-page {
  padding: 24px 32px;
  max-width: 840px;
  margin: 0 auto;
  min-height: 100%;
}

.publish-container {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 32px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
  text-align: center;
}

.header-spacer {
  width: 60px;
}

/* Dark mode */
.dark .publish-container {
  background: #1e293b;
  border-color: #334155;
}

.dark .page-title {
  color: #f1f5f9;
}

/* Responsive */
@media (max-width: 768px) {
  .publish-page {
    padding: 16px;
  }

  .publish-container {
    padding: 20px;
  }
}
</style>
