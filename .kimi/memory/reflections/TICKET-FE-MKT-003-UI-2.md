# Reflection: TICKET-FE-MKT-003-UI-2

## Credits 中心充值 + 提现

### 完成情况
- /credits/recharge 页面：快捷金额、自定义金额、法币换算、支付渠道、确认流程 ✅
- /credits/withdraw 页面：可提现余额、金额输入、手续费计算、账户选择、提现记录 ✅
- 充值/提现后顶部导航余额自动更新 ✅

### 发现的问题与修复
1. **calculateFiatPrice 重复导出**：已在 TICKET-FE-MKT-002-UI-2 中修复，移除 `useMockWithdraw.ts` 中的导出关键字。

### 可复用模式
- **AmountInput 组件**：封装了精度控制、法币实时换算、快捷金额选择。props：min/max/precision/exchangeRate/showFiat/quickAmounts。
- **支付流程 Mock**：ConfirmDialog → loading（2s 模拟）→ Toast 反馈 → Store 更新 → 页面跳转。真实后端就绪时仅替换 composable 中的 async 方法即可。

### SSR 安全
- 所有交互逻辑（点击、输入、确认）均在客户端触发
- 无 `window`/`document` 裸调用

### 性能
- 手续费和到账金额使用 `computed`，实时响应输入变化
- ConfirmDialog 使用 `v-model` 控制显隐，无不必要的重渲染
- 提现记录直接读取 store 中的数组，无需额外请求

### 安全
- 提现金额校验：最小限额 + 余额充足性检查
- 账户信息脱敏在前端展示（生产环境应由后端返回已脱敏数据）
