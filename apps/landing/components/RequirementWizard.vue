<template>
  <div class="bg-white rounded-2xl border border-gray-200 p-5 h-full overflow-y-auto">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <span>📋</span> 需求建模助手
    </h3>
    
    <!-- Step 1: Input -->
    <div v-if="step === 1" class="space-y-4">
      <p class="text-sm text-gray-600">输入您的原始需求，AI 将帮您扩展并建模。</p>
      <textarea
        v-model="requirement"
        rows="4"
        placeholder="例如：我想要一个个人博客网站..."
        class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
      />
      <button
        @click="expandRequirement"
        :disabled="!requirement.trim() || loading"
        class="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
      >
        <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span>AI 扩展需求</span>
      </button>
    </div>
    
    <!-- Step 2: Options -->
    <div v-else-if="step === 2" class="space-y-4">
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <button @click="step = 1" class="hover:text-gray-700">← 返回</button>
        <span>|</span>
        <span>基于您的需求，我们识别了以下选项</span>
      </div>
      
      <div class="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <div class="text-xs font-medium text-amber-700 mb-1">原始需求</div>
        <div class="text-sm text-amber-900">{{ requirement }}</div>
      </div>
      
      <div class="space-y-3">
        <div
          v-for="(option, i) in expandedOptions"
          :key="i"
          class="border rounded-xl p-4 transition-all cursor-pointer"
          :class="selectedOptions.has(i) ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-500/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'"
          @click="toggleOption(i)"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors"
              :class="selectedOptions.has(i) ? 'bg-primary-500 border-primary-500' : 'border-gray-300'"
            >
              <svg v-if="selectedOptions.has(i)" class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="flex-1">
              <div class="font-medium text-sm text-gray-900">{{ option.title }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ option.description }}</div>
              <div class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="tag in option.tags"
                  :key="tag"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button
        @click="convertToFeatures"
        :disabled="selectedOptions.size === 0"
        class="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
      >
        生成 Feature & Todo ({{ selectedOptions.size }})
      </button>
    </div>
    
    <!-- Step 3: Features & Todos -->
    <div v-else-if="step === 3" class="space-y-4">
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <button @click="step = 2" class="hover:text-gray-700">← 返回</button>
        <span>|</span>
        <span>已生成的任务清单</span>
      </div>
      
      <div class="space-y-4">
        <div
          v-for="feature in features"
          :key="feature.id"
          class="border border-gray-200 rounded-xl overflow-hidden"
        >
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <span class="text-primary-600 font-semibold text-sm">{{ feature.id }}</span>
              <span class="font-medium text-sm text-gray-900">{{ feature.title }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">{{ feature.description }}</div>
          </div>
          <div class="p-3 space-y-2">
            <div
              v-for="todo in feature.todos"
              :key="todo.id"
              class="flex items-center gap-3 px-3 py-2 bg-white border border-gray-100 rounded-lg"
            >
              <div class="w-2 h-2 rounded-full"
                :class="priorityColor(todo.priority)"
              />
              <span class="flex-1 text-sm text-gray-700">{{ todo.title }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {{ todo.assignee }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <button
        @click="emit('export', features)"
        class="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
      >
        <span>🚀</span>
        <span>导出到 Sprint 看板</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Option {
  title: string
  description: string
  tags: string[]
}

interface Todo {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  assignee: string
}

interface Feature {
  id: string
  title: string
  description: string
  todos: Todo[]
}

const step = ref(1)
const requirement = ref('')
const loading = ref(false)
const expandedOptions = ref<Option[]>([])
const selectedOptions = ref<Set<number>>(new Set())
const features = ref<Feature[]>([])

const emit = defineEmits<{ export: [features: Feature[]] }>()

function expandRequirement() {
  loading.value = true
  // Simulate AI expansion
  setTimeout(() => {
    expandedOptions.value = generateOptions(requirement.value)
    selectedOptions.value = new Set(expandedOptions.value.map((_, i) => i))
    step.value = 2
    loading.value = false
  }, 1200)
}

function generateOptions(req: string): Option[] {
  const base = req.toLowerCase()
  const options: Option[] = []
  
  if (base.includes('博客') || base.includes('blog')) {
    options.push(
      { title: '文章发布系统', description: '支持 Markdown 编辑、草稿箱、定时发布、标签分类', tags: ['核心功能', '内容管理'] },
      { title: '响应式主题', description: '适配移动端和桌面端，支持暗色模式切换', tags: ['UI/UX', '前端'] },
      { title: 'SEO 优化', description: '自动生成 sitemap、meta 标签、结构化数据', tags: ['SEO', '营销'] },
      { title: '评论系统', description: '嵌套评论、反垃圾、邮件通知', tags: ['社交', '后端'] },
      { title: 'RSS / Newsletter', description: 'RSS 订阅、邮件订阅推送新文章', tags: ['分发', '集成'] },
      { title: '访问分析', description: '文章阅读量、访客来源、热门内容统计', tags: ['数据', '分析'] }
    )
  } else if (base.includes('电商') || base.includes('商城') || base.includes('shop')) {
    options.push(
      { title: '商品目录', description: '多级分类、SKU 管理、库存追踪', tags: ['核心功能', '商品'] },
      { title: '购物车 & 结算', description: '优惠券、运费计算、多种支付方式', tags: ['交易', '支付'] },
      { title: '订单管理', description: '订单状态流转、物流追踪、售后处理', tags: ['运营', '后端'] },
      { title: '用户中心', description: '地址管理、收藏、历史订单、会员等级', tags: ['用户', 'C端'] },
      { title: '后台管理系统', description: '商品上下架、订单处理、数据报表', tags: ['B端', '管理'] }
    )
  } else {
    options.push(
      { title: '用户认证系统', description: '注册登录、OAuth、密码找回、权限控制', tags: ['安全', '基础'] },
      { title: '响应式界面设计', description: '现代化 UI、动画效果、无障碍支持', tags: ['UI/UX', '前端'] },
      { title: '数据持久化', description: '数据库设计、API 开发、缓存策略', tags: ['后端', '数据'] },
      { title: '监控与日志', description: '错误追踪、性能监控、操作审计', tags: ['运维', 'DevOps'] },
      { title: '自动化测试', description: '单元测试、E2E 测试、CI/CD 集成', tags: ['质量', '测试'] },
      { title: '文档与部署', description: 'API 文档、用户手册、一键部署', tags: ['文档', '部署'] }
    )
  }
  
  return options
}

function toggleOption(i: number) {
  const next = new Set(selectedOptions.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  selectedOptions.value = next
}

function convertToFeatures() {
  const selected = expandedOptions.value.filter((_, i) => selectedOptions.value.has(i))
  features.value = selected.map((opt, i) => ({
    id: `FEAT-${String(i + 1).padStart(3, '0')}`,
    title: opt.title,
    description: opt.description,
    todos: [
      { id: `${i + 1}-1`, title: `需求分析: ${opt.title}`, priority: 'high' as const, assignee: 'Product Manager' },
      { id: `${i + 1}-2`, title: `技术方案设计`, priority: 'high' as const, assignee: 'Tech Lead' },
      { id: `${i + 1}-3`, title: `前端实现`, priority: 'medium' as const, assignee: 'Frontend Dev' },
      { id: `${i + 1}-4`, title: `后端 API 开发`, priority: 'medium' as const, assignee: 'Backend Dev' },
      { id: `${i + 1}-5`, title: `测试与验收`, priority: 'medium' as const, assignee: 'QA Engineer' },
    ]
  }))
  step.value = 3
}

function priorityColor(p: string) {
  const map: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-green-500',
  }
  return map[p] || 'bg-gray-400'
}
</script>
