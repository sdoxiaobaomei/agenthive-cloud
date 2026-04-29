<script setup lang="ts">
import { ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue'
import type { TrendDirection } from '~/types/economy'

interface Props {
  title: string
  value: string | number
  prefix?: string
  suffix?: string
  trend?: TrendDirection
  trendValue?: string
  trendLabel?: string
  loading?: boolean
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

withDefaults(defineProps<Props>(), {
  prefix: '',
  suffix: '',
  trend: 'flat',
  trendValue: '',
  trendLabel: '',
  loading: false,
  color: 'primary',
})

const colorMap = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  danger: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  info: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}

const trendColor = {
  up: 'text-emerald-600 bg-emerald-50',
  down: 'text-red-600 bg-red-50',
  flat: 'text-slate-500 bg-slate-100',
}

const trendIcon = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
}
</script>

<template>
  <div
    class="data-card rounded-xl border p-5 transition-shadow hover:shadow-md"
    :class="[colorMap[color].bg, colorMap[color].border]"
  >
    <div class="flex items-start justify-between">
      <div>
        <span class="text-sm font-medium text-slate-500">{{ title }}</span>
        <div class="mt-2 flex items-baseline gap-1">
          <span v-if="prefix" class="text-lg text-slate-400">{{ prefix }}</span>
          <ElSkeleton v-if="loading" :rows="0" animated class="w-24">
            <template #template>
              <ElSkeletonItem variant="text" style="width: 80px; height: 32px" />
            </template>
          </ElSkeleton>
          <span v-else class="text-3xl font-bold tabular-nums text-slate-800">
            {{ value }}
          </span>
          <span v-if="suffix" class="text-sm text-slate-400">{{ suffix }}</span>
        </div>
      </div>
      <div
        v-if="trend !== 'flat' || trendValue"
        class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        :class="trendColor[trend]"
      >
        <component :is="trendIcon[trend]" class="h-3 w-3" />
        <span v-if="trendValue">{{ trendValue }}</span>
      </div>
    </div>
    <div v-if="trendLabel" class="mt-2 text-xs text-slate-400">
      {{ trendLabel }}
    </div>
  </div>
</template>

<style scoped>
.data-card {
  min-width: 180px;
}
</style>
