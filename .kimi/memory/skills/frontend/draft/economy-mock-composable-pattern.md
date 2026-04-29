# Economy Mock Composable Pattern

## Context
Building economy-related UI prototypes (credits, marketplace, creator center) that will later connect to real backend APIs.

## Pattern

```ts
// composables/useMock{Feature}.ts
import { computed } from 'vue'
import { use{Feature}Store } from '~/stores/{feature}'

export interface I{Feature}Result {
  success: boolean
  id?: string
}

/** Mock-configurable constants */
const EXCHANGE_RATE = 0.1

export function useMock{Feature}() {
  const store = use{Feature}Store()

  /** Pure helper functions */
  const calculateX = (input: number): number => { ... }

  /** Async action wrapping store with exact mock delay */
  const action = async (...args): Promise<I{Feature}Result> => {
    await store.action(...args)
    return { success: true, id: store.items[0]?.id }
  }

  return {
    loading: store.loading,        // return store ref directly, NOT computed(() => store.loading)
    exchangeRate: EXCHANGE_RATE,
    calculateX,
    action,
  }
}
```

## Why
- Backend API ready → swap only this file, pages unchanged
- Store remains the single source of truth for state
- Composable encapsulates business rules (fee calc, exchange rates)

## Anti-patterns to Avoid
- Do NOT wrap `store.loading` in `computed()` — breaks Vue template prop type unwrapping
- Do NOT put mock delays in composables if store already has them — double delay
- Do NOT duplicate shared helpers across composables — centralize in `~/utils/economy.ts`

## Related
- `useMockRecharge.ts`, `useMockWithdraw.ts` in `apps/landing/composables/`
