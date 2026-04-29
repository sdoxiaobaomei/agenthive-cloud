/**
 * 提现 Mock API 组合式函数
 * Mock Withdraw API Composable
 *
 * 设计原则：
 * - 封装提现业务逻辑，组件层不直接操作 Store
 * - 后端 API 就绪时，替换此文件中的 mock 实现为真实 API 调用
 * - 保留统一的接口契约：IWithdrawResult
 */

import { computed } from 'vue'
import { useCreditsStore } from '~/stores/credits'

/** 提现结果 */
export interface IWithdrawResult {
  success: boolean
  withdrawalId?: string
}

/** 法币汇率 */
const EXCHANGE_RATE = 0.1 // 1 credit = 0.1 CNY

/** 平台手续费率 */
const FEE_RATE = 0.1 // 10%

/** 最低提现金额 */
const MIN_WITHDRAW_AMOUNT = 100 // credits

/**
 * 计算法币价格
 * @param credits Credits 数量
 * @returns 法币金额（2位小数）
 */
function calculateFiatPrice(credits: number): number {
  return Number((credits * EXCHANGE_RATE).toFixed(2))
}

/**
 * 计算手续费
 * @param amount 提现金额
 * @returns 手续费（2位小数）
 */
export function calculateWithdrawFee(amount: number): number {
  return Number((amount * FEE_RATE).toFixed(2))
}

/**
 * 计算实际到账金额
 * @param amount 提现金额
 * @returns 到账金额（2位小数）
 */
export function calculateNetAmount(amount: number): number {
  return Number((amount - calculateWithdrawFee(amount)).toFixed(2))
}

export function useMockWithdraw() {
  const store = useCreditsStore()

  /**
   * 可提现余额
   */
  const availableBalance = computed(() => store.withdrawableBalance)

  /**
   * 执行提现申请
   * @param amount 提现金额
   * @param accountType 到账账户类型
   * @param accountInfo 账户信息（脱敏）
   * @returns 提现结果
   */
  const withdraw = async (
    amount: number,
    accountType: 'alipay' | 'wechat' | 'bank',
    accountInfo: string,
  ): Promise<IWithdrawResult> => {
    await store.withdraw(amount, accountType, accountInfo)
    return { success: true, withdrawalId: store.withdrawals[0]?.id }
  }

  return {
    /** 加载状态 */
    loading: store.loading,
    /** 法币汇率 */
    exchangeRate: EXCHANGE_RATE,
    /** 手续费率 */
    feeRate: FEE_RATE,
    /** 最低提现金额 */
    minAmount: MIN_WITHDRAW_AMOUNT,
    /** 可提现余额 */
    availableBalance,
    /** 计算法币价格 */
    calculateFiat: calculateFiatPrice,
    /** 计算手续费 */
    calculateFee: calculateWithdrawFee,
    /** 计算到账金额 */
    calculateNet: calculateNetAmount,
    /** 执行提现 */
    withdraw,
  }
}
