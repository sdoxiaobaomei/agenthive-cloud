<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { IPieChartItem } from '~/types/economy'

interface Props {
  data: IPieChartItem[]
  title?: string
  height?: number
  loading?: boolean
  dark?: boolean
  donut?: boolean
  centerText?: string
  centerSubtext?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 240,
  loading: false,
  dark: false,
  donut: true,
  centerText: '',
  centerSubtext: '',
})

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: any = null

const initChart = async () => {
  if (!chartRef.value || !import.meta.client) return
  const echarts = await import('echarts')

  if (chartInstance) chartInstance.dispose()
  chartInstance = echarts.init(chartRef.value)
  updateOption()
}

const updateOption = () => {
  if (!chartInstance) return

  const isDark = props.dark
  const textColor = isDark ? '#e2e8f0' : '#64748b'
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

  const option: any = {
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: textColor },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: props.donut ? ['45%', '72%'] : '65%',
      center: ['50%', '46%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: isDark ? '#1e293b' : '#ffffff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: textColor },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
      },
      data: props.data,
      color: colors,
    }],
  }

  if (props.donut && (props.centerText || props.centerSubtext)) {
    option.series[0].label = {
      show: true,
      position: 'center',
      formatter: () => `{title|${props.centerText}}\n{sub|${props.centerSubtext}}`,
      rich: {
        title: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#f1f5f9' : '#1e293b', lineHeight: 24 },
        sub: { fontSize: 12, color: textColor, lineHeight: 18 },
      },
    }
  }

  chartInstance.setOption(option, true)
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
  <div class="pie-chart rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
    <h3 v-if="title" class="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">{{ title }}</h3>
    <ElSkeleton v-if="loading" :rows="3" animated />
    <div v-else ref="chartRef" :style="{ width: '100%', height: `${height}px` }" />
  </div>
</template>
