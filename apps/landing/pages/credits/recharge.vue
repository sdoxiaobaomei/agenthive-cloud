<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Wallet,
  ChatDotRound,
} from '@element-plus/icons-vue'
import AmountInput from '~/components/economy/AmountInput.vue'
import ConfirmDialog from '~/components/economy/ConfirmDialog.vue'
import { useMockRecharge } from '~/composables/useMockRecharge'

definePageMeta({
  layout: 'app',
})

const router = useRouter()
const mockRecharge = useMockRecharge()

const quickAmounts = [10, 50, 100, 500, 1000]
const selectedAmount = ref<number | null>(100)
const customAmount = ref(0)
const paymentMethod = ref<'alipay' | 'wechat'>('alipay')
const showConfirm = ref(false)

const finalAmount = computed(() => selectedAmount.value ?? customAmount.value)

const fiatTotal = computed(() =>
  mockRecharge.calculateFiat(finalAmount.value)
)

const confirmMessage = computed(() =>
  `Recharge ${finalAmount.value} credits for ¥${fiatTotal.value} via ${paymentMethod.value === 'alipay' ? 'Alipay' : 'WeChat Pay'}?`
)

const selectAmount = (amt: number) => {
  selectedAmount.value = amt
  customAmount.value = 0
}

const onCustomChange = () => {
  selectedAmount.value = null
}

const goBack = () => router.push('/credits')

const openConfirm = () => {
  const amount = finalAmount.value
  if (amount < 1) {
    ElMessage.warning('Minimum recharge amount is 1 credit')
    return
  }
  showConfirm.value = true
}

const handleConfirm = async () => {
  try {
    await mockRecharge.recharge(finalAmount.value, paymentMethod.value)
    ElMessage.success(`Successfully recharged ${finalAmount.value} credits!`)
    showConfirm.value = false
    router.push('/credits')
  } catch (err: any) {
    ElMessage.error(err.message || 'Recharge failed')
  }
}
</script>

<template>
  <div class="recharge-page">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        Back
      </el-button>
      <h1 class="page-title">Recharge Credits</h1>
      <div class="header-spacer" />
    </div>

    <div class="recharge-card">
      <!-- Quick Amounts -->
      <div class="amount-section">
        <h3 class="section-title">Select Amount</h3>
        <div class="quick-amounts">
          <div
            v-for="amt in quickAmounts"
            :key="amt"
            class="amount-chip"
            :class="{ active: selectedAmount === amt }"
            @click="selectAmount(amt)"
          >
            <span class="chip-credits">{{ amt }}</span>
            <span class="chip-fiat">¥{{ mockRecharge.calculateFiat(amt) }}</span>
          </div>
        </div>
      </div>

      <!-- Custom Amount -->
      <div class="custom-section">
        <AmountInput
          v-model="customAmount"
          label="Or Enter Custom Amount"
          :min="1"
          :exchange-rate="mockRecharge.exchangeRate"
          placeholder="Enter amount"
          @change="onCustomChange"
        />
      </div>

      <!-- Payment Method -->
      <div class="payment-section">
        <h3 class="section-title">Payment Method</h3>
        <div class="payment-options">
          <div
            class="payment-option"
            :class="{ active: paymentMethod === 'alipay' }"
            @click="paymentMethod = 'alipay'"
          >
            <el-icon><Wallet /></el-icon>
            <span>Alipay</span>
          </div>
          <div
            class="payment-option"
            :class="{ active: paymentMethod === 'wechat' }"
            @click="paymentMethod = 'wechat'"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>WeChat Pay</span>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="summary-section">
        <div class="summary-row">
          <span>Amount</span>
          <span>{{ finalAmount }} credits</span>
        </div>
        <div class="summary-row">
          <span>Exchange Rate</span>
          <span>1 credit = ¥{{ mockRecharge.exchangeRate }}</span>
        </div>
        <div class="summary-row total">
          <span>Total Pay</span>
          <span>¥{{ fiatTotal }}</span>
        </div>
      </div>

      <!-- Action -->
      <el-button
        type="primary"
        size="large"
        style="width: 100%; margin-top: 8px;"
        :loading="mockRecharge.loading"
        @click="openConfirm"
      >
        Pay Now
      </el-button>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model:visible="showConfirm"
      title="Confirm Recharge"
      :message="confirmMessage"
      type="primary"
      confirm-text="Pay"
      :loading="mockRecharge.loading"
      @confirm="handleConfirm"
    />
  </div>
</template>

<style scoped>
.recharge-page {
  padding: 24px 32px;
  max-width: 600px;
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

.recharge-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dark .recharge-card {
  background: #1e293b;
  border-color: #334155;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px;
}

.dark .section-title {
  color: #94a3b8;
}

/* Quick Amounts */
.quick-amounts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.amount-chip {
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dark .amount-chip {
  border-color: #334155;
}

.amount-chip:hover {
  border-color: #c7c8d1;
}

.dark .amount-chip:hover {
  border-color: #475569;
}

.amount-chip.active {
  border-color: #4f46e5;
  background: #eef2ff;
}

.dark .amount-chip.active {
  background: rgba(79, 70, 229, 0.15);
  border-color: #6366f1;
}

.chip-credits {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.dark .chip-credits {
  color: #e2e8f0;
}

.chip-fiat {
  font-size: 12px;
  color: #9ca3af;
}

.dark .chip-fiat {
  color: #94a3b8;
}

/* Payment */
.payment-options {
  display: flex;
  gap: 12px;
}

.payment-option {
  flex: 1;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.dark .payment-option {
  border-color: #334155;
  color: #cbd5e1;
}

.payment-option:hover {
  border-color: #c7c8d1;
}

.dark .payment-option:hover {
  border-color: #475569;
}

.payment-option.active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4f46e5;
}

.dark .payment-option.active {
  background: rgba(79, 70, 229, 0.15);
  border-color: #6366f1;
  color: #818cf8;
}

/* Summary */
.summary-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dark .summary-section {
  background: #0f172a;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #6b7280;
}

.dark .summary-row {
  color: #94a3b8;
}

.summary-row.total {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  border-top: 1px solid #e5e7eb;
  padding-top: 10px;
}

.dark .summary-row.total {
  color: #e2e8f0;
  border-color: #334155;
}

@media (max-width: 768px) {
  .recharge-page {
    padding: 16px;
  }

  .quick-amounts {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
