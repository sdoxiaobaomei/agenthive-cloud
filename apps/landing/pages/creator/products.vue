<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Plus,
  StarFilled,
} from '@element-plus/icons-vue'
import DataTable from '~/components/economy/DataTable.vue'
import ConfirmDialog from '~/components/economy/ConfirmDialog.vue'
import { useMockProducts } from '~/composables/useMockProducts'
import type { IDataTableColumn } from '~/types/economy'
import type { ICreatorProduct } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const productsApi = useMockProducts()

// Filter
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const setFilter = (status: 'all' | 'active' | 'inactive') => {
  filterStatus.value = status
  productsApi.setFilter(status === 'all' ? 'all' : status)
}

// Navigation
const goBack = () => router.push('/creator')
const goToPublish = () => router.push('/creator/products/new')
const goToDetail = (row: unknown) => {
  const product = row as ICreatorProduct
  router.push(`/marketplace/${product.id}`)
}

// Edit (mock)
const editProduct = (product: ICreatorProduct) => {
  ElMessage.info(`Edit "${product.name}" — coming soon`)
}

// Toggle status with confirm
const confirmDialog = ref({
  visible: false,
  title: 'Confirm',
  message: '',
  type: 'warning' as 'warning' | 'danger' | 'info' | 'primary',
  action: null as (() => void) | null,
})

const toggleStatus = (product: ICreatorProduct) => {
  const isActive = product.status === 'active'
  confirmDialog.value = {
    visible: true,
    title: isActive ? 'Deactivate Product' : 'Activate Product',
    message: `Are you sure you want to ${isActive ? 'deactivate' : 'activate'} "${product.name}"?`,
    type: 'warning',
    action: async () => {
      try {
        await productsApi.toggleStatus(product.id)
        ElMessage.success(`Product ${isActive ? 'deactivated' : 'activated'}`)
      } catch (err: any) {
        ElMessage.error(err.message || 'Failed to update status')
      } finally {
        confirmDialog.value.visible = false
      }
    },
  }
}

// Delete with confirm
const deleteProduct = (product: ICreatorProduct) => {
  confirmDialog.value = {
    visible: true,
    title: 'Delete Product',
    message: `Delete "${product.name}"? This action cannot be undone.`,
    type: 'danger',
    action: async () => {
      try {
        await productsApi.remove(product.id)
        ElMessage.success('Product deleted')
      } catch (err: any) {
        ElMessage.error(err.message || 'Failed to delete')
      } finally {
        confirmDialog.value.visible = false
      }
    },
  }
}

// DataTable columns
const columns = computed(() => [
  {
    prop: 'name',
    label: 'Product',
    minWidth: 240,
    slot: 'product',
  },
  {
    prop: 'type',
    label: 'Type',
    width: 120,
    align: 'center',
  },
  {
    prop: 'creditsPrice',
    label: 'Price',
    width: 130,
    align: 'right',
    formatter: (_row, _col, val: number) => `<span class="tabular-nums text-indigo-600 font-medium">${val} credits</span>`,
  },
  {
    prop: 'status',
    label: 'Status',
    width: 110,
    align: 'center',
    slot: 'status',
  },
  {
    prop: 'salesCount',
    label: 'Sales',
    width: 100,
    align: 'center',
    sortable: true,
  },
  {
    prop: 'rating',
    label: 'Rating',
    width: 140,
    align: 'center',
    slot: 'rating',
  },
  {
    prop: 'actions',
    label: '',
    width: 200,
    align: 'right',
    slot: 'actions',
  },
] as IDataTableColumn<ICreatorProduct>[])

const tableData = computed(() => productsApi.filteredProducts.value)
</script>

<template>
  <div class="creator-products-page">
    <!-- Header -->
    <div class="page-header">
      <ElButton text @click="goBack">
        <ElIcon><ArrowLeft /></ElIcon>
        Back
      </ElButton>
      <h1 class="page-title">My Products</h1>
      <ElButton type="primary" @click="goToPublish">
        <ElIcon><Plus /></ElIcon>
        New Product
      </ElButton>
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <ElRadioGroup :model-value="filterStatus" size="small" @update:model-value="setFilter">
        <ElRadioButton label="all">
          All ({{ productsApi.totalProducts }})
        </ElRadioButton>
        <ElRadioButton label="active">Active</ElRadioButton>
        <ElRadioButton label="inactive">Inactive</ElRadioButton>
      </ElRadioGroup>
    </div>

    <!-- Product Table -->
    <DataTable
      :columns="(columns as any)"
      :data="tableData"
      :loading="productsApi.loading.value"
      :stripe="true"
      empty-text="No products found"
      @row-click="goToDetail"
    >
      <!-- Product cell -->
      <template #product="{ row }">
        <div class="product-cell">
          <img :src="row.previewImages[0]" class="product-thumb" alt="" />
          <div class="product-info">
            <span class="product-name">{{ row.name }}</span>
            <span class="product-category">{{ row.category }}</span>
          </div>
        </div>
      </template>

      <!-- Status cell -->
      <template #status="{ row }">
        <ElTag
          :type="row.status === 'active' ? 'success' : 'info'"
          size="small"
          effect="light"
        >
          {{ row.status === 'active' ? 'Active' : 'Inactive' }}
        </ElTag>
      </template>

      <!-- Rating cell -->
      <template #rating="{ row }">
        <span class="rating-cell">
          <ElIcon><StarFilled /></ElIcon>
          <span>{{ row.rating || '—' }}</span>
          <span v-if="row.reviewCount" class="review-count">({{ row.reviewCount }})</span>
        </span>
      </template>

      <!-- Actions cell -->
      <template #actions="{ row }">
        <div class="action-buttons">
          <ElButton text size="small" @click.stop="editProduct(row)">Edit</ElButton>
          <ElButton text size="small" @click.stop="toggleStatus(row)">
            {{ row.status === 'active' ? 'Deactivate' : 'Activate' }}
          </ElButton>
          <ElButton text size="small" type="danger" @click.stop="deleteProduct(row)">Delete</ElButton>
        </div>
      </template>
    </DataTable>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model:visible="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :type="confirmDialog.type"
      :loading="productsApi.loading.value"
      @confirm="confirmDialog.action?.()"
    />
  </div>
</template>

<style scoped>
.creator-products-page {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
}

.filter-bar {
  margin-bottom: 16px;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.product-category {
  font-size: 12px;
  color: #9ca3af;
}

.rating-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #f59e0b;
}

.rating-cell .el-icon {
  font-size: 14px;
}

.review-count {
  color: #9ca3af;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

/* Dark mode */
.dark .page-title {
  color: #f1f5f9;
}

.dark .product-name {
  color: #e2e8f0;
}

.dark .product-category {
  color: #94a3b8;
}

/* Responsive */
@media (max-width: 768px) {
  .creator-products-page {
    padding: 16px;
  }

  .page-header {
    flex-wrap: wrap;
  }

  .action-buttons {
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
}
</style>
