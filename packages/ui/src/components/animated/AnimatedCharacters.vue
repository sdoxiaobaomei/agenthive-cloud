<template>
  <div ref="containerRef" :style="containerStyle">
    <!-- 蓝色角色 -->
    <div ref="blueRef" :style="blueBodyStyle">
      <div ref="blueFaceRef" :style="blueFaceStyle">
        <EyeBall size="18px" pupil-size="7px" :max-distance="5" eye-color="white" pupil-color="#171717" />
        <EyeBall size="18px" pupil-size="7px" :max-distance="5" eye-color="white" pupil-color="#171717" />
      </div>
    </div>

    <!-- 深灰角色 -->
    <div ref="darkRef" :style="darkBodyStyle">
      <div ref="darkFaceRef" :style="darkFaceStyle">
        <EyeBall size="16px" pupil-size="6px" :max-distance="4" eye-color="white" pupil-color="#171717" />
        <EyeBall size="16px" pupil-size="6px" :max-distance="4" eye-color="white" pupil-color="#171717" />
      </div>
    </div>

    <!-- 橙色角色 -->
    <div ref="orangeRef" :style="orangeBodyStyle">
      <div ref="orangeFaceRef" :style="orangeFaceStyle">
        <Pupil size="12px" :max-distance="5" pupil-color="#171717" />
        <Pupil size="12px" :max-distance="5" pupil-color="#171717" />
      </div>
    </div>

    <!-- 黄色角色 -->
    <div ref="yellowRef" :style="yellowBodyStyle">
      <div ref="yellowFaceRef" :style="yellowFaceStyle">
        <Pupil size="12px" :max-distance="5" pupil-color="#171717" />
        <Pupil size="12px" :max-distance="5" pupil-color="#171717" />
      </div>
      <div ref="yellowMouthRef" :style="yellowMouthStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch, toRef } from 'vue'
import gsap from 'gsap'
import Pupil from './Pupil.vue'
import EyeBall from './EyeBall.vue'

interface Props {
  isTyping?: boolean
  showPassword?: boolean
  passwordLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  isTyping: false,
  showPassword: false,
  passwordLength: 0
})

const containerRef = ref<HTMLElement | null>(null)
const mouseRef = reactive({ x: 0, y: 0 })
const rafIdRef = ref<number>(0)

const blueRef = ref<HTMLElement | null>(null)
const darkRef = ref<HTMLElement | null>(null)
const yellowRef = ref<HTMLElement | null>(null)
const orangeRef = ref<HTMLElement | null>(null)

const blueFaceRef = ref<HTMLElement | null>(null)
const darkFaceRef = ref<HTMLElement | null>(null)
const yellowFaceRef = ref<HTMLElement | null>(null)
const orangeFaceRef = ref<HTMLElement | null>(null)

const yellowMouthRef = ref<HTMLElement | null>(null)

const blueBlinkTimerRef = ref<ReturnType<typeof setTimeout>>()
const darkBlinkTimerRef = ref<ReturnType<typeof setTimeout>>()
const bluePeekTimerRef = ref<ReturnType<typeof setTimeout>>()

const isHidingPassword = toRef(() => props.passwordLength > 0 && !props.showPassword)
const isShowingPassword = toRef(() => props.passwordLength > 0 && props.showPassword)

const isLookingRef = ref(false)
const lookingTimerRef = ref<ReturnType<typeof setTimeout>>()

const stateRef = reactive({
  isTyping: false,
  isHidingPassword: false,
  isShowingPassword: false,
  isLooking: false
})

watch(
  () => [props.isTyping, isHidingPassword.value, isShowingPassword.value, isLookingRef.value] as const,
  ([isTyping, isHiding, isShowing, isLooking]) => {
    stateRef.isTyping = isTyping
    stateRef.isHidingPassword = isHiding
    stateRef.isShowingPassword = isShowing
    stateRef.isLooking = isLooking
  }
)

const quickToRef = ref<Record<string, any> | null>(null)

const containerStyle = {
  position: 'relative' as const,
  width: '550px',
  height: '400px'
}

const blueBodyStyle = ref<any>({
  position: 'absolute',
  bottom: 0,
  left: '70px',
  width: '180px',
  height: '400px',
  backgroundColor: '#4267ff',
  borderRadius: '10px 10px 0 0',
  zIndex: 1,
  transformOrigin: 'bottom center',
  willChange: 'transform'
})

const darkBodyStyle = ref<any>({
  position: 'absolute',
  bottom: 0,
  left: '240px',
  width: '120px',
  height: '310px',
  backgroundColor: '#171717',
  borderRadius: '8px 8px 0 0',
  zIndex: 2,
  transformOrigin: 'bottom center',
  willChange: 'transform'
})

const orangeBodyStyle = ref<any>({
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '240px',
  height: '200px',
  backgroundColor: '#ff8a3d',
  borderRadius: '120px 120px 0 0',
  zIndex: 3,
  transformOrigin: 'bottom center',
  willChange: 'transform'
})

const yellowBodyStyle = ref<any>({
  position: 'absolute',
  bottom: 0,
  left: '310px',
  width: '140px',
  height: '230px',
  backgroundColor: '#f4dc6e',
  borderRadius: '70px 70px 0 0',
  zIndex: 4,
  transformOrigin: 'bottom center',
  willChange: 'transform'
})

const blueFaceStyle = ref<any>({
  position: 'absolute',
  display: 'flex',
  gap: '32px',
  left: '45px',
  top: '40px'
})

const darkFaceStyle = ref<any>({
  position: 'absolute',
  display: 'flex',
  gap: '24px',
  left: '26px',
  top: '32px'
})

const orangeFaceStyle = ref<any>({
  position: 'absolute',
  display: 'flex',
  gap: '32px',
  left: '82px',
  top: '90px'
})

const yellowFaceStyle = ref<any>({
  position: 'absolute',
  display: 'flex',
  gap: '24px',
  left: '52px',
  top: '40px'
})

const yellowMouthStyle = ref<any>({
  position: 'absolute',
  width: '80px',
  height: '4px',
  backgroundColor: '#171717',
  borderRadius: '9999px',
  left: '40px',
  top: '88px'
})

onMounted(() => {
  gsap.set('.pupil', { x: 0, y: 0 })
  gsap.set('.eyeball-pupil', { x: 0, y: 0 })
})

onMounted(() => {
  if (
    !blueRef.value ||
    !darkRef.value ||
    !orangeRef.value ||
    !yellowRef.value ||
    !blueFaceRef.value ||
    !darkFaceRef.value ||
    !orangeFaceRef.value ||
    !yellowFaceRef.value ||
    !yellowMouthRef.value
  )
    return

  const qt = {
    blueSkew: gsap.quickTo(blueRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    darkSkew: gsap.quickTo(darkRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    orangeSkew: gsap.quickTo(orangeRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    yellowSkew: gsap.quickTo(yellowRef.value, 'skewX', { duration: 0.3, ease: 'power2.out' }),
    blueX: gsap.quickTo(blueRef.value, 'x', { duration: 0.3, ease: 'power2.out' }),
    darkX: gsap.quickTo(darkRef.value, 'x', { duration: 0.3, ease: 'power2.out' }),
    blueHeight: gsap.quickTo(blueRef.value, 'height', { duration: 0.3, ease: 'power2.out' }),
    blueFaceLeft: gsap.quickTo(blueFaceRef.value, 'left', { duration: 0.3, ease: 'power2.out' }),
    blueFaceTop: gsap.quickTo(blueFaceRef.value, 'top', { duration: 0.3, ease: 'power2.out' }),
    darkFaceLeft: gsap.quickTo(darkFaceRef.value, 'left', { duration: 0.3, ease: 'power2.out' }),
    darkFaceTop: gsap.quickTo(darkFaceRef.value, 'top', { duration: 0.3, ease: 'power2.out' }),
    orangeFaceX: gsap.quickTo(orangeFaceRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    orangeFaceY: gsap.quickTo(orangeFaceRef.value, 'y', { duration: 0.2, ease: 'power2.out' }),
    yellowFaceX: gsap.quickTo(yellowFaceRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    yellowFaceY: gsap.quickTo(yellowFaceRef.value, 'y', { duration: 0.2, ease: 'power2.out' }),
    mouthX: gsap.quickTo(yellowMouthRef.value, 'x', { duration: 0.2, ease: 'power2.out' }),
    mouthY: gsap.quickTo(yellowMouthRef.value, 'y', { duration: 0.2, ease: 'power2.out' })
  }
  quickToRef.value = qt

  const calcPos = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 3
    const dx = mouseRef.x - cx
    const dy = mouseRef.y - cy
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120))
    }
  }

  const calcEyePos = (el: HTMLElement, maxDist: number) => {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = mouseRef.x - cx
    const dy = mouseRef.y - cy
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDist)
    const angle = Math.atan2(dy, dx)
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }
  }

  const tick = () => {
    const container = containerRef.value
    if (!container) return

    const { isTyping: typing, isHidingPassword: hiding, isShowingPassword: showing, isLooking: looking } = stateRef

    if (blueRef.value && !showing) {
      const pp = calcPos(blueRef.value)
      if (typing || hiding) {
        qt.blueSkew(pp.bodySkew - 12)
        qt.blueX(40)
        qt.blueHeight(440)
      } else {
        qt.blueSkew(pp.bodySkew)
        qt.blueX(0)
        qt.blueHeight(400)
      }
    }

    if (darkRef.value && !showing) {
      const bp = calcPos(darkRef.value)
      if (looking) {
        qt.darkSkew(bp.bodySkew * 1.5 + 10)
        qt.darkX(20)
      } else if (typing || hiding) {
        qt.darkSkew(bp.bodySkew * 1.5)
        qt.darkX(0)
      } else {
        qt.darkSkew(bp.bodySkew)
        qt.darkX(0)
      }
    }

    if (orangeRef.value && !showing) {
      const op = calcPos(orangeRef.value)
      qt.orangeSkew(op.bodySkew)
    }

    if (yellowRef.value && !showing) {
      const yp = calcPos(yellowRef.value)
      qt.yellowSkew(yp.bodySkew)
    }

    if (blueRef.value && !showing && !looking) {
      const pp = calcPos(blueRef.value)
      const blueFaceX = pp.faceX >= 0 ? Math.min(25, pp.faceX * 1.5) : pp.faceX
      qt.blueFaceLeft(45 + blueFaceX)
      qt.blueFaceTop(40 + pp.faceY)
    }

    if (darkRef.value && !showing && !looking) {
      const bp = calcPos(darkRef.value)
      qt.darkFaceLeft(26 + bp.faceX)
      qt.darkFaceTop(32 + bp.faceY)
    }

    if (orangeRef.value && !showing) {
      const op = calcPos(orangeRef.value)
      qt.orangeFaceX(op.faceX)
      qt.orangeFaceY(op.faceY)
    }

    if (yellowRef.value && !showing) {
      const yp = calcPos(yellowRef.value)
      qt.yellowFaceX(yp.faceX)
      qt.yellowFaceY(yp.faceY)
      qt.mouthX(yp.faceX)
      qt.mouthY(yp.faceY)
    }

    if (!showing) {
      const allPupils = container.querySelectorAll('.pupil')
      allPupils.forEach((p) => {
        const el = p as HTMLElement
        const maxDist = Number(el.dataset.maxDistance) || 5
        const ePos = calcEyePos(el, maxDist)
        gsap.set(el, { x: ePos.x, y: ePos.y })
      })

      if (!looking) {
        const allEyeballs = container.querySelectorAll('.eyeball')
        allEyeballs.forEach((eb) => {
          const el = eb as HTMLElement
          const maxDist = Number(el.dataset.maxDistance) || 10
          const pupil = el.querySelector('.eyeball-pupil') as HTMLElement
          if (!pupil) return
          const ePos = calcEyePos(el, maxDist)
          gsap.set(pupil, { x: ePos.x, y: ePos.y })
        })
      }
    }

    rafIdRef.value = requestAnimationFrame(tick)
  }

  const onMove = (e: MouseEvent) => {
    mouseRef.x = e.clientX
    mouseRef.y = e.clientY
  }

  window.addEventListener('mousemove', onMove, { passive: true })
  rafIdRef.value = requestAnimationFrame(tick)

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMove)
    cancelAnimationFrame(rafIdRef.value)
  })
})

// Blue character blink
onMounted(() => {
  const blueEyeballs = blueRef.value?.querySelectorAll('.eyeball')
  if (!blueEyeballs?.length) return

  const scheduleBlink = () => {
    blueBlinkTimerRef.value = setTimeout(() => {
      blueEyeballs.forEach((el) => {
        gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' })
      })
      setTimeout(() => {
        blueEyeballs.forEach((el) => {
          const size = Number((el as HTMLElement).style.width.replace('px', '')) || 18
          gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' })
        })
        scheduleBlink()
      }, 150)
    }, Math.random() * 4000 + 3000)
  }

  scheduleBlink()
  onBeforeUnmount(() => clearTimeout(blueBlinkTimerRef.value))
})

// Dark character blink
onMounted(() => {
  const darkEyeballs = darkRef.value?.querySelectorAll('.eyeball')
  if (!darkEyeballs?.length) return

  const scheduleBlink = () => {
    darkBlinkTimerRef.value = setTimeout(() => {
      darkEyeballs.forEach((el) => {
        gsap.to(el, { height: 2, duration: 0.08, ease: 'power2.in' })
      })
      setTimeout(() => {
        darkEyeballs.forEach((el) => {
          const size = Number((el as HTMLElement).style.width.replace('px', '')) || 16
          gsap.to(el, { height: size, duration: 0.08, ease: 'power2.out' })
        })
        scheduleBlink()
      }, 150)
    }, Math.random() * 4000 + 3000)
  }

  scheduleBlink()
  onBeforeUnmount(() => clearTimeout(darkBlinkTimerRef.value))
})

const applyLookAtEachOther = () => {
  const qt = quickToRef.value
  if (qt) {
    qt.blueFaceLeft(55)
    qt.blueFaceTop(65)
    qt.darkFaceLeft(32)
    qt.darkFaceTop(12)
  }
  blueRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: 3, y: 4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
  darkRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: 0, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
}

const applyHidingPassword = () => {
  const qt = quickToRef.value
  if (qt) {
    qt.blueFaceLeft(55)
    qt.blueFaceTop(65)
  }
}

const applyShowPassword = () => {
  const qt = quickToRef.value
  if (qt) {
    qt.blueSkew(0)
    qt.darkSkew(0)
    qt.orangeSkew(0)
    qt.yellowSkew(0)
    qt.blueX(0)
    qt.darkX(0)
    qt.blueHeight(400)

    qt.blueFaceLeft(20)
    qt.blueFaceTop(35)
    qt.darkFaceLeft(10)
    qt.darkFaceTop(28)
    qt.orangeFaceX(50 - 82)
    qt.orangeFaceY(85 - 90)
    qt.yellowFaceX(20 - 52)
    qt.yellowFaceY(35 - 40)
    qt.mouthX(10 - 40)
    qt.mouthY(0)
  }

  blueRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
  darkRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
    gsap.to(p, { x: -4, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
  orangeRef.value?.querySelectorAll('.pupil').forEach((p) => {
    gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
  yellowRef.value?.querySelectorAll('.pupil').forEach((p) => {
    gsap.to(p, { x: -5, y: -4, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
  })
}

// Password peek effect
watch(
  () => [isShowingPassword.value, props.passwordLength],
  ([showing, len]) => {
    if (!showing || (len as number) <= 0) {
      clearTimeout(bluePeekTimerRef.value)
      return
    }

    const blueEyePupils = blueRef.value?.querySelectorAll('.eyeball-pupil')
    if (!blueEyePupils?.length) return

    const schedulePeek = () => {
      bluePeekTimerRef.value = setTimeout(() => {
        blueEyePupils.forEach((p) => {
          gsap.to(p, {
            x: 4,
            y: 5,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: 'auto'
          })
        })
        const qt = quickToRef.value
        if (qt) {
          qt.blueFaceLeft(20)
          qt.blueFaceTop(35)
        }

        setTimeout(() => {
          blueEyePupils.forEach((p) => {
            gsap.to(p, {
              x: -4,
              y: -4,
              duration: 0.3,
              ease: 'power2.out',
              overwrite: 'auto'
            })
          })
          schedulePeek()
        }, 800)
      }, Math.random() * 3000 + 2000)
    }

    schedulePeek()
    onBeforeUnmount(() => clearTimeout(bluePeekTimerRef.value))
  }
)

// Look at each other when typing
watch(
  () => [props.isTyping, isShowingPassword.value],
  ([typing, showing]) => {
    if (typing && !showing) {
      isLookingRef.value = true
      stateRef.isLooking = true
      applyLookAtEachOther()

      clearTimeout(lookingTimerRef.value)
      lookingTimerRef.value = setTimeout(() => {
        isLookingRef.value = false
        stateRef.isLooking = false
        blueRef.value?.querySelectorAll('.eyeball-pupil').forEach((p) => {
          gsap.killTweensOf(p)
        })
      }, 800)
    } else {
      clearTimeout(lookingTimerRef.value)
      isLookingRef.value = false
      stateRef.isLooking = false
    }
  }
)

// Password state effects
watch(
  () => [isShowingPassword.value, isHidingPassword.value],
  ([showing, hiding]) => {
    if (showing) {
      applyShowPassword()
    } else if (hiding) {
      applyHidingPassword()
    }
  }
)
</script>
