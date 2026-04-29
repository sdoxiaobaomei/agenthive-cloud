<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { ITrendDataPoint, TrendTimeRange } from '~/types/economy'

interface Props {
  data: ITrendDataPoint[]
  title?: string
  height?: number
  loading?: boolean
  timeRange?: TrendTimeRange
  dark?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 280,
  loading: false,
  timeRange: '30d',
  dark: false,
})

const emit = defineEmits<{
  changeRange: [range: TrendTimeRange]
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: any = null

const ranges: { label: string; value: TrendTimeRange }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
]

const initChart = async () => {
  if (!chartRef.value || !import.meta.client) return
  const echarts = await import('echarts')

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value)
  updateOption()
}

const updateOption = () => {
  if (!chartInstance) return

  const isDark = props.dark
  const textColor = isDark ? '#e2e8f0' : '#64748b'
  const gridColor = isDark ? '#334155' : '#e2e8f0'
  const lineColor = isDark ? '#60a5fa' : '#3b82f6'
  const areaColor = isDark
    ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(96,165,250,0.3)' }, { offset: 1, color: 'rgba(96,165,250,0.02)' }] }
    : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.2)' }, { offset: 1, color: 'rgba(59,130,246,0.02)' }] }

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: gridColor,
      textStyle: { color: textColor },
      formatter: (params: any[]) => {
        const p = params[0]
        return `<div style="font-weight:600">${p.name}</div><div>${p.value} credits</div>`
      },
    },
    grid: { left: 16, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.data.map(d => d.date.slice(5)),
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLabel: { color: textColor, fontSize: 11 },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      areaStyle: { color: areaColor },
      data: props.data.map(d => d.value),
    }],
  }, true)
}

watch(() => props.data, updateOption, { deep: true })
watch(() => props.dark, updateOption)

const handleResize = () => chartInstance?.resize()

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) { chartInstance.dispose(); chartInstance = null }
})
</script>

<template>
  <div class="trend-chart rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
    <div class="mb-4 flex items-center justify-between">
      <h3 v-if="title" class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ title }}</h3>
      <div class="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700">
        <button
          v-for="r in ranges"
          :key="r.value"
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="timeRange === r.value
            ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'"
          @click="emit('changeRange', r.value)"
        >
          {{ r.label }}
        </button>
      </div>
    </div>
    <ElSkeleton v-if="loading" :rows="3" animated />
    <div v-else ref="chartRef" :style="{ width: '100%', height: `${height}px` }" />
  </div>
</template>
