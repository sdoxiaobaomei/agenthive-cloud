<script setup lang="ts">
import { ref, computed } from 'vue'
import DataCard from '~/components/economy/DataCard.vue'
import TrendChart from '~/components/economy/TrendChart.vue'
import PieChart from '~/components/economy/PieChart.vue'
import DataTable from '~/components/economy/DataTable.vue'
import AmountInput from '~/components/economy/AmountInput.vue'
import ConfirmDialog from '~/components/economy/ConfirmDialog.vue'
import { useMockCreator } from '~/composables/useMockApi'
import { useMockCredits } from '~/composables/useMockCredits'
import type { TrendTimeRange, IDataTableColumn, IPieChartItem, ITrendDataPoint } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const mockCredits = useMockCredits()
const mockCreator = useMockCreator()

const amount = ref(100)

// TrendChart
const trendRange = ref<TrendTimeRange>('30d')
const trendData = computed<ITrendDataPoint[]>(() => {
  const days = trendRange.value === '7d' ? 7 : trendRange.value === '30d' ? 30 : 90
  return mockCredits.earnings.value.slice(-days).map(p => ({
    date: p.date,
    value: p.amount,
  }))
})
const onTrendRangeChange = (range: TrendTimeRange) => {
  trendRange.value = range
}

// PieChart
const pieData = computed<IPieChartItem[]>(() => {
  const sources: Record<string, number> = {}
  mockCredits.transactions.value
    .filter(t => t.type === 'income')
    .forEach(t => {
      sources[t.source] = (sources[t.source] || 0) + t.amount
    })
  return Object.entries(sources).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Math.round(value * 100) / 100,
  }))
})

// DataTable - Transactions
const txColumns: IDataTableColumn[] = [
  { prop: 'createdAt', label: 'Time', width: 160, formatter: (row: any) => new Date(row.createdAt).toLocaleDateString() },
  { prop: 'type', label: 'Type', width: 100 },
  { prop: 'description', label: 'Description', minWidth: 200 },
  { prop: 'amount', label: 'Amount', width: 120, align: 'right' },
  { prop: 'balance', label: 'Balance', width: 120, align: 'right' },
]

// DataTable - Products
const productColumns: IDataTableColumn[] = [
  { prop: 'name', label: 'Product', minWidth: 200 },
  { prop: 'type', label: 'Type', width: 100 },
  { prop: 'creditsPrice', label: 'Price', width: 120, align: 'right' },
  { prop: 'salesCount', label: 'Sales', width: 100, align: 'right' },
  { prop: 'status', label: 'Status', width: 100 },
]

// DataTable - Sales
const saleColumns: IDataTableColumn[] = [
  { prop: 'createdAt', label: 'Time', width: 160, formatter: (row: any) => new Date(row.createdAt).toLocaleDateString() },
  { prop: 'productName', label: 'Product', minWidth: 180 },
  { prop: 'buyerName', label: 'Buyer', width: 120 },
  { prop: 'price', label: 'Price', width: 100, align: 'right' },
  { prop: 'netEarning', label: 'Net', width: 100, align: 'right' },
]

// ConfirmDialog
const showConfirm = ref(false)
const confirmLoading = ref(false)
const handleConfirm = () => {
  confirmLoading.value = true
  setTimeout(() => {
    confirmLoading.value = false
    showConfirm.value = false
  }, 1000)
}

// Dark mode toggle for preview
const isDark = ref(false)
</script>

<template>
  <div class="economy-preview" :class="{ dark: isDark }">
    <div class="preview-header">
      <h1 class="text-2xl font-bold text-slate-800 dark:text-white">Economy UI Components Preview</h1>
      <ElSwitch
        v-model="isDark"
        active-text="Dark"
        inactive-text="Light"
        inline-prompt
      />
    </div>

    <!-- Section: DataCard -->
    <section class="preview-section">
      <h2 class="section-title">DataCard</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DataCard
          title="Balance"
          :value="mockCredits.account.value.balance.toFixed(4)"
          suffix="credits"
          trend="up"
          trend-value="12.5%"
          trend-label="vs last month"
          color="primary"
        />
        <DataCard
          title="Total Sales"
          :value="String(mockCreator.stats.value.totalSales)"
          trend="up"
          trend-value="8.2%"
          color="success"
        />
        <DataCard
          title="Total Earnings"
          :value="mockCreator.stats.value.totalEarnings.toFixed(2)"
          prefix="¥"
          trend="up"
          trend-value="15.3%"
          color="warning"
        />
        <DataCard
          title="Monthly Earnings"
          :value="mockCreator.stats.value.monthlyEarnings.toFixed(2)"
          prefix="¥"
          trend="down"
          trend-value="3.1%"
          color="danger"
        />
      </div>
    </section>

    <!-- Section: TrendChart + PieChart -->
    <section class="preview-section">
      <h2 class="section-title">Charts</h2>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Earning Trend"
          :data="trendData"
          :time-range="trendRange"
          :dark="isDark"
          @change-range="onTrendRangeChange"
        />
        <PieChart
          title="Income Sources"
          :data="pieData"
          :dark="isDark"
          center-text="Total"
          :center-subtext="`${mockCredits.account.value.balance.toFixed(0)} credits`"
        />
      </div>
    </section>

    <!-- Section: DataTable -->
    <section class="preview-section">
      <h2 class="section-title">DataTable — Transactions</h2>
      <DataTable
        :columns="txColumns"
        :data="mockCredits.transactions.value.slice(0, 5)"
      />
    </section>

    <section class="preview-section">
      <h2 class="section-title">DataTable — Products</h2>
      <DataTable
        :columns="productColumns"
        :data="mockCreator.products.value"
      />
    </section>

    <section class="preview-section">
      <h2 class="section-title">DataTable — Sales</h2>
      <DataTable
        :columns="saleColumns"
        :data="mockCreator.sales.value.slice(0, 5)"
      />
    </section>

    <!-- Section: AmountInput -->
    <section class="preview-section">
      <h2 class="section-title">AmountInput</h2>
      <div class="max-w-md">
        <AmountInput
          v-model="amount"
          label="Recharge Amount"
          :min="10"
          :max="10000"
          :quick-amounts="[10, 50, 100, 500, 1000]"
        />
      </div>
    </section>

    <!-- Section: ConfirmDialog -->
    <section class="preview-section">
      <h2 class="section-title">ConfirmDialog</h2>
      <div class="flex gap-3">
        <ElButton type="warning" @click="showConfirm = true">Open Confirm</ElButton>
      </div>
      <ConfirmDialog
        v-model:visible="showConfirm"
        title="Confirm Withdrawal"
        message="You are about to withdraw 100 credits to your Alipay account. This action cannot be undone."
        type="warning"
        :loading="confirmLoading"
        confirm-text="Withdraw"
        @confirm="handleConfirm"
      />
    </section>
  </div>
</template>

<style scoped>
.economy-preview {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.preview-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.dark .section-title {
  color: #e2e8f0;
  border-color: #334155;
}

.dark {
  background: #0f172a;
}
</style>
