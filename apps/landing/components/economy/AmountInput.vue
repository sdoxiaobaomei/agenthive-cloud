<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: number
  min?: number
  max?: number
  precision?: number
  placeholder?: string
  label?: string
  suffix?: string
  exchangeRate?: number
  fiatCurrency?: string
  disabled?: boolean
  size?: 'large' | 'default' | 'small'
  showFiat?: boolean
  quickAmounts?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: Infinity,
  precision: 4,
  placeholder: 'Enter amount',
  label: '',
  suffix: 'credits',
  exchangeRate: 0.1,
  fiatCurrency: 'CNY',
  disabled: false,
  size: 'default',
  showFiat: true,
  quickAmounts: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
  blur: [value: number]
  quickSelect: [value: number]
}>()

const innerValue = ref(props.modelValue)

watch(() => props.modelValue, (v) => {
  innerValue.value = v
})

const fiatValue = computed(() => {
  return (innerValue.value * props.exchangeRate).toFixed(2)
})

const handleChange = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) || 0 : val
  const clamped = Math.max(props.min, Math.min(props.max, num))
  const rounded = Math.round(clamped * 10 ** props.precision) / 10 ** props.precision
  innerValue.value = rounded
  emit('update:modelValue', rounded)
  emit('change', rounded)
}

const handleBlur = () => {
  emit('blur', innerValue.value)
}

const selectQuick = (amount: number) => {
  handleChange(amount)
  emit('quickSelect', amount)
}
</script>

<template>
  <div class="amount-input">
    <label v-if="label" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {{ label }}
    </label>

    <div class="relative">
      <ElInputNumber
        v-model="innerValue"
        :min="min"
        :max="max"
        :precision="precision"
        :placeholder="placeholder"
        :disabled="disabled"
        :size="size"
        controls-position="right"
        class="w-full"
        @change="handleChange"
        @blur="handleBlur"
      />
      <span class="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        {{ suffix }}
      </span>
    </div>

    <div v-if="showFiat" class="mt-1 text-xs text-slate-500 dark:text-slate-400">
      ≈ {{ fiatCurrency === 'CNY' ? '¥' : '$' }}{{ fiatValue }}
    </div>

    <div v-if="quickAmounts.length" class="mt-2 flex flex-wrap gap-2">
      <ElButton
        v-for="amt in quickAmounts"
        :key="amt"
        size="small"
        type="info"
        plain
        class="text-xs"
        @click="selectQuick(amt)"
      >
        {{ amt }}
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.amount-input :deep(.el-input-number .el-input__wrapper) {
  padding-right: 64px;
}
</style>
