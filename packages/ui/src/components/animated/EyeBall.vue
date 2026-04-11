<template>
  <div
    class="eyeball"
    :data-max-distance="maxDistance"
    :style="eyeballStyle"
  >
    <div
      class="eyeball-pupil"
      :style="pupilStyle"
    />
  </div>
</template>

<script setup lang="ts">
const {
  size = '48px',
  pupilSize = '16px',
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black'
} = defineProps<{
  size?: string
  pupilSize?: string
  maxDistance?: number
  eyeColor?: string
  pupilColor?: string
}>()

const eyeballStyle = {
  width: size,
  height: size,
  borderRadius: '50%',
  backgroundColor: eyeColor,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  willChange: 'height'
}

const pupilStyle = {
  width: pupilSize,
  height: pupilSize,
  borderRadius: '50%',
  backgroundColor: pupilColor,
  willChange: 'transform'
}
</script>
