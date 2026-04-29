<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Download,
  Filter,
  Shop,
  Star,
  TrendCharts,
  Money,
} from '@element-plus/icons-vue'
import DataCard from '~/components/economy/DataCard.vue'
import DataTable from '~/components/economy/DataTable.vue'
import { useMockCreator } from '~/composables/useMockApi'
import { useMockSales } from '~/composables/useMockSales'
import type { IDataTableColumn } from '~/types/economy'
import type { ICreatorSale } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const creator = useMockCreator()
const sales = useMockSales()

const showCustomDatePicker = ref(false)
const customStart = ref('')
const customEnd = ref('')

const dateRangeOptions = [
  { label: 'Last 7 Days', value: '7d' as const },
  { label: 'Last 30 Days', value: '30d' as const },
  { label: 'Last 90 Days', value: '90d' as const },
  { label: 'Custom', value: 'custom' as const },
]

const activeRangeLabel = computed(() =>
  dateRangeOptions.find((o) => o.value === sales.dateRange.value)?.label || 'All Time'
)

const handleRangeChange = (range: '7d' | '30d' | '90d' | 'custom') => {
  if (range === 'custom') {
    showCustomDatePicker.value = true
  } else {
    sales.setDateRange(range)
  }
}

const applyCustomRange = () => {
  if (!customStart.value || !customEnd.value) {
    ElMessage.warning('Please select both start and end dates')
    return
  }
  sales.setDateRange('custom', customStart.value, customEnd.value)
  showCustomDatePicker.value = false
}

const goBack = () => router.push('/creator')

const handleExportCSV = () => {
  if (import.meta.client) {
    sales.exportToCSV()
    ElMessage.success('CSV exported successfully')
  }
}

// Summary cards data
const summaryCards = computed(() => [
  {
    title: 'Total Earnings',
    value: sales.totalEarnings.value.toFixed(2),
    suffix: 'credits',
    color: 'primary' as const,
  },
  {
    title: 'Platform Fees',
    value: sales.totalPlatformFees.value.toFixed(2),
    suffix: 'credits',
    color: 'danger' as const,
  },
  {
    title: 'Net Earnings',
    value: sales.totalNetEarnings.value.toFixed(2),
    suffix: 'credits',
    color: 'success' as const,
  },
])

// DataTable columns
const salesColumns = computed(() => [
  {
    prop: 'createdAt',
    label: 'Date',
    width: 170,
    sortable: true,
    formatter: (_row, _col, val: string) => formatDateTime(val),
  },
  { prop: 'productName', label: 'Product', minWidth: 220 },
  { prop: 'buyerName', label: 'Buyer', width: 140 },
  {
    prop: 'price',
    label: 'Price',
    width: 120,
    align: 'right',
    sortable: true,
    formatter: (_row, _col, val: number) => `<span class="tabular-nums">${val.toFixed(2)}</span>`,
  },
  {
    prop: 'platformFee',
    label: 'Platform Fee',
    width: 130,
    align: 'right',
    sortable: true,
    formatter: (_row, _col, val: number) => `<span class="text-red-500 tabular-nums">-${val.toFixed(2)}</span>`,
  },
  {
    prop: 'netEarning',
    label: 'Net',
    width: 120,
    align: 'right',
    sortable: true,
    formatter: (_row, _col, val: number) => `<span class="text-emerald-600 font-medium tabular-nums">+${val.toFixed(2)}</span>`,
  },
] as IDataTableColumn<ICreatorSale>[])

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Mock apply to become creator
const applyToBeCreator = () => {
  ElMessage.success('Application submitted! Mock approval in 3 seconds...')
  setTimeout(() => {
    creator.isSeller.value = true
    ElMessage.success('You are now a creator!')
  }, 3000)
}
</script>

<template>
  <div class="earnings-page">
    <!-- Non-seller guidance -->
    <template v-if="!creator.isSeller.value">
      <div class="guidance-page">
        <div class="guidance-hero">
          <div class="guidance-icon">
            <el-icon :size="48"><Shop /></el-icon>
          </div>
          <h1 class="guidance-title">Become a Creator</h1>
          <p class="guidance-desc">
            Access your earnings dashboard, track sales, and manage your products by becoming a creator.
          </p>
          <el-button type="primary" size="large" @click="applyToBeCreator">
            <el-icon><Star /></el-icon>
            Apply to Become a Creator
          </el-button>
        </div>

        <div class="guidance-features">
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon><Money /></el-icon>
            </div>
            <h3 class="feature-title">Keep 80% Revenue</h3>
            <p class="feature-desc">Industry-leading revenue share. You keep 80% of every sale.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon><TrendCharts /></el-icon>
            </div>
            <h3 class="feature-title">Global Reach</h3>
            <p class="feature-desc">Access thousands of developers looking for quality digital products.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">
              <el-icon><Shop /></el-icon>
            </div>
            <h3 class="feature-title">Instant Delivery</h3>
            <p class="feature-desc">Automated delivery and licensing. Focus on creating, we handle the rest.</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Earnings page -->
    <template v-else>
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <el-button text @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            Back
          </el-button>
          <h1 class="page-title">Earnings Detail</h1>
        </div>
        <el-button type="primary" @click="handleExportCSV">
          <el-icon><Download /></el-icon>
          Export CSV
        </el-button>
      </div>

      <!-- Summary Cards -->
      <div class="summary-grid">
        <DataCard
          v-for="card in summaryCards"
          :key="card.title"
          :title="card.title"
          :value="card.value"
          :suffix="card.suffix"
          :color="card.color"
          :loading="sales.loading.value"
        />
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-label">
          <el-icon><Filter /></el-icon>
          <span>Date Range:</span>
        </div>
        <div class="filter-options">
          <button
            v-for="opt in dateRangeOptions"
            :key="opt.value"
            class="filter-btn"
            :class="{ active: sales.dateRange.value === opt.value }"
            @click="handleRangeChange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div v-if="sales.dateRange.value === 'custom' && !showCustomDatePicker" class="custom-range-display">
          {{ customStart || sales.customStartDate.value }} ~ {{ customEnd || sales.customEndDate.value }}
        </div>
      </div>

      <!-- Custom Date Picker -->
      <div v-if="showCustomDatePicker" class="custom-date-picker">
        <el-date-picker
          v-model="customStart"
          type="date"
          placeholder="Start Date"
          value-format="YYYY-MM-DD"
          class="date-input"
        />
        <span class="date-separator">to</span>
        <el-date-picker
          v-model="customEnd"
          type="date"
          placeholder="End Date"
          value-format="YYYY-MM-DD"
          class="date-input"
        />
        <el-button type="primary" @click="applyCustomRange">Apply</el-button>
        <el-button text @click="showCustomDatePicker = false">Cancel</el-button>
      </div>

      <!-- Sales Table -->
      <div class="table-section">
        <DataTable
          :columns="(salesColumns as any)"
          :data="sales.filteredSales.value"
          :loading="sales.loading.value"
          :stripe="true"
          empty-text="No sales found for selected date range"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.earnings-page {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.filter-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  border-color: #d1d5db;
  color: #374151;
}

.filter-btn.active {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #ffffff;
}

.custom-range-display {
  font-size: 13px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 10px;
  border-radius: 6px;
}

.custom-date-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.date-separator {
  font-size: 13px;
  color: #9ca3af;
}

.date-input {
  width: 160px;
}

.table-section {
  margin-top: 8px;
}

/* Guidance Page (shared styles with creator/index) */
.guidance-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 32px 0;
}

.guidance-hero {
  text-align: center;
  padding: 48px 24px;
  background: linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%);
  border-radius: 16px;
  border: 1px solid #c7d2fe;
}

.guidance-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: #4f46e5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.guidance-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e1b4b;
  margin: 0 0 12px;
}

.guidance-desc {
  font-size: 15px;
  color: #4338ca;
  max-width: 480px;
  margin: 0 auto 24px;
  line-height: 1.6;
}

.guidance-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto 12px;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.feature-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .guidance-features {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .earnings-page {
    padding: 16px;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .guidance-features {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .header-left {
    width: 100%;
  }
  .filter-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .custom-date-picker {
    flex-direction: column;
    align-items: stretch;
  }
  .date-input {
    width: 100%;
  }
}
</style>
