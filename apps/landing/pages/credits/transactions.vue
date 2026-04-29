<template>
  <div class="transactions-page">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        Back
      </el-button>
      <h1 class="page-title">Transaction History</h1>
      <div class="header-spacer" />
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <el-radio-group v-model="txMock.filterType.value" size="small" @change="handleFilterChange">
        <el-radio-button label="all">All</el-radio-button>
        <el-radio-button label="income">Income</el-radio-button>
        <el-radio-button label="expense">Expense</el-radio-button>
      </el-radio-group>
    </div>

    <!-- Table -->
    <div class="table-card">
      <DataTable
        :columns="txColumns"
        :data="txMock.transactions.value"
        :loading="txMock.loading.value"
        :pagination="txMock.pagination.value"
        empty-text="No transactions found"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #type="{ row }">
          <div class="type-cell">
            <el-icon
              class="type-icon"
              :class="row.type"
            >
              <ArrowUp v-if="row.type === 'income'" />
              <ArrowDown v-else-if="row.type === 'expense'" />
              <Minus v-else />
            </el-icon>
            <span class="type-label">{{ row.type }}</span>
          </div>
        </template>

        <template #amount="{ row }">
          <span class="amount-text" :class="row.type">
            {{ row.amount > 0 ? '+' : '' }}{{ row.amount.toFixed(2) }}
          </span>
        </template>

        <template #source="{ row }">
          <span class="source-text">{{ formatSource(row.source) }}</span>
        </template>

        <template #createdAt="{ row }">
          <span class="time-text">{{ formatDate(row.createdAt) }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue'
import DataTable from '~/components/economy/DataTable.vue'
import { useMockTransactions } from '~/composables/useMockTransactions'
import type { IDataTableColumn } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const txMock = useMockTransactions({ pageSize: 10 })

const goBack = () => router.push('/credits')

const txColumns: IDataTableColumn[] = [
  { prop: 'type', label: 'Type', width: 120, slot: 'type' },
  { prop: 'description', label: 'Description', minWidth: 240 },
  { prop: 'source', label: 'Source', width: 140, slot: 'source' },
  { prop: 'amount', label: 'Amount', width: 120, align: 'right', slot: 'amount' },
  { prop: 'balance', label: 'Balance', width: 130, align: 'right' },
  { prop: 'createdAt', label: 'Time', width: 170, align: 'right', slot: 'createdAt' },
]

const handleFilterChange = (val: string) => {
  txMock.setFilter(val as 'all' | 'income' | 'expense')
}

const handlePageChange = (page: number) => {
  txMock.setPage(page)
}

const handlePageSizeChange = (size: number) => {
  txMock.setPageSize(size)
}

const formatSource = (source: string): string => {
  const map: Record<string, string> = {
    sale: 'Sale',
    purchase: 'Purchase',
    recharge: 'Recharge',
    withdraw: 'Withdraw',
    fee: 'Fee',
    refund: 'Refund',
    reward: 'Reward',
    transfer: 'Transfer',
  }
  return map[source] ?? source
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.transactions-page {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
  text-align: center;
}

.dark .page-title {
  color: #e2e8f0;
}

.header-spacer {
  width: 60px;
}

.filter-bar {
  margin-bottom: 16px;
}

.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.dark .table-card {
  background: #1e293b;
  border-color: #334155;
}

.type-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-icon {
  font-size: 14px;
}

.type-icon.income {
  color: #10b981;
}

.type-icon.expense {
  color: #ef4444;
}

.type-icon.fee {
  color: #9ca3af;
}

.type-label {
  font-size: 13px;
  text-transform: capitalize;
  color: #374151;
}

.dark .type-label {
  color: #e2e8f0;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-text.income {
  color: #10b981;
}

.amount-text.expense {
  color: #ef4444;
}

.amount-text.fee {
  color: #9ca3af;
}

.source-text {
  font-size: 13px;
  color: #6b7280;
}

.dark .source-text {
  color: #94a3b8;
}

.time-text {
  font-size: 12px;
  color: #9ca3af;
}

.dark .time-text {
  color: #94a3b8;
}

@media (max-width: 768px) {
  .transactions-page {
    padding: 16px;
  }
}
</style>
