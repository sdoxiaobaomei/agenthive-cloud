<template>
  <div class="feature-gate relative">
    <slot />
    <div
      v-if="isLocked"
      class="feature-gate-lock absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm transition-all"
    >
      <LockedPanel :feature="feature" :tier="tier" @cta="$emit('cta')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LockedPanel from './LockedPanel.vue'

const props = defineProps<{
  feature: string
  tier: 'visitor' | 'free' | 'pro' | 'enterprise'
}>()

defineEmits<{
  (e: 'cta'): void
}>()

const isLocked = computed(() => {
  const required: Record<string, ('visitor' | 'free' | 'pro' | 'enterprise')[]> = {
    terminal: ['pro', 'enterprise'],
    sprint: ['pro', 'enterprise'],
    privateRepos: ['enterprise'],
  }
  const tiers = required[props.feature] || ['visitor']
  return !tiers.includes(props.tier)
})
</script>
