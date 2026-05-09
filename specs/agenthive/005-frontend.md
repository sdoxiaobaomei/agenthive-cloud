# Frontend Specification — Chat Page Enhancement & Store Refactoring

> **Scope**: `apps/landing/` (Nuxt 3, Vue 3 + TypeScript + Element Plus + Pinia + Tailwind CSS)
> **Status**: Code Blueprint Level
> **Target**: ~700+ lines of concrete implementation guidance

---

## 1. ChatPage Enhancement (`pages/chat/[chatId].vue`)

**Current state** (lines 133-152): Three-tab layout — Files | Editor | Preview. The Preview tab is a static placeholder with macOS-style window dots and a "Preview will be available after project build" message.

### 1.1 Tab Layout Upgrade: 3-Tab -> 5-Tab

Replace the three-tab system with five tabs. The `ChatTab` type in `stores/chat.ts` (line 113) must change from:

```typescript
export type ChatTab = 'files' | 'editor' | 'preview'
```

to:

```typescript
export type ChatTab = 'files' | 'editor' | 'preview' | 'deploy' | 'logs'
```

The tab bar will render above `.center-content` as:

```vue
<div class="tab-bar">
  <button
    v-for="tab in tabs"
    :key="tab.id"
    class="tab-btn"
    :class="{ active: chatStore.activeTab === tab.id }"
    @click="chatStore.setActiveTab(tab.id)"
  >
    <el-icon><component :is="tab.icon" /></el-icon>
    <span>{{ tab.label }}</span>
    <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
  </button>
</div>
```

Tab definitions:

```typescript
const tabs = [
  { id: 'files' as const,   label: 'Files',   icon: FolderOpened },
  { id: 'editor' as const,  label: 'Editor',  icon: Document },
  { id: 'preview' as const, label: 'Preview', icon: Monitor },
  { id: 'deploy' as const,  label: 'Deploy',  icon: UploadFilled },
  { id: 'logs' as const,    label: 'Logs',    icon: List },
]
```

### 1.2 Tab Auto-Switching Logic

The `chatStore.activeTab` must respond to generation lifecycle events. Add a watcher in `[chatId].vue` that listens to the `generationStore.generationState.status`:

```typescript
// In pages/chat/[chatId].vue <script setup>
const generationStore = useGenerationStore()

watch(() => generationStore.generationState.status, (newStatus, oldStatus) => {
  const transitions: Record<string, ChatTab> = {
    'planning':    'editor',
    'generating':  'editor',
    'verifying':   'preview',
    'ready':       'preview',
    'deploying':   'deploy',
    'error':       'logs',
  }
  const targetTab = transitions[newStatus]
  if (targetTab) {
    chatStore.setActiveTab(targetTab)
  }
})
```

When `deployStatus === 'deployed'`, the deploy tab shows the live URL with a prominent "Open App" button.

### 1.3 WebSocket Event Wiring

Wire WebSocket listeners on page mount (currently ChatPanel owns the socket). The chat page must subscribe to:

| Event | Handler |
|-------|---------|
| `taskProgress` | Update `generationStore.generationState.progress` |
| `preview:status` | Update `generationStore.previewStatus` |
| `deploy:status` | Update `generationStore.deployStatus` and `generationStore.deployUrl` |
| `session:error` | Push log entry, auto-switch to logs tab |
| `session:completed` | Refresh file tree, set status to `ready` |

The socket instance is shared via provide/inject through `useChatSocket.ts`.

### 1.4 Logs Tab Content

The logs tab is a scrollable terminal-style view. It connects to the same `session:logs` WebSocket event already handled in ChatPanel (line 429), but renders in full-width mode:

```vue
<div v-if="chatStore.activeTab === 'logs'" class="logs-view">
  <div class="logs-toolbar">
    <el-button size="small" @click="agentLogs = []">Clear</el-button>
    <el-switch v-model="autoScroll" active-text="Auto-scroll" />
  </div>
  <div class="logs-content" ref="logsContainer">
    <div v-for="(log, i) in agentLogs" :key="i" class="log-line" :class="log.level">
      <span class="log-time">{{ formatTime(log.timestamp) }}</span>
      <span class="log-level">{{ log.level }}</span>
      <span class="log-text">{{ log.message }}</span>
    </div>
  </div>
</div>
```

---

## 2. TypeScript Type Definitions (NEW: `apps/landing/types/generation.ts`)

Create a new file at `apps/landing/types/generation.ts` with the following types:

```typescript
// apps/landing/types/generation.ts

/** Generation lifecycle status */
export type GenerationStatus =
  | 'idle'
  | 'planning'
  | 'generating'
  | 'verifying'
  | 'ready'
  | 'error'

/** Individual step within a generation run */
export interface GenerationStep {
  name: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Overall generation state tracked in the store */
export interface GenerationState {
  status: GenerationStatus
  currentStep: string | null
  steps: GenerationStep[]
  progress: number          // 0-100
  errors: string[]
  startedAt: string | null
  completedAt: string | null
}

/** Verification step state (shown in verification checklist) */
export interface VerificationStepState {
  name: string             // e.g. "npm install", "tsc --noEmit", "eslint"
  status: 'pending' | 'running' | 'success' | 'failed'
  durationMs?: number
  error?: string
}

/** App template card shown during app generation intent */
export interface AppTemplateOption {
  id: string
  name: string
  description: string
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile'
  icon: string             // Element Plus icon name
  techStack: string[]       // e.g. ["Vue 3", "Element Plus", "Tailwind"]
  previewUrl?: string
}

/** Design scheme for color/style selection */
export interface DesignSchemeOption {
  id: string
  name: string
  colors: {
    primary: string        // e.g. '#4f46e5'
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textMuted: string
  }
  borderRadius: string     // e.g. '8px' | '12px' | '16px'
  fontFamily: string       // e.g. "'Inter', sans-serif"
  preview: string          // CSS gradient or data-URI for swatch preview
}

/** WebSocket progress events from agent runtime */
export interface ProgressEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'step_complete' | 'error'
  data: {
    step?: string
    token?: string
    toolName?: string
    toolResult?: unknown
    error?: string
    progress?: number
  }
  timestamp: string
}

/** Deploy status */
export type DeployStatus = 'none' | 'building' | 'deploying' | 'deployed' | 'failed'

/** Preview connection status */
export type PreviewStatus = 'stopped' | 'starting' | 'ready' | 'error'
```

---

## 3. PreviewPanel Component (NEW: `apps/landing/components/preview/PreviewPanel.vue`)

A full Vue 3 SFC component. Key design points:

### 3.1 Template Structure

```vue
<template>
  <div class="preview-panel">
    <!-- Toolbar -->
    <div class="preview-toolbar">
      <div class="device-toggle">
        <el-button-group>
          <el-button
            v-for="d in devices"
            :key="d.id"
            :type="currentDevice === d.id ? 'primary' : 'default'"
            size="small"
            @click="setDeviceMode(d.id)"
          >
            <el-icon><component :is="d.icon" /></el-icon>
          </el-button>
        </el-button-group>
      </div>
      <div class="url-bar">
        <el-icon><Lock /></el-icon>
        <span>{{ previewUrl }}</span>
      </div>
      <div class="preview-actions">
        <el-button size="small" circle @click="copyUrl">
          <el-icon><DocumentCopy /></el-icon>
        </el-button>
        <el-button size="small" circle @click="refreshPreview">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button size="small" circle @click="openNewWindow">
          <el-icon><TopRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="preview-content">
      <!-- Empty State -->
      <div v-if="previewStatus === 'stopped'" class="preview-empty">
        <el-icon :size="64"><Monitor /></el-icon>
        <h3>Preview not started</h3>
        <p>Complete code generation to see your app preview</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="previewStatus === 'starting'" class="preview-loading">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>Starting preview server...</p>
        <el-progress :percentage="startupProgress" :show-text="false" />
      </div>

      <!-- Error State -->
      <div v-else-if="previewStatus === 'error'" class="preview-error">
        <el-icon :size="48"><CircleCloseFilled /></el-icon>
        <h3>Preview Error</h3>
        <p>{{ previewError }}</p>
        <el-button type="primary" @click="refreshPreview">Retry</el-button>
      </div>

      <!-- Preview iframe -->
      <div v-else-if="previewStatus === 'ready'" class="preview-frame-wrapper" :style="frameStyle">
        <iframe
          ref="previewIframe"
          :src="previewUrl"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          class="preview-iframe"
          @load="onIframeLoad"
          @error="onIframeError"
        />
      </div>
    </div>
  </div>
</template>
```

### 3.2 Script Setup

```typescript
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Monitor, Lock, DocumentCopy, Refresh, TopRight, Loading, CircleCloseFilled,
  Iphone, Opportunity, Notebook,
} from '@element-plus/icons-vue'
import { useGenerationStore } from '~/stores/generation'

const props = defineProps<{
  projectId: string
}>()

const generationStore = useGenerationStore()
const previewIframe = ref<HTMLIFrameElement>()

const currentDevice = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const previewUrl = computed(() => `/api/projects/${props.projectId}/preview/`)
const previewStatus = computed(() => generationStore.previewStatus)
const previewError = ref('')
const startupProgress = ref(0)
const copyFeedback = ref(false)

const devices = [
  { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
  { id: 'tablet' as const, icon: Notebook, label: 'Tablet' },
  { id: 'mobile' as const, icon: Iphone, label: 'Mobile' },
]

const frameStyle = computed(() => {
  switch (currentDevice.value) {
    case 'desktop': return { width: '100%', height: '100%' }
    case 'tablet':  return { width: '768px', height: '100%', transform: 'scale(0.9)', transformOrigin: 'top left' }
    case 'mobile':  return { width: '375px', height: '100%', transform: 'scale(0.85)', transformOrigin: 'top left' }
    default:        return {}
  }
})

function setDeviceMode(mode: 'desktop' | 'tablet' | 'mobile') {
  currentDevice.value = mode
}

function refreshPreview() {
  if (previewIframe.value) {
    previewIframe.value.src = previewUrl.value
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.origin + previewUrl.value)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 2000)
    ElMessage.success('Link copied!')
  } catch {
    ElMessage.error('Failed to copy')
  }
}

function openNewWindow() {
  window.open(previewUrl.value, '_blank', 'noopener,noreferrer')
}

function onIframeLoad() {
  startupProgress.value = 100
}

function onIframeError() {
  previewError.value = 'Failed to load preview content'
}

// Auto-reload on file changes (debounced by 2s)
watch(() => generationStore.generationState.progress, () => {
  if (generationStore.generationState.progress === 100) {
    setTimeout(() => refreshPreview(), 1000)
  }
})

onUnmounted(() => {
  // Cleanup iframe
})
</script>
```

### 3.3 Scoped Styles

```css
<style scoped>
.preview-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.url-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'IBM Plex Mono', monospace;
  color: #6b7280;
  overflow: hidden;
}
.url-bar span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-actions {
  display: flex;
  gap: 4px;
}

.preview-content {
  flex: 1;
  overflow: hidden;
}

.preview-frame-wrapper {
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* Empty/Loading/Error states use flex center */
.preview-empty, .preview-loading, .preview-error {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
}
</style>
```

---

## 4. ChatPanel Enhancement (`components/ChatPanel.vue`)

Current file: 1169 lines. The following new sections are injected into the existing template between the message list and the input area (after line 135 `</div>` of the progress panel, before line 138 `<!-- Input Area -->`).

### 4.1 Template Selection UI

Shown when the last message's `metadata.intent === 'generate_app'`:

```vue
<!-- Template Selection (appears below messages when intent is generate_app) -->
<div v-if="showTemplatePicker" class="template-picker">
  <p class="picker-title">Choose a starting template</p>
  <div class="template-grid">
    <div
      v-for="tmpl in generationStore.availableTemplates"
      :key="tmpl.id"
      class="template-card"
      :class="{ selected: generationStore.selectedTemplate?.id === tmpl.id }"
      @click="generationStore.setTemplate(tmpl)"
    >
      <el-icon :size="28"><component :is="tmpl.icon" /></el-icon>
      <span class="tpl-name">{{ tmpl.name }}</span>
      <span class="tpl-desc">{{ tmpl.description }}</span>
      <div class="tpl-badges">
        <el-tag v-for="tech in tmpl.techStack" :key="tech" size="small">{{ tech }}</el-tag>
      </div>
    </div>
  </div>
</div>
```

### 4.2 Design Scheme Picker

```vue
<!-- Design Scheme Picker -->
<div v-if="showSchemePicker" class="scheme-picker">
  <p class="picker-title">Choose a color scheme</p>
  <div class="scheme-swatches">
    <button
      v-for="s in generationStore.designSchemes"
      :key="s.id"
      class="scheme-swatch"
      :class="{ selected: generationStore.selectedDesignScheme?.id === s.id }"
      :style="{ background: s.preview }"
      @click="generationStore.setDesignScheme(s)"
    >
      <el-icon v-if="generationStore.selectedDesignScheme?.id === s.id" :size="20">
        <Check />
      </el-icon>
    </button>
  </div>
</div>
```

Computed property:

```typescript
const showTemplatePicker = computed(() => {
  const lastMsg = chatStore.currentMessages.slice(-1)[0]
  return lastMsg?.metadata?.intent === 'generate_app'
    && !generationStore.selectedTemplate
})

const showSchemePicker = computed(() => {
  return generationStore.selectedTemplate !== null
    && !generationStore.selectedDesignScheme
})
```

### 4.3 Token Usage Bar

Displayed below the header actions, between `.panel-header` and `.messages-area`:

```vue
<div v-if="tokenUsage.total > 0" class="token-bar">
  <el-tooltip :content="`${tokenUsage.used}/${tokenUsage.limit} tokens`" placement="bottom">
    <el-progress
      :percentage="tokenUsage.percentage"
      :color="tokenBarColor"
      :stroke-width="6"
      :show-text="false"
    />
  </el-tooltip>
  <span class="token-text">{{ tokenUsage.used }} / {{ tokenUsage.limit }}</span>
</div>
```

Computed:

```typescript
const tokenBarColor = computed(() => {
  const pct = tokenUsage.value.percentage
  if (pct > 80) return '#ef4444'
  if (pct > 50) return '#f59e0b'
  return '#22c55e'
})
```

### 4.4 Verification Step Progress (Checklist)

Shown during `generationState.status === 'verifying'`:

```vue
<div v-if="generationState.status === 'verifying'" class="verification-checklist">
  <div
    v-for="step in generationState.verificationSteps"
    :key="step.name"
    class="check-item"
    :class="step.status"
  >
    <el-icon v-if="step.status === 'pending'"><Clock /></el-icon>
    <el-icon v-else-if="step.status === 'running'" class="is-loading"><Loading /></el-icon>
    <el-icon v-else-if="step.status === 'success'"><CircleCheckFilled /></el-icon>
    <el-icon v-else-if="step.status === 'failed'"><CircleCloseFilled /></el-icon>
    <span class="check-name">{{ step.name }}</span>
    <span v-if="step.durationMs" class="check-duration">{{ (step.durationMs / 1000).toFixed(1) }}s</span>
  </div>
</div>
```

### 4.5 Deploy/Export Action Buttons

Shown when `generationState.status === 'ready'`:

```vue
<div v-if="generationState.status === 'ready'" class="action-buttons">
  <el-button type="primary" @click="handleDeploy">
    <el-icon><UploadFilled /></el-icon> Deploy to Production
  </el-button>
  <el-button @click="handleExportZip">
    <el-icon><Download /></el-icon> Export as ZIP
  </el-button>
  <el-button @click="handlePushToGitHub">
    <el-icon><Link /></el-icon> Push to GitHub
  </el-button>
</div>
```

---

## 5. Store Refactoring — Remove Mock Data, Add Real API Calls

### 5.1 `stores/marketplace.ts`

Replace all mock data with real API integration:

```typescript
// REMOVE: mockProducts array (lines 44-181)
// REMOVE: state initialization `products: mockProducts` (line 185)
// CHANGE state to: products: []

// ADD new actions:
actions: {
  async fetchProducts(params?: { category?: ProductType | 'all'; search?: string; sort?: string; page?: number; pageSize?: number }): Promise<void> {
    this.loading = true
    try {
      const { get } = useApi()
      const query = new URLSearchParams()
      if (params?.category && params.category !== 'all') query.set('category', params.category)
      if (params?.search) query.set('search', params.search)
      if (params?.sort) query.set('sort', params.sort)
      query.set('page', String(params?.page || 1))
      query.set('pageSize', String(params?.pageSize || 20))
      const result = await get<{ items: Product[]; total: number }>(`/api/products?${query}`)
      if (result.success && result.data) {
        this.products = result.data.items
      }
    } catch (err: any) {
      this.error = err.message || 'Failed to fetch products'
    } finally {
      this.loading = false
    }
  },

  async fetchProduct(id: string): Promise<Product | null> {
    const { get } = useApi()
    const result = await get<Product>(`/api/products/${id}`)
    if (result.success && result.data) {
      this.currentProduct = result.data
      return result.data
    }
    return null
  },

  async purchaseProduct(productId: string): Promise<{ paymentUrl?: string } | null> {
    this.loading = true
    try {
      const { post } = useApi()
      const result = await post<{ orderId: string; paymentUrl?: string }>('/api/marketplace/orders', { productId })
      if (result.success && result.data) {
        this.purchasedProductIds.add(productId)
        if (result.data.paymentUrl) {
          // Stripe redirect flow
          window.location.href = result.data.paymentUrl
        }
        return result.data
      }
      return null
    } catch (err: any) {
      this.error = err.message || 'Purchase failed'
      throw err
    } finally {
      this.loading = false
    }
  },

  async fetchPurchasedProducts(): Promise<void> {
    const { get } = useApi()
    const result = await get<{ productIds: string[] }>('/api/marketplace/purchases')
    if (result.success && result.data) {
      this.purchasedProductIds = new Set(result.data.productIds)
    }
  },
}
```

**API contract reference**:
| Action | Method | Endpoint | Returns |
|--------|--------|----------|---------|
| fetchProducts | GET | `/api/products?category=&search=&sort=&page=&pageSize=` | `{ items: Product[], total: number }` |
| fetchProduct | GET | `/api/products/:id` | `Product` |
| purchaseProduct | POST | `/api/marketplace/orders` | `{ orderId, paymentUrl? }` |
| fetchPurchasedProducts | GET | `/api/marketplace/purchases` | `{ productIds: string[] }` |

### 5.2 `stores/creator.ts`

Remove all mock data. Replace with:

```typescript
// REMOVE: mockCreatorProducts (lines 34-78), mockSales (lines 81-87), generateEarnings (lines 90-101)
// REMOVE: state initialization: products: mockCreatorProducts, sales: mockSales, earnings: generateEarnings()
// CHANGE state to: products: [], sales: [], earnings: []

actions: {
  async fetchProducts(): Promise<void> {
    this.loading = true
    try {
      const { get } = useApi()
      const result = await get<{ items: ICreatorProduct[] }>('/api/creator/products')
      if (result.success && result.data) {
        this.products = result.data.items
      }
    } catch (err: any) {
      this.error = err.message || 'Failed to load products'
    } finally {
      this.loading = false
    }
  },

  async createProduct(data: Partial<ICreatorProduct>): Promise<ICreatorProduct | null> {
    this.loading = true
    try {
      const { post } = useApi()
      const result = await post<ICreatorProduct>('/api/creator/products', data)
      if (result.success && result.data) {
        this.products.push(result.data)
        return result.data
      }
      return null
    } catch (err: any) {
      this.error = err.message || 'Failed to create product'
      throw err
    } finally {
      this.loading = false
    }
  },

  async updateProduct(id: string, data: Partial<ICreatorProduct>): Promise<void> {
    const { put } = useApi()
    const result = await put<ICreatorProduct>(`/api/creator/products/${id}`, data)
    if (result.success && result.data) {
      const idx = this.products.findIndex(p => p.id === id)
      if (idx !== -1) this.products[idx] = result.data
    }
  },

  async toggleProductStatus(id: string): Promise<void> {
    const { put } = useApi()
    const result = await put<{ status: string }>(`/api/creator/products/${id}/status`)
    if (result.success) {
      const product = this.products.find(p => p.id === id)
      if (product) product.status = result.data!.status as CreatorProductStatus
    }
  },

  async deleteProduct(id: string): Promise<void> {
    const { del } = useApi()
    const result = await del(`/api/creator/products/${id}`)
    if (result.success) {
      this.products = this.products.filter(p => p.id !== id)
    }
  },

  async fetchDashboard(): Promise<ICreatorStats | null> {
    const { get } = useApi()
    const result = await get<ICreatorStats>('/api/creator/dashboard')
    return result.success ? result.data : null
  },

  async fetchEarnings(range?: TrendTimeRange): Promise<void> {
    const { get } = useApi()
    const result = await get<{ earnings: ICreatorEarning[]; sales: ICreatorSale[] }>(
      `/api/creator/earnings?range=${range || '30d'}`
    )
    if (result.success && result.data) {
      this.earnings = result.data.earnings
      this.sales = result.data.sales
    }
  },
}
```

### 5.3 `stores/credits.ts`

Remove mock data. Replace `recharge()`/`withdraw()` setTimeout operations:

```typescript
// REMOVE: mockTransactions (lines 44-55), mockWithdrawals (lines 58-61)
// REMOVE: state initialization balance: 1089.6000, transactions: mockTransactions, withdrawals: mockWithdrawals
// CHANGE state to: balance: 0, transactions: [], withdrawals: []

actions: {
  async recharge(amount: number, method: 'alipay' | 'wechat'): Promise<{ paymentUrl?: string } | null> {
    this.loading = true
    try {
      const { post } = useApi()
      const result = await post<{ orderId: string; paymentUrl: string }>('/api/credits/recharge', { amount, method })
      if (result.success && result.data?.paymentUrl) {
        // Redirect to payment provider
        window.location.href = result.data.paymentUrl
        return result.data
      }
      return null
    } catch (err: any) {
      this.error = err.message || 'Recharge failed'
      throw err
    } finally {
      this.loading = false
    }
  },

  async withdraw(amount: number, accountType: WithdrawAccountType, accountInfo: string): Promise<void> {
    this.loading = true
    try {
      const { post } = useApi()
      const result = await post<ICreditsWithdrawal>('/api/credits/withdrawals', { amount, accountType, accountInfo })
      if (result.success && result.data) {
        this.balance = result.data.balanceAfter || this.balance - amount
        this.refetchAfterWithdraw()
      }
    } catch (err: any) {
      this.error = err.message || 'Withdraw failed'
      throw err
    } finally {
      this.loading = false
    }
  },

  // fetchBalance(), fetchTransactions() already call real API (lines 104-132) — keep as-is
}
```

**API contract reference**:
| Action | Method | Endpoint |
|--------|--------|----------|
| fetchBalance | GET | `/api/credits/balance` |
| fetchTransactions | GET | `/api/credits/transactions?page=&pageSize=` |
| recharge | POST | `/api/credits/recharge` |
| withdraw | POST | `/api/credits/withdrawals` |

---

## 6. NEW Generation Store (`apps/landing/stores/generation.ts`)

```typescript
// apps/landing/stores/generation.ts
import { defineStore } from 'pinia'
import type {
  GenerationState, GenerationStatus, AppTemplateOption,
  DesignSchemeOption, DeployStatus, PreviewStatus, ProgressEvent, VerificationStepState,
} from '~/types/generation'

interface GenerationStoreState {
  generationState: GenerationState
  selectedTemplate: AppTemplateOption | null
  selectedDesignScheme: DesignSchemeOption | null
  previewStatus: PreviewStatus
  deployStatus: DeployStatus
  deployUrl: string | null
  availableTemplates: AppTemplateOption[]
  designSchemes: DesignSchemeOption[]
  verificationSteps: VerificationStepState[]
  socketSubscriptionId: string | null
}

const defaultTemplates: AppTemplateOption[] = [
  {
    id: 'vue-spa',
    name: 'Vue SPA',
    description: 'Single Page Application with Vue 3, Element Plus, and Vite',
    category: 'frontend',
    icon: 'tpl-vue',
    techStack: ['Vue 3', 'Element Plus', 'Tailwind CSS', 'Vite'],
  },
  {
    id: 'react-spa',
    name: 'React SPA',
    description: 'Modern React app with TypeScript and Ant Design',
    category: 'frontend',
    icon: 'tpl-react',
    techStack: ['React 18', 'TypeScript', 'Ant Design', 'Vite'],
  },
  {
    id: 'nuxt-ssr',
    name: 'Nuxt Fullstack',
    description: 'Full-stack app with Nuxt 3 SSR, API routes, and PostgreSQL',
    category: 'fullstack',
    icon: 'tpl-nuxt',
    techStack: ['Nuxt 3', 'Prisma', 'PostgreSQL', 'Tailwind CSS'],
  },
  {
    id: 'express-api',
    name: 'Express API',
    description: 'RESTful API with Express, TypeScript, and JWT auth',
    category: 'backend',
    icon: 'tpl-express',
    techStack: ['Node.js', 'Express', 'TypeScript', 'PostgreSQL'],
  },
  {
    id: 'next-fullstack',
    name: 'Next.js Fullstack',
    description: 'Full-stack app with Next.js, Server Components, and Vercel',
    category: 'fullstack',
    icon: 'tpl-next',
    techStack: ['Next.js 14', 'React', 'Prisma', 'Tailwind CSS'],
  },
]

const defaultSchemes: DesignSchemeOption[] = [
  {
    id: 'indigo',
    name: 'Indigo',
    colors: { primary: '#4f46e5', secondary: '#6366f1', accent: '#818cf8', background: '#fafafa', surface: '#ffffff', text: '#111827', textMuted: '#6b7280' },
    borderRadius: '8px',
    fontFamily: "'Inter', sans-serif",
    preview: 'linear-gradient(135deg, #4f46e5, #818cf8)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: { primary: '#0ea5e9', secondary: '#22d3ee', accent: '#67e8f9', background: '#f8fafc', surface: '#ffffff', text: '#0f172a', textMuted: '#64748b' },
    borderRadius: '12px',
    fontFamily: "'Inter', sans-serif",
    preview: 'linear-gradient(135deg, #0ea5e9, #67e8f9)',
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: { primary: '#059669', secondary: '#10b981', accent: '#34d399', background: '#fafafa', surface: '#ffffff', text: '#1f2937', textMuted: '#6b7280' },
    borderRadius: '6px',
    fontFamily: "'Inter', sans-serif",
    preview: 'linear-gradient(135deg, #059669, #34d399)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: { primary: '#f97316', secondary: '#fb923c', accent: '#fdba74', background: '#fff7ed', surface: '#ffffff', text: '#431407', textMuted: '#9a3412' },
    borderRadius: '10px',
    fontFamily: "'IBM Plex Sans', sans-serif",
    preview: 'linear-gradient(135deg, #f97316, #fdba74)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#c4b5fd', background: '#0f0f23', surface: '#1a1a2e', text: '#e2e8f0', textMuted: '#94a3b8' },
    borderRadius: '8px',
    fontFamily: "'Inter', sans-serif",
    preview: 'linear-gradient(135deg, #1a1a2e, #8b5cf6)',
  },
]

const defaultVerificationSteps: VerificationStepState[] = [
  { name: 'npm install', status: 'pending' },
  { name: 'tsc --noEmit', status: 'pending' },
  { name: 'eslint', status: 'pending' },
  { name: 'npm run build', status: 'pending' },
  { name: 'npm test', status: 'pending' },
]

export const useGenerationStore = defineStore('generation', {
  state: (): GenerationStoreState => ({
    generationState: {
      status: 'idle',
      currentStep: null,
      steps: [],
      progress: 0,
      errors: [],
      startedAt: null,
      completedAt: null,
    },
    selectedTemplate: null,
    selectedDesignScheme: null,
    previewStatus: 'stopped',
    deployStatus: 'none',
    deployUrl: null,
    availableTemplates: defaultTemplates,
    designSchemes: defaultSchemes,
    verificationSteps: [...defaultVerificationSteps],
    socketSubscriptionId: null,
  }),

  getters: {
    isGenerating: (state): boolean =>
      ['planning', 'generating', 'verifying'].includes(state.generationState.status),

    isReady: (state): boolean => state.generationState.status === 'ready',

    currentStatusLabel: (state): string => {
      const labels: Record<GenerationStatus, string> = {
        idle: 'Ready', planning: 'Planning...', generating: 'Generating Code...',
        verifying: 'Verifying...', ready: 'Build Ready', error: 'Error',
      }
      return labels[state.generationState.status]
    },
  },

  actions: {
    setTemplate(template: AppTemplateOption) {
      this.selectedTemplate = template
    },

    setDesignScheme(scheme: DesignSchemeOption) {
      this.selectedDesignScheme = scheme
    },

    updateGenerationState(partial: Partial<GenerationState>) {
      Object.assign(this.generationState, partial)
    },

    updateVerificationStep(name: string, update: Partial<VerificationStepState>) {
      const step = this.verificationSteps.find(s => s.name === name)
      if (step) Object.assign(step, update)
    },

    resetVerificationSteps() {
      this.verificationSteps = defaultVerificationSteps.map(s => ({ ...s }))
    },

    reset() {
      this.generationState = {
        status: 'idle', currentStep: null, steps: [],
        progress: 0, errors: [], startedAt: null, completedAt: null,
      }
      this.selectedTemplate = null
      this.selectedDesignScheme = null
      this.previewStatus = 'stopped'
      this.deployStatus = 'none'
      this.deployUrl = null
      this.verificationSteps = [...defaultVerificationSteps]
    },
  },

  persist: {
    key: 'agenthive:generation',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    pick: ['selectedTemplate', 'selectedDesignScheme'],
  },
})
```

---

## 7. NEW Composables

### 7.1 `composables/useChatSocket.ts` — Shared WebSocket via provide/inject

```typescript
// apps/landing/composables/useChatSocket.ts
import type { Socket } from 'socket.io-client'

const SOCKET_KEY = Symbol('chat-socket') as InjectionKey<{
  socket: Ref<Socket | null>
  connected: Ref<boolean>
  connect: (sessionId: string) => void
  disconnect: () => void
}>

export function useChatSocket() {
  const socket = inject(SOCKET_KEY)
  if (!socket) throw new Error('useChatSocket() must be used within a ChatPage that provides a socket instance')
  return socket
}
```

### 7.2 `composables/useGeneration.ts` — WebSocket listener for generation events

```typescript
// apps/landing/composables/useGeneration.ts
export function useGeneration() {
  const generationStore = useGenerationStore()
  const { socket, connected } = useChatSocket()

  function subscribeToGeneration(sessionId: string) {
    if (!socket.value) return
    socket.value.on('taskProgress', (event: ProgressEvent) => {
      switch (event.type) {
        case 'step_complete':
          generationStore.updateGenerationState({ progress: event.data.progress || 0 })
          break
        case 'tool_call':
          generationStore.updateGenerationState({
            currentStep: event.data.toolName || null
          })
          break
        case 'error':
          generationStore.updateGenerationState({
            status: 'error',
            errors: [...generationStore.generationState.errors, event.data.error || 'Unknown error']
          })
          break
      }
    })
    socket.value.on('preview:status', (data: { status: PreviewStatus; url?: string }) => {
      generationStore.previewStatus = data.status
    })
    socket.value.on('deploy:status', (data: { status: DeployStatus; url?: string }) => {
      generationStore.deployStatus = data.status
      if (data.url) generationStore.deployUrl = data.url
    })
  }

  onUnmounted(() => {
    if (socket.value) {
      socket.value.off('taskProgress')
      socket.value.off('preview:status')
      socket.value.off('deploy:status')
    }
    generationStore.reset()
  })

  return { subscribeToGeneration }
}
```

### 7.3 `composables/usePreview.ts` — iframe lifecycle management

```typescript
// apps/landing/composables/usePreview.ts
export function usePreview(projectId: Ref<string>) {
  const iframeRef = ref<HTMLIFrameElement>()
  const generationStore = useGenerationStore()
  const deviceMode = ref<'desktop' | 'tablet' | 'mobile'>('desktop')

  const previewUrl = computed(() => `/api/projects/${projectId.value}/preview/`)

  function reload() {
    if (iframeRef.value) {
      iframeRef.value.src = previewUrl.value
    }
  }

  function setDeviceMode(mode: 'desktop' | 'tablet' | 'mobile') {
    deviceMode.value = mode
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.origin + previewUrl.value)
      return true
    } catch { return false }
  }

  function openNewWindow() {
    window.open(previewUrl.value, '_blank', 'noopener,noreferrer')
  }

  // Auto-reconnect: when previewStatus transitions to 'ready', reload iframe
  watch(() => generationStore.previewStatus, (status) => {
    if (status === 'ready') reload()
  })

  return { iframeRef, previewUrl, deviceMode, reload, setDeviceMode, copyUrl, openNewWindow }
}
```

---

## 8. Implementation Sequencing (Dependency Order)

Each step lists the files created or modified. Steps are ordered so dependencies are resolved before consumers.

| Step | Description | Files |
|------|-------------|-------|
| **1** | Type definitions | `types/generation.ts` (NEW) |
| **2** | Generation store | `stores/generation.ts` (NEW) |
| **3** | Shared socket composable | `composables/useChatSocket.ts` (NEW) |
| **4** | Generation composable | `composables/useGeneration.ts` (NEW) |
| **5** | Preview composable | `composables/usePreview.ts` (NEW) |
| **6** | PreviewPanel component | `components/preview/PreviewPanel.vue` (NEW) |
| **7** | ChatPanel enhancements | `components/ChatPanel.vue` (MODIFY — add sections 4.1-4.5) |
| **8** | ChatPage 5-tab upgrade | `pages/chat/[chatId].vue` (MODIFY) |
| **9** | Store refactoring | `stores/marketplace.ts`, `stores/creator.ts`, `stores/credits.ts` (MODIFY) |
| **10** | E2E tests | New test files for generation flow |

### Step-by-Step Validation Gates

After each step, verify:
- **Step 1-2**: `npx tsc --noEmit` passes in `apps/landing`
- **Step 6**: PreviewPanel renders without console errors
- **Step 7**: ChatPanel existing message flow still works (smoke test)
- **Step 8**: All 5 tabs render; auto-switch fires correctly
- **Step 9**: Marketplace/Creator/Credits pages fetch real data (check network tab)
- **Step 10**: `npx playwright test` passes for new e2e specs

---

## 9. Key Integration Points

### 9.1 ChatPage -> ChatPanel communication

ChatPanel already accepts `embedded` prop (line 211). The chat page passes it as `embedded` (line 29). This pattern stays. The ChatPanel must additionally **emit** generation-related events so the parent page can auto-switch tabs:

```typescript
// New emits on ChatPanel:
const emit = defineEmits<{
  expand: []
  'generation:start': [template: AppTemplateOption, scheme: DesignSchemeOption]
  'generation:complete': []
}>()
```

### 9.2 ChatPanel -> GenerationStore

ChatPanel calls `generationStore.setTemplate()` and `generationStore.setDesignScheme()` directly (it imports the store). The store's reactive state drives the template/scheme UI visibility.

### 9.3 Socket lifecycle

- Socket is created once in ChatPanel's `onMounted` (line 530), stored in `chatStore` or provided via `useChatSocket`.
- PreviewPanel and LogsTab are consumers — they receive events via the shared socket, not by creating their own connections.
- On route leave, socket disconnects (ChatPanel's `onUnmounted`, line 583).

### 9.4 iframe sandbox

The preview iframe must use `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` (no `allow-top-navigation`). The preview server must set appropriate CORS headers for the iframe origin.

---

## 10. Style Conventions

All new code must follow existing patterns observed in the codebase:

- **Vue SFC**: `<script setup lang="ts">` with explicit imports from `vue`, `element-plus`, `@element-plus/icons-vue`
- **Pinia stores**: Options API style (`defineStore('name', { state, getters, actions, persist })`) to match existing `chat.ts`, `credits.ts`, etc.
- **CSS**: Scoped `<style scoped>`, Tailwind utilities via Element Plus class composition, custom properties sparingly
- **TypeScript**: Separate type files in `types/` directory; store-local types live in the store file
- **API calls**: Always through `useApi()` composable, never direct `fetch()`
- **No mock data**: All mock data (`mockProducts`, `mockTransactions`, `generateEarnings`, `defaultFileTree`) must be removed or replaced with real API calls
- **Persistence**: Pinia `persist` plugin with localStorage key prefix `agenthive:` as established by `chat.ts` (line 1145) and `marketplace.ts` (line 280)
