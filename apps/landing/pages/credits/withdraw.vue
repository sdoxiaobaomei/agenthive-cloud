<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  ChatDotRound,
} from '@element-plus/icons-vue'
import AmountInput from '~/components/economy/AmountInput.vue'
import ConfirmDialog from '~/components/economy/ConfirmDialog.vue'
import DataTable from '~/components/economy/DataTable.vue'
import { useMockWithdraw } from '~/composables/useMockWithdraw'
import { useCreditsStore } from '~/stores/credits'
import type { IDataTableColumn, ICreditsWithdrawal } from '~/types/economy'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const mockWithdraw = useMockWithdraw()
const creditsStore = useCreditsStore()

const amount = ref(100)
const accountType = ref<'alipay' | 'wechat' | 'bank'>('alipay')
const showConfirm = ref(false)

const fee = computed(() => mockWithdraw.calculateFee(amount.value))
const netAmount = computed(() => mockWithdraw.calculateNet(amount.value))

const confirmMessage = computed(() =>
  `Withdraw ${amount.value} credits (fee: ${fee.value}, net: ${netAmount.value}) to ${accountLabel.value} ${accountInfo.value}?`
)

const accountLabel = computed(() => {
  const map: Record<string, string> = {
    alipay: 'Alipay',
    wechat: 'WeChat',
    bank: 'Bank Card',
  }
  return map[accountType.value] || accountType.value
})

const accountInfo = computed(() => {
  const map: Record<string, string> = {
    alipay: '188****8888',
    wechat: 'wx***zhang',
    bank: '6222****1234',
  }
  return map[accountType.value] || ''
})

const isValidAmount = computed(() => {
  const amt = amount.value
  return amt >= mockWithdraw.minAmount && amt <= creditsStore.withdrawableBalance
})

const goBack = () => router.push('/credits')

const openConfirm = () => {
  if (amount.value < mockWithdraw.minAmount) {
    ElMessage.warning(`Minimum withdrawal is ${mockWithdraw.minAmount} credits`)
    return
  }
  if (amount.value > creditsStore.withdrawableBalance) {
    ElMessage.warning('Insufficient balance')
    return
  }
  showConfirm.value = true
}

const handleConfirm = async () => {
  try {
    await mockWithdraw.withdraw(amount.value, accountType.value, accountInfo.value)
    ElMessage.success('Withdrawal request submitted! Under review.')
    showConfirm.value = false
    // Stay on page to show updated history
  } catch (err: any) {
    ElMessage.error(err.message || 'Withdrawal failed')
  }
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

const columns = computed((): IDataTableColumn<ICreditsWithdrawal>[] => [
  {
    prop: 'createdAt',
    label: 'Time',
    width: 160,
    formatter: (row: ICreditsWithdrawal) => formatDate(row.createdAt),
  },
  {
    prop: 'amount',
    label: 'Amount',
    align: 'right',
    width: 120,
    formatter: (_row: ICreditsWithdrawal, _col: unknown, cellValue: unknown) =>
      `${Number(cellValue).toFixed(2)}`,
  },
  {
    prop: 'fee',
    label: 'Fee',
    align: 'right',
    width: 100,
    formatter: (_row: ICreditsWithdrawal, _col: unknown, cellValue: unknown) =>
      `-${Number(cellValue).toFixed(2)}`,
  },
  {
    prop: 'netAmount',
    label: 'Net',
    align: 'right',
    width: 100,
    formatter: (_row: ICreditsWithdrawal, _col: unknown, cellValue: unknown) =>
      `${Number(cellValue).toFixed(2)}`,
  },
  {
    prop: 'accountInfo',
    label: 'Account',
    width: 140,
    formatter: (row: ICreditsWithdrawal) =>
      `${accountTypeMap[row.accountType] || row.accountType} ${row.accountInfo}`,
  },
  {
    prop: 'status',
    label: 'Status',
    width: 120,
    slot: 'status',
  },
])

const accountTypeMap: Record<string, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat',
  bank: 'Bank',
}
</script>

<template>
  <div class="withdraw-page">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        Back
      </el-button>
      <h1 class="page-title">Withdraw Credits</h1>
      <div class="header-spacer" />
    </div>

    <div class="withdraw-card">
      <!-- Balance Info -->
      <div class="balance-info">
        <span class="balance-label">Withdrawable Balance</span>
        <span class="balance-value">{{ creditsStore.withdrawableBalance.toFixed(4) }} credits</span>
        <span class="balance-fiat">≈ ¥{{ mockWithdraw.calculateFiat(creditsStore.withdrawableBalance) }}</span>
      </div>

      <!-- Amount Input -->
      <div class="amount-section">
        <AmountInput
          v-model="amount"
          label="Withdrawal Amount"
          :min="mockWithdraw.minAmount"
          :max="creditsStore.withdrawableBalance"
          :exchange-rate="mockWithdraw.exchangeRate"
          placeholder="Enter amount"
          :show-fiat="false"
        />
        <p class="hint">
          Minimum withdrawal: {{ mockWithdraw.minAmount }} credits
          <span v-if="amount < mockWithdraw.minAmount" class="hint-error">
            — amount too low
          </span>
          <span v-else-if="amount > creditsStore.withdrawableBalance" class="hint-error">
            — insufficient balance
          </span>
        </p>
      </div>

      <!-- Fee Preview -->
      <div class="fee-section">
        <div class="fee-row">
          <span>Withdrawal Amount</span>
          <span>{{ amount.toFixed(2) }} credits</span>
        </div>
        <div class="fee-row">
          <span>Platform Fee ({{ (mockWithdraw.feeRate * 100).toFixed(0) }}%)</span>
          <span class="fee-value">-{{ fee.toFixed(2) }} credits</span>
        </div>
        <div class="fee-row net">
          <span>Net Amount</span>
          <span class="net-value">{{ netAmount.toFixed(2) }} credits</span>
        </div>
        <div class="fee-row fiat">
          <span>≈ ¥{{ mockWithdraw.calculateFiat(netAmount) }}</span>
        </div>
      </div>

      <!-- Account Selection -->
      <div class="account-section">
        <h3 class="section-title">Receiving Account</h3>
        <div class="account-tabs">
          <div
            class="account-tab"
            :class="{ active: accountType === 'alipay' }"
            @click="accountType = 'alipay'"
          >
            <el-icon><Wallet /></el-icon>
            <span>Alipay</span>
          </div>
          <div
            class="account-tab"
            :class="{ active: accountType === 'wechat' }"
            @click="accountType = 'wechat'"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>WeChat</span>
          </div>
          <div
            class="account-tab"
            :class="{ active: accountType === 'bank' }"
            @click="accountType = 'bank'"
          >
            <el-icon><CreditCard /></el-icon>
            <span>Bank</span>
          </div>
        </div>
        <div class="account-detail">
          <el-icon><Wallet /></el-icon>
          <div class="account-detail-text">
            <span class="account-name">{{ accountLabel }}</span>
            <span class="account-mask">{{ accountInfo }}</span>
          </div>
        </div>
      </div>

      <!-- Action -->
      <el-button
        type="primary"
        size="large"
        style="width: 100%; margin-top: 8px;"
        :loading="mockWithdraw.loading"
        :disabled="!isValidAmount"
        @click="openConfirm"
      >
        Submit Withdrawal
      </el-button>

      <!-- Withdrawal History -->
      <div class="history-section">
        <h3 class="section-title">Withdrawal History</h3>
        <DataTable
          :columns="(columns as any)"
          :data="creditsStore.withdrawals"
          :loading="false"
          empty-text="No withdrawal records"
        >
          <template #status="{ row }">
            <el-tag
              :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'"
              size="small"
            >
              {{ row.status === 'pending' ? 'Under Review' : row.status }}
            </el-tag>
          </template>
        </DataTable>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model:visible="showConfirm"
      title="Confirm Withdrawal"
      :message="confirmMessage"
      type="warning"
      confirm-text="Confirm"
      :loading="mockWithdraw.loading"
      @confirm="handleConfirm"
    />
  </div>
</template>

<style scoped>
.withdraw-page {
  padding: 24px 32px;
  max-width: 720px;
  margin: 0 auto;
  min-height: 100%;
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

.dark .page-title {
  color: #e2e8f0;
}

.header-spacer {
  width: 60px;
}

.withdraw-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dark .withdraw-card {
  background: #1e293b;
  border-color: #334155;
}

/* Balance Info */
.balance-info {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 12px;
  padding: 20px;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-label {
  font-size: 13px;
  opacity: 0.8;
}

.balance-value {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.balance-fiat {
  font-size: 13px;
  opacity: 0.7;
}

/* Sections */
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.dark .section-title {
  color: #94a3b8;
}

.hint {
  font-size: 12px;
  color: #9ca3af;
  margin: 8px 0 0;
}

.hint-error {
  color: #ef4444;
  font-weight: 500;
}

.dark .hint {
  color: #94a3b8;
}

/* Fee Section */
.fee-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dark .fee-section {
  background: #0f172a;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #6b7280;
}

.dark .fee-row {
  color: #94a3b8;
}

.fee-row.net {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  border-top: 1px solid #e5e7eb;
  padding-top: 10px;
}

.dark .fee-row.net {
  color: #e2e8f0;
  border-color: #334155;
}

.fee-value {
  color: #ef4444;
}

.net-value {
  color: #10b981;
}

.fee-row.fiat {
  justify-content: flex-end;
  font-size: 13px;
  color: #9ca3af;
}

.dark .fee-row.fiat {
  color: #94a3b8;
}

/* Account Tabs */
.account-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.account-tab {
  flex: 1;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.dark .account-tab {
  border-color: #334155;
  color: #94a3b8;
}

.account-tab:hover {
  border-color: #c7c8d1;
  color: #374151;
}

.dark .account-tab:hover {
  border-color: #475569;
  color: #cbd5e1;
}

.account-tab.active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4f46e5;
}

.dark .account-tab.active {
  background: rgba(79, 70, 229, 0.15);
  border-color: #6366f1;
  color: #818cf8;
}

/* Account Detail */
.account-detail {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f9fafb;
  border-radius: 8px;
  color: #6b7280;
}

.dark .account-detail {
  background: #0f172a;
  color: #94a3b8;
}

.account-detail-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.dark .account-name {
  color: #cbd5e1;
}

.account-mask {
  font-size: 12px;
  color: #9ca3af;
}

.dark .account-mask {
  color: #94a3b8;
}

/* History */
.history-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 20px;
}

.dark .history-section {
  border-color: #334155;
}

@media (max-width: 768px) {
  .withdraw-page {
    padding: 16px;
  }

  .account-tabs {
    flex-wrap: wrap;
  }

  .account-tab {
    min-width: 80px;
  }
}
</style>
