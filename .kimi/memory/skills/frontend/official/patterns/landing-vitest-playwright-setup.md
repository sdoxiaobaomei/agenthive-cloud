# [Draft] Landing 项目测试基础设施配置

> 来源: TICKET-FE-MKT-003, TICKET-FEAT-007
> 创建日期: 2026-04-28
> 考察期截止: 2026-05-28

## 场景
Landing 项目 (apps/landing) 当前无 Vitest 单元测试和 Playwright E2E 测试基础设施。导致所有 frontend ticket 的 test_coverage 指标为 0，按 Objective Confidence v1.0 直接损失 0.15 分，confidence_score 上限降至 0.85。

## 代码

### 1. 安装依赖
```bash
cd apps/landing
npm install -D vitest @vue/test-utils @nuxt/test-utils playwright
npx playwright install
```

### 2. vitest.config.ts
```typescript
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
  },
})
```

### 3. 组件测试示例 (components/__tests__/AnimatedBalance.spec.ts)
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AnimatedBalance from '../AnimatedBalance.vue'

describe('AnimatedBalance', () => {
  it('renders target value after animation', async () => {
    const wrapper = mount(AnimatedBalance, {
      props: { target: 1000, duration: 100 }
    })
    await new Promise(r => setTimeout(r, 200))
    expect(wrapper.text()).toContain('1000')
  })
})
```

### 4. package.json scripts
```json
{
  "test": "vitest",
  "test:e2e": "playwright test"
}
```

## 踩坑经过
TICKET-FE-MKT-003 和 FEAT-007 均因无测试基础设施导致 objective_breakdown.test_coverage = 0，confidence_score 被强制扣减 0.15。这是系统性问题，非单个 ticket 执行问题。

## 注意事项
- Nuxt 3 需使用 `@nuxt/test-utils` 提供的 `defineVitestConfig`
- Playwright 测试需配置 `baseURL` 为 `http://localhost:3000`
- 组件测试中使用 `flushPromises` 处理异步状态更新
