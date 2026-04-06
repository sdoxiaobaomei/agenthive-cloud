<template>
  <div
    :data-max-distance="maxDistance"
    class="pupil"
    :style="pupilStyle"
  />
</template>

<script setup lang="ts">
const {
  size = '12px',
  maxDistance = 5,
  pupilColor = 'black'
} = defineProps<{
  size?: string
  maxDistance?: number
  pupilColor?: string
}>()

const pupilStyle = {
  width: size,
  height: size,
  borderRadius: '50%',
  backgroundColor: pupilColor,
  willChange: 'transform'
}
</script>
