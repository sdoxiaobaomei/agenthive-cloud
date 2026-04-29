#!/usr/bin/env python3
"""Create UI prototype tickets for FE-MKT-002 and FE-MKT-003."""
import os

base = "AGENTS/workspace"
os.makedirs(base, exist_ok=True)

tickets = [
    {
        "id": "FE-MKT-UI-INFRA",
        "title": "经济系统共享 UI 基础设施——Mock 数据层 + 通用组件",
        "priority": "P1",
        "order": 1,
        "description": """构建 Credits 中心和创作者中心共享的 UI 基础设施层，确保各页面原型使用统一的 Mock 数据结构和通用组件，为后续后端 API 对接预留接口。

目标：
1. 定义统一的 TypeScript 接口（ICreditsAccount, ICreditsTransaction, ICreatorProduct, ICreatorEarning 等）
2. 创建可替换的 Mock API 层——interface 与实现分离，后端就绪时只需替换实现
3. 提供通用 Vue 组件：DataCard, TrendChart, PieChart, DataTable, AmountInput, ConfirmDialog
4. 所有组件支持暗色模式（与现有 landing 设计系统一致）""",
        "ac": [
            "Mock 数据层：~/composables/useMockApi.ts，提供 useMockCredits() / useMockCreator()，返回响应式 ref",
            "TypeScript 接口定义：~/types/economy.ts，包含 ICreditsAccount/ICreditsTransaction/ICreatorProduct/ICreatorEarning/ICreatorSale",
            "通用组件 DataCard：标题+大数字+趋势指示（上升/下降箭头+百分比）",
            "通用组件 TrendChart：基于 ECharts 的折线图，支持 7/30/90 天切换，暗色主题",
            "通用组件 PieChart：基于 ECharts 的饼图，支持图例+百分比显示，暗色主题",
            "通用组件 DataTable：Element Plus el-table 封装，支持排序/筛选/分页/空状态",
            "通用组件 AmountInput：金额输入框，支持 credits 精度（4 位小数），实时法币换算显示",
            "通用组件 ConfirmDialog：二次确认弹窗（用于充值/提现/删除等危险操作）",
            "所有组件在 Storybook 或独立测试页中可预览",
            "npm run type-check 通过，无 any 类型滥用"
        ],
        "files": [
            "apps/landing/composables/useMockApi.ts",
            "apps/landing/types/economy.ts",
            "apps/landing/components/economy/DataCard.vue",
            "apps/landing/components/economy/TrendChart.vue",
            "apps/landing/components/economy/PieChart.vue",
            "apps/landing/components/economy/DataTable.vue",
            "apps/landing/components/economy/AmountInput.vue",
            "apps/landing/components/economy/ConfirmDialog.vue"
        ],
        "depends_on": [],
        "risk": "low",
        "security": "none",
        "notes": "UI 原型阶段，不调用真实后端 API。所有数据为 mock。"
    },
    {
        "id": "FE-MKT-003-UI-1",
        "title": "Credits 中心 UI 原型——首页 + 流水明细",
        "priority": "P1",
        "order": 2,
        "description": """实现 Credits 管理中心的前两个核心页面：首页（余额概览）和流水明细页。使用 Mock 数据，不依赖后端 API。

对接点预留：
- 余额数据通过 useMockCredits() 获取，后端就绪时替换为 useCreditsApi()
- 流水列表通过 useMockTransactions() 获取，后端就绪时替换为 useTransactionsApi()""",
        "ac": [
            "/credits 页面：余额大数字展示（精确到 4 位小数），使用 AmountInput 同精度格式",
            "/credits 页面：快捷操作按钮（充值/提现/查看流水），点击路由跳转",
            "/credits 页面：收益来源饼图（流量收益/销售收益/充值，近 30 天），使用 PieChart 组件",
            "/credits 页面：最近 5 笔流水预览卡片，显示时间/类型/金额/余额",
            "/credits/transactions 页面：完整流水列表，使用 DataTable 组件",
            "/credits/transactions 页面：类型筛选（全部/收入/支出），DataTable 表头筛选",
            "/credits/transactions 页面：分页加载（每页 10/20/50 条）",
            "/credits/transactions 页面：类型图标颜色区分（收入绿色/支出红色/手续费灰色）",
            "余额数字使用计数器动画（从 0 滚动到目标值，持续 800ms）",
            "顶部导航栏显示当前用户 credits 余额（实时轮询 mock 数据，5s 间隔）",
            "Chat 页面发送消息旁显示预估消费（mock 值：每条消息 0.5 credits）",
            "暗色模式支持，与现有 landing 主题一致"
        ],
        "files": [
            "apps/landing/pages/credits/index.vue",
            "apps/landing/pages/credits/transactions.vue",
            "apps/landing/composables/useMockCredits.ts",
            "apps/landing/composables/useMockTransactions.ts"
        ],
        "depends_on": ["FE-MKT-UI-INFRA"],
        "risk": "medium",
        "security": "none",
        "notes": "Mock 数据应覆盖：余额 1234.5678、10 条以上流水记录（含各种类型）、近 30 天收益分布。"
    },
    {
        "id": "FE-MKT-003-UI-2",
        "title": "Credits 中心 UI 原型——充值 + 提现",
        "priority": "P1",
        "order": 3,
        "description": """实现 Credits 管理中心的充值和提现页面。使用 Mock 数据，模拟完整支付流程和提现申请流程。

注意：
- 支付渠道（支付宝/微信）仅做 UI，点击后模拟 2 秒 loading 然后成功
- 提现到账账户先只支持支付宝，预留银行卡/微信扩展位""",
        "ac": [
            "/credits/recharge 页面：快捷金额选择（10/50/100/500/1000 credits），使用卡片式单选",
            "/credits/recharge 页面：自定义金额输入（≥1，使用 AmountInput 组件）",
            "/credits/recharge 页面：法币价格实时计算（1 credit = 0.1 元，mock 汇率配置在 composable 中）",
            "/credits/recharge 页面：支付渠道选择（支付宝/微信），仅 UI 展示",
            "/credits/recharge 页面：确认充值按钮 → ConfirmDialog → 模拟支付 2s → 成功 Toast + 余额更新",
            "/credits/withdraw 页面：可提现余额展示（总余额 - 冻结余额）",
            "/credits/withdraw 页面：提现金额输入（≥最低限额 100 credits，使用 AmountInput）",
            "/credits/withdraw 页面：手续费实时计算（费率 10%，输入 100 显示到账 90）",
            "/credits/withdraw 页面：到账账户选择（支付宝，预留银行卡/微信 tab）",
            "/credits/withdraw 页面：账户信息脱敏展示（'支付宝 188****8888'）",
            "/credits/withdraw 页面：提交申请 → ConfirmDialog → 模拟提交 1s → 显示'审核中'状态",
            "/credits/withdraw 页面：提现记录列表（时间/金额/手续费/到账/状态），使用 DataTable",
            "充值和提现操作后，顶部导航栏余额自动更新（通过全局 store 或事件总线）"
        ],
        "files": [
            "apps/landing/pages/credits/recharge.vue",
            "apps/landing/pages/credits/withdraw.vue",
            "apps/landing/composables/useMockRecharge.ts",
            "apps/landing/composables/useMockWithdraw.ts"
        ],
        "depends_on": ["FE-MKT-UI-INFRA"],
        "risk": "medium",
        "security": "review_required",
        "notes": "虽然用 mock 数据，但提现金额输入、手续费计算、账户脱敏等逻辑需要前端正确实现。"
    },
    {
        "id": "FE-MKT-002-UI-1",
        "title": "创作者中心 UI 原型——首页 + 收益明细",
        "priority": "P1",
        "order": 4,
        "description": """实现创作者中心的首页（数据概览）和收益明细页。使用 Mock 数据，不依赖后端 API。

权限控制预留：
- 非卖家角色访问时显示'成为创作者'引导页（mock 权限判断）""",
        "ac": [
            "/creator 页面：数据概览卡片（在售商品数/总销量/总收益(credits)/本月收益），使用 DataCard 组件",
            "/creator 页面：收益趋势图（近 30 天，使用 TrendChart 组件）",
            "/creator 页面：最近销售记录列表（时间/商品/买家/售价），使用 DataTable 组件",
            "/creator/earnings 页面：销售流水完整列表（时间/商品/买家/售价/平台抽成/实得），使用 DataTable",
            "/creator/earnings 页面：按日期范围筛选（近 7 天/30 天/90 天/自定义）",
            "/creator/earnings 页面：导出 CSV 按钮（mock 生成并下载 CSV 文件）",
            "非卖家角色访问 /creator 时显示引导页：'成为创作者'按钮 + 平台优势说明",
            "销售数据使用 mock 数据：至少 20 条销售记录、5 个在售商品",
            "暗色模式支持"
        ],
        "files": [
            "apps/landing/pages/creator/index.vue",
            "apps/landing/pages/creator/earnings.vue",
            "apps/landing/composables/useMockCreator.ts",
            "apps/landing/composables/useMockSales.ts"
        ],
        "depends_on": ["FE-MKT-UI-INFRA"],
        "risk": "low",
        "security": "none",
        "notes": "Mock 销售数据应包含不同商品、不同买家、不同时间，覆盖平台抽成场景。"
    },
    {
        "id": "FE-MKT-002-UI-2",
        "title": "创作者中心 UI 原型——商品管理 + 发布商品",
        "priority": "P1",
        "order": 5,
        "description": """实现创作者中心的商品管理页和发布商品页。使用 Mock 数据，模拟完整的商品发布流程。

注意：
- 预览图上传使用本地 FileReader 展示预览，不上传真实服务器
- 商品来源选择从 mock project 列表中选取""",
        "ac": [
            "/creator/products 页面：商品列表表格（名称/类型/价格/状态/销量/操作），使用 DataTable",
            "/creator/products 页面：状态筛选（全部/上架中/已下架）",
            "/creator/products 页面：操作按钮（编辑/下架/删除），下架/删除需 ConfirmDialog",
            "/creator/products/new 页面：表单——名称、描述（支持 Markdown 预览）、类型选择",
            "/creator/products/new 页面：技术栈标签输入（支持多标签，Enter 添加）",
            "/creator/products/new 页面：价格设置——credits 价格（必填）、法币价格（可选）",
            "/creator/products/new 页面：预览图上传（最多 5 张，拖拽排序，2MB/张限制，本地预览）",
            "/creator/products/new 页面：演示 URL 输入（可选）",
            "/creator/products/new 页面：商品来源选择——从 mock project 列表中选择（复用 project store 结构）",
            "/creator/products/new 页面：发布成功 → 跳转到商品详情页（mock 详情页可先占位）",
            "预览图使用 Element Plus Upload 组件，超出大小限制时提示错误",
            "商品描述使用 markdown-it 渲染预览（简易实现，无需全功能）",
            "表单校验：名称必填(2-50字)、credits 价格必填(>0)、描述必填(10-2000字)"
        ],
        "files": [
            "apps/landing/pages/creator/products.vue",
            "apps/landing/pages/creator/products/new.vue",
            "apps/landing/components/creator/ProductForm.vue",
            "apps/landing/composables/useMockProducts.ts"
        ],
        "depends_on": ["FE-MKT-UI-INFRA"],
        "risk": "medium",
        "security": "review_required",
        "notes": "图片上传仅本地预览（FileReader），不上传。Markdown 渲染需防范 XSS（使用 DOMPurify 或仅渲染白名单标签）。"
    }
]

for t in tickets:
    td = os.path.join(base, f"TICKET-{t['id']}")
    os.makedirs(td, exist_ok=True)
    
    # Build depends_on YAML
    if t["depends_on"]:
        deps_yaml = "\n".join([f"  - TICKET-{d}" for d in t["depends_on"]])
    else:
        deps_yaml = "  []"
    
    # Build files YAML
    files_yaml = "\n".join([f"  - {f}" for f in t["files"]])
    
    # Build AC YAML
    ac_yaml = "\n".join([f"  - {ac}" for ac in t["ac"]])
    
    content = f"""ticket_id: TICKET-{t['id']}
title: {t['title']}
type: feature
priority: {t['priority']}
status: pending
assigned_team: frontend
role: frontend_dev
description: >-
  {t['description'].replace(chr(10), chr(10) + '  ')}
acceptance_criteria:
{ac_yaml}
relevant_files:
{files_yaml}
constraints:
  - 使用 Mock 数据，不调用真实后端 API
  - 所有数据接口预留替换点（interface + composable 模式）
  - 暗色模式支持，与现有 landing 设计系统一致
  - 响应式设计（桌面端为主，移动端隐藏复杂功能）
depends_on:
{deps_yaml}
parent_ticket: null
qa_result: null
created_at: '2026-04-28T00:00:00Z'
retry_count: 0
confidence_threshold: 0.85
risk_assessment: {t['risk']}
security_implications: {t['security']}
notes: >-
  [LEAD-DISPATCH-2026-04-28] UI 原型阶段任务，与后端 API 开发并行。
  后端 API 就绪后，只需替换 composable 中的 mock 实现为真实 API 调用。
  {t['notes']}
"""
    
    with open(os.path.join(td, "TICKET.yaml"), "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"Created TICKET-{t['id']}")

print(f"\nDone. Created {len(tickets)} tickets.")
