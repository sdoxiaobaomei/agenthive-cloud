<template>
  <div class="credits-page">
    <!-- Balance Card -->
    <div class="balance-card">
      <div class="balance-section">
        <span class="balance-label">Current Balance</span>
        <div class="balance-value">
          <span class="balance-number">{{ animatedBalance.toFixed(4) }}</span>
          <span class="balance-unit">credits</span>
        </div>
        <span class="balance-fiat">
          ≈ ¥{{ ((mockCredits.account.value?.balance ?? 0) * 0.1).toFixed(2) }}
        </span>
      </div>
      <div class="balance-actions">
        <el-button type="primary" size="large" @click="goToRecharge">
          <el-icon><Wallet /></el-icon>
          Recharge
        </el-button>
        <el-button size="large" @click="goToWithdraw">
          <el-icon><Money /></el-icon>
          Withdraw
        </el-button>
        <el-button size="large" @click="goToTransactions">
          <el-icon><List /></el-icon>
          History
        </el-button>
      </div>
    </div>

    <!-- Stats + Chart Row -->
    <div class="stats-row">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
        <DataCard
          title="Total Income"
          :value="mockCredits.totalIncome.value.toFixed(2)"
          prefix="+"
          color="success"
        />
        <DataCard
          title="Total Expense"
          :value="mockCredits.totalExpense.value.toFixed(2)"
          prefix="-"
          color="danger"
        />
        <DataCard
          title="Net Balance"
          :value="netAmount.toFixed(2)"
          :prefix="netAmount >= 0 ? '+' : ''"
          color="primary"
        />
        <DataCard
          title="Available"
          :value="(mockCredits.account.value?.availableBalance ?? 0).toFixed(4)"
          suffix="credits"
          color="info"
        />
      </div>
    </div>

    <div class="stats-row">
      <!-- Pie Chart -->
      <PieChart
        title="Income Sources (30 Days)"
        :data="pieData"
        :dark="isDark"
        :height="260"
        donut
        center-text="Total"
        :center-subtext="`${mockCredits.totalIncome.value.toFixed(0)} credits`"
      />

      <!-- Recent Transactions -->
      <div class="recent-card">
        <div class="card-header">
          <h3 class="card-title">Recent Transactions</h3>
          <el-button text size="small" @click="goToTransactions">View All</el-button>
        </div>
        <div class="transaction-list">
          <div
            v-for="tx in recentTransactions"
            :key="tx.id"
            class="transaction-item"
          >
            <div class="tx-icon" :class="tx.type">
              <el-icon v-if="tx.type === 'income'"><ArrowUp /></el-icon>
              <el-icon v-else-if="tx.type === 'expense'"><ArrowDown /></el-icon>
              <el-icon v-else><Minus /></el-icon>
            </div>
            <div class="tx-info">
              <span class="tx-desc">{{ tx.description }}</span>
              <span class="tx-time">{{ formatRelativeTime(tx.createdAt) }}</span>
            </div>
            <div class="tx-amount" :class="tx.type">
              <span class="tx-value">{{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toFixed(2) }}</span>
              <span class="tx-balance">{{ tx.balance.toFixed(4) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Wallet,
  Money,
  List,
  ArrowUp,
  ArrowDown,
  Minus,
} from '@element-plus/icons-vue'
import DataCard from '~/components/economy/DataCard.vue'
import PieChart from '~/components/economy/PieChart.vue'
import { useMockCredits } from '~/composables/useMockCredits'
import type { IPieChartItem } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const mockCredits = useMockCredits()
const isDark = ref(false)
let themeMql: MediaQueryList | null = null

onMounted(() => {
  if (import.meta.client) {
    themeMql = window.matchMedia('(prefers-color-scheme: dark)')
    isDark.value = themeMql.matches
    const handler = (e: MediaQueryListEvent) => { isDark.value = e.matches }
    themeMql.addEventListener('change', handler)
  }
})

const animatedBalance = ref(0)
let animFrame: number | null = null

const recentTransactions = computed(() =>
  mockCredits.transactions.value.slice(0, 5)
)

const netAmount = computed(() =>
  mockCredits.totalIncome.value - mockCredits.totalExpense.value
)

const goToRecharge = () => router.push('/credits/recharge')
const goToWithdraw = () => router.push('/credits/withdraw')
const goToTransactions = () => router.push('/credits/transactions')

// Animate balance number: 0 -> target in 800ms with easeOutCubic
const animateBalance = (target: number, duration = 800) => {
  const startTime = performance.now()
  const from = 0

  const step = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    // easeOutCubic
    const ease = 1 - Math.pow(1 - progress, 3)
    animatedBalance.value = from + (target - from) * ease
    if (progress < 1) {
      animFrame = requestAnimationFrame(step)
    }
  }

  animFrame = requestAnimationFrame(step)
}

// Pie chart data
const pieData = computed<IPieChartItem[]>(() => {
  const sources: Record<string, number> = {}
  mockCredits.transactions.value
    .filter(t => t.type === 'income')
    .forEach(t => {
      sources[t.source] = (sources[t.source] || 0) + t.amount
    })
  return Object.entries(sources).map(([name, value]) => ({
    name: name === 'sale' ? 'Sales' : name === 'recharge' ? 'Recharge' : name.charAt(0).toUpperCase() + name.slice(1),
    value: Math.round(value * 100) / 100,
  }))
})

onMounted(() => {
  const target = mockCredits.account.value?.balance ?? 0
  animateBalance(target, 800)
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
</script>

<style scoped>
.credits-page {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

/* Balance Card */
.balance-card {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 16px;
  padding: 32px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.balance-label {
  font-size: 14px;
  opacity: 0.8;
}

.balance-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
}

.balance-number {
  font-size: 36px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.balance-unit {
  font-size: 16px;
  opacity: 0.8;
}

.balance-fiat {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 4px;
  display: block;
}

.balance-actions {
  display: flex;
  gap: 12px;
}

.balance-actions :deep(.el-button) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.balance-actions :deep(.el-button--primary) {
  background: #ffffff;
  border-color: #ffffff;
  color: #4f46e5;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

/* Recent Card */
.recent-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.dark .recent-card {
  background: #1e293b;
  border-color: #334155;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.dark .card-title {
  color: #e2e8f0;
}

.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.transaction-item:hover {
  background: #f9fafb;
}

.dark .transaction-item:hover {
  background: #334155;
}

.tx-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tx-icon.income { background: #ecfdf5; color: #10b981; }
.tx-icon.expense { background: #fef2f2; color: #ef4444; }
.tx-icon.fee { background: #f3f4f6; color: #9ca3af; }

.dark .tx-icon.income { background: rgba(16, 185, 129, 0.15); }
.dark .tx-icon.expense { background: rgba(239, 68, 68, 0.15); }
.dark .tx-icon.fee { background: rgba(148, 163, 184, 0.15); }

.tx-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tx-desc {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.dark .tx-desc {
  color: #e2e8f0;
}

.tx-time {
  font-size: 12px;
  color: #9ca3af;
}

.dark .tx-time {
  color: #94a3b8;
}

.tx-amount {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tx-value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.tx-amount.income .tx-value { color: #10b981; }
.tx-amount.expense .tx-value { color: #ef4444; }
.tx-amount.fee .tx-value { color: #9ca3af; }

.tx-balance {
  font-size: 12px;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}

.dark .tx-balance {
  color: #94a3b8;
}

/* Responsive */
@media (max-width: 768px) {
  .credits-page {
    padding: 16px;
  }

  .balance-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .balance-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
