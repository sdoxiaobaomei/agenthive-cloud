<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Goods,
  ShoppingBag,
  Coin,
  Calendar,
  TrendCharts,
  Download,
  ArrowRight,
  Shop,
  Star,
  Money,
} from '@element-plus/icons-vue'
import DataCard from '~/components/economy/DataCard.vue'
import TrendChart from '~/components/economy/TrendChart.vue'
import DataTable from '~/components/economy/DataTable.vue'
import { useMockCreator } from '~/composables/useMockApi'
import type { IDataTableColumn, ITrendDataPoint, TrendTimeRange } from '~/types/economy'
import type { ICreatorSale } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const creator = useMockCreator()

// Trend chart range
const chartRange = ref<TrendTimeRange>('30d')

const trendData = computed<ITrendDataPoint[]>(() =>
  creator.earnings.value.map((e) => ({ date: e.date, value: e.amount }))
)

const handleRangeChange = (range: TrendTimeRange) => {
  chartRange.value = range
}

// Recent sales columns
const recentSalesColumns = computed(() => [
  { prop: 'productName', label: 'Product', minWidth: 200 },
  { prop: 'buyerName', label: 'Buyer', width: 140 },
  {
    prop: 'price',
    label: 'Price',
    width: 120,
    align: 'right',
    formatter: (_row, _col, val) => `<span class="tabular-nums">${val} credits</span>`,
  },
  {
    prop: 'netEarning',
    label: 'Net',
    width: 120,
    align: 'right',
    formatter: (_row, _col, val: number) => `<span class="text-emerald-600 font-medium tabular-nums">+${val.toFixed(2)}</span>`,
  },
  {
    prop: 'createdAt',
    label: 'Time',
    width: 160,
    align: 'right',
    formatter: (_row, _col, val: string) => formatDateTime(val),
  },
] as IDataTableColumn<ICreatorSale>[])

const recentSales = computed(() => creator.sales.value.slice(0, 5))

// Guidance page helpers
const goToPublish = () => router.push('/creator/products/new')
const goToEarnings = () => router.push('/creator/earnings')

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  <div class="creator-page">
    <!-- Non-seller guidance -->
    <template v-if="!creator.isSeller.value">
      <div class="guidance-page">
        <div class="guidance-hero">
          <div class="guidance-icon">
            <el-icon :size="48"><Shop /></el-icon>
          </div>
          <h1 class="guidance-title">Become a Creator</h1>
          <p class="guidance-desc">
            Turn your digital creations into income. Sell templates, components, plugins, and more on the AgentHive Marketplace.
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

    <!-- Creator dashboard -->
    <template v-else>
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Creator Center</h1>
        <div class="header-actions">
          <el-button type="primary" @click="goToPublish">
            <el-icon><Plus /></el-icon>
            New Product
          </el-button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <DataCard
          title="Products"
          :value="creator.stats.value.totalProducts"
          suffix="items"
          color="primary"
          :loading="creator.loading.value"
        >
          <template #icon>
            <el-icon><Goods /></el-icon>
          </template>
        </DataCard>
        <DataCard
          title="Total Sales"
          :value="creator.stats.value.totalSales"
          suffix="orders"
          color="success"
          :loading="creator.loading.value"
        >
          <template #icon>
            <el-icon><ShoppingBag /></el-icon>
          </template>
        </DataCard>
        <DataCard
          title="Total Earnings"
          :value="creator.stats.value.totalEarnings.toFixed(2)"
          suffix="credits"
          color="warning"
          :loading="creator.loading.value"
        >
          <template #icon>
            <el-icon><Coin /></el-icon>
          </template>
        </DataCard>
        <DataCard
          title="This Month"
          :value="creator.stats.value.monthlyEarnings.toFixed(2)"
          suffix="credits"
          color="info"
          :loading="creator.loading.value"
        >
          <template #icon>
            <el-icon><Calendar /></el-icon>
          </template>
        </DataCard>
      </div>

      <!-- Earnings Chart -->
      <TrendChart
        :data="trendData"
        title="Earnings Trend"
        :height="280"
        :loading="creator.loading.value"
        :time-range="chartRange"
        @change-range="handleRangeChange"
      />

      <!-- Recent Sales -->
      <div class="sales-section">
        <div class="section-header">
          <h2 class="section-title">Recent Sales</h2>
          <el-button text @click="goToEarnings">
            View All
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <DataTable
          :columns="(recentSalesColumns as any)"
          :data="recentSales"
          :loading="creator.loading.value"
          :stripe="true"
          empty-text="No recent sales"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.creator-page {
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

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.sales-section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

/* Guidance Page */
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
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .guidance-features {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .creator-page {
    padding: 16px;
  }
  .stats-grid {
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
}
</style>
