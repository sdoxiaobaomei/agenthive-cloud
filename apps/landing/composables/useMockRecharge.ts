/**
 * 充值 Mock API 组合式函数
 * Mock Recharge API Composable
 *
 * 设计原则：
 * - 封装充值业务逻辑，组件层不直接操作 Store
 * - 后端 API 就绪时，替换此文件中的 mock 实现为真实 API 调用
 * - 保留统一的接口契约：IRechargeResult
 */

import { computed } from 'vue'
import { useCreditsStore } from '~/stores/credits'

/** 充值结果 */
export interface IRechargeResult {
  success: boolean
  transactionId?: string
}

/** 法币汇率配置（Mock） */
const EXCHANGE_RATE = 0.1 // 1 credit = 0.1 CNY

/**
 * 计算法币价格
 * @param credits Credits 数量
 * @returns 法币金额（2位小数）
 */
export function calculateFiatPrice(credits: number): number {
  return Number((credits * EXCHANGE_RATE).toFixed(2))
}

export function useMockRecharge() {
  const store = useCreditsStore()

  /**
   * 执行充值
   * @param amount 充值金额（credits）
   * @param method 支付方式
   * @returns 充值结果
   */
  const recharge = async (amount: number, method: 'alipay' | 'wechat'): Promise<IRechargeResult> => {
    await store.recharge(amount, method)
    return { success: true, transactionId: store.transactions[0]?.id }
  }

  return {
    /** 加载状态 */
    loading: store.loading,
    /** 法币汇率 */
    exchangeRate: EXCHANGE_RATE,
    /** 计算法币价格 */
    calculateFiat: calculateFiatPrice,
    /** 执行充值 */
    recharge,
  }
}
