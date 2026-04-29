/**
 * 经济系统共享类型定义
 * Economy System Shared Type Definitions
 *
 * 设计原则：
 * - 所有接口以 `I` 前缀命名，与实现类/Store 类型区分
 * - 金额统一使用 number（credits 精度由组件层控制）
 * - 时间戳统一使用 ISO-8601 string
 * - 枚举使用 TypeScript 联合类型，便于 tree-shaking
 */

// ============================================
// Credits 中心类型
// ============================================

/** 流水类型 */
export type CreditsTransactionType = 'income' | 'expense' | 'fee'

/** 流水来源 */
export type CreditsTransactionSource =
  | 'sale'
  | 'purchase'
  | 'recharge'
  | 'withdraw'
  | 'fee'
  | 'refund'
  | 'reward'
  | 'transfer'

/** Credits 账户信息 */
export interface ICreditsAccount {
  /** 用户 ID */
  userId: string
  /** 当前余额（支持 4 位小数） */
  balance: number
  /** 冻结金额 */
  frozenAmount: number
  /** 可用余额 */
  availableBalance: number
  /** 累计充值 */
  totalRecharged: number
  /** 累计提现 */
  totalWithdrawn: number
  /** 法币汇率（1 credit = ? CNY） */
  exchangeRate: number
  /** 货币代码 */
  currency: string
  /** 账户状态 */
  status: 'active' | 'frozen' | 'suspended'
  /** 最后更新时间 */
  updatedAt: string
}

/** Credits 流水记录 */
export interface ICreditsTransaction {
  /** 流水 ID */
  id: string
  /** 流水类型 */
  type: CreditsTransactionType
  /** 变动金额（收入为正，支出为负） */
  amount: number
  /** 变动后余额 */
  balance: number
  /** 来源/用途 */
  source: CreditsTransactionSource
  /** 描述 */
  description: string
  /** 关联订单 ID（可选） */
  orderId?: string
  /** 创建时间 */
  createdAt: string
}

/** 提现账户类型 */
export type WithdrawAccountType = 'alipay' | 'wechat' | 'bank'

/** 提现记录 */
export interface ICreditsWithdrawal {
  /** 提现 ID */
  id: string
  /** 提现金额 */
  amount: number
  /** 手续费 */
  fee: number
  /** 实际到账 */
  netAmount: number
  /** 账户类型 */
  accountType: WithdrawAccountType
  /** 账户信息（脱敏） */
  accountInfo: string
  /** 状态 */
  status: 'pending' | 'approved' | 'rejected'
  /** 拒绝原因（可选） */
  rejectReason?: string
  /** 创建时间 */
  createdAt: string
  /** 处理时间（可选） */
  processedAt?: string
}

/** 收益分布数据点 */
export interface ICreditsEarningPoint {
  /** 日期 YYYY-MM-DD */
  date: string
  /** 当日收益金额 */
  amount: number
}

// ============================================
// 创作者中心类型
// ============================================

/** 商品类型 */
export type CreatorProductType = 'template' | 'website' | 'component' | 'plugin'

/** 商品状态 */
export type CreatorProductStatus = 'active' | 'inactive' | 'pending' | 'rejected'

/** 创作者商品 */
export interface ICreatorProduct {
  /** 商品 ID */
  id: string
  /** 商品名称 */
  name: string
  /** 商品描述 */
  description: string
  /** 商品类型 */
  type: CreatorProductType
  /** 分类 */
  category: string
  /** 标签 */
  tags: string[]
  /** 法币价格 */
  price: number
  /** Credits 价格 */
  creditsPrice: number
  /** 货币类型 */
  currency: 'credits' | 'fiat'
  /** 评分 */
  rating: number
  /** 评价数 */
  reviewCount: number
  /** 销量 */
  salesCount: number
  /** 卖家 ID */
  sellerId: string
  /** 卖家名称 */
  sellerName: string
  /** 卖家头像（可选） */
  sellerAvatar?: string
  /** 预览图 */
  previewImages: string[]
  /** 演示地址（可选） */
  demoUrl?: string
  /** 技术栈 */
  techStack: string[]
  /** 状态 */
  status: CreatorProductStatus
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 销售记录 */
export interface ICreatorSale {
  /** 销售 ID */
  id: string
  /** 商品 ID */
  productId: string
  /** 商品名称 */
  productName: string
  /** 买家 ID */
  buyerId: string
  /** 买家名称 */
  buyerName: string
  /** 成交价格 */
  price: number
  /** 平台手续费 */
  platformFee: number
  /** 净收益 */
  netEarning: number
  /** 创建时间 */
  createdAt: string
}

/** 创作者收益数据点 */
export interface ICreatorEarning {
  /** 日期 YYYY-MM-DD */
  date: string
  /** 当日收益 */
  amount: number
  /** 当日销售额 */
  salesAmount: number
  /** 当日手续费 */
  platformFee: number
}

/** 创作者统计概览 */
export interface ICreatorStats {
  /** 商品总数 */
  totalProducts: number
  /** 总销量 */
  totalSales: number
  /** 总收益 */
  totalEarnings: number
  /** 本月收益 */
  monthlyEarnings: number
  /** 平台费率 */
  platformFeeRate: number
}

// ============================================
// 通用分页与响应类型
// ============================================

/** 分页参数 */
export interface IEconomyPaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** 分页响应 */
export interface IEconomyPaginatedResponse<T> {
  /** 数据列表 */
  items: T[]
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总页数 */
  totalPages: number
}

/** 经济系统通用 API 响应 */
export interface IEconomyApiResponse<T> {
  success: boolean
  data: T | null
  message: string
  code?: string
}

// ============================================
// 组件 Props 辅助类型
// ============================================

/** DataCard 趋势方向 */
export type TrendDirection = 'up' | 'down' | 'flat'

/** DataTable 列定义 */
export interface IDataTableColumn<T = Record<string, unknown>> {
  /** 列标识 */
  prop: keyof T | string
  /** 列标题 */
  label: string
  /** 列宽 */
  width?: number | string
  /** 最小列宽 */
  minWidth?: number | string
  /** 是否可排序 */
  sortable?: boolean | 'custom'
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 自定义单元格渲染（slot 名称） */
  slot?: string
  /** 是否固定列 */
  fixed?: 'left' | 'right' | boolean
  /** 格式化函数 */
  formatter?: (row: T, column: IDataTableColumn<T>, cellValue: unknown, index: number) => string
}

/** TrendChart 时间范围 */
export type TrendTimeRange = '7d' | '30d' | '90d'

/** TrendChart 数据点 */
export interface ITrendDataPoint {
  date: string
  value: number
}

/** PieChart 数据项 */
export interface IPieChartItem {
  name: string
  value: number
}
