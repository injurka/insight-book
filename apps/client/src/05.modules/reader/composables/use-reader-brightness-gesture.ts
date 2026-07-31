import { onMounted, onUnmounted, ref } from 'vue'
import { useHaptic } from '~/01.shared/composables/use-haptic'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'

export function useReaderBrightnessGesture() {
  const settingsStore = useGlobalSettingsStore()
  const { hapticLight } = useHaptic()

  const isSwiping = ref(false)
  const showHud = ref(false)
  let hideHudTimer: ReturnType<typeof setTimeout> | null = null

  let startX = 0
  let startY = 0
  let initialBrightness = 1
  let isGestureLocked = false

  function triggerHud() {
    showHud.value = true
    if (hideHudTimer) {
      clearTimeout(hideHudTimer)
    }
    hideHudTimer = setTimeout(() => {
      showHud.value = false
    }, 1200)
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1)
      return

    const touch = e.touches[0]
    if (!touch)
      return

    const windowWidth = window.innerWidth
    const leftZoneThreshold = Math.max(windowWidth * 0.3, 120)

    if (touch.clientX <= leftZoneThreshold) {
      startX = touch.clientX
      startY = touch.clientY
      initialBrightness = settingsStore.readerBrightness ?? 1.0
      isGestureLocked = false
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (startX === 0 && startY === 0)
      return

    const touch = e.touches[0]
    if (!touch)
      return

    const deltaX = Math.abs(touch.clientX - startX)
    const deltaY = startY - touch.clientY // UP is positive (increases brightness), DOWN is negative (decreases brightness)

    if (!isGestureLocked) {
      if (Math.abs(deltaY) > 6 && Math.abs(deltaY) > deltaX * 1.1) {
        isGestureLocked = true
        isSwiping.value = true
      }
      else if (deltaX > 15) {
        startX = 0
        startY = 0
        return
      }
    }

    if (isGestureLocked) {
      if (e.cancelable) {
        e.preventDefault()
      }

      const sensitivity = Math.min(window.innerHeight * 0.45, 350)
      const change = deltaY / sensitivity
      const nextBrightness = Math.min(1.0, Math.max(0.02, initialBrightness + change))

      const roundedBrightness = Number(nextBrightness.toFixed(2))
      if (settingsStore.readerBrightness !== roundedBrightness) {
        settingsStore.readerBrightness = roundedBrightness
        hapticLight()
      }

      triggerHud()
    }
  }

  function handleTouchEnd() {
    if (isGestureLocked) {
      triggerHud()
    }
    startX = 0
    startY = 0
    isGestureLocked = false
    isSwiping.value = false
  }

  onMounted(() => {
    window.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true })
    window.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false })
    window.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd as EventListener, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('touchstart', handleTouchStart as EventListener)
    window.removeEventListener('touchmove', handleTouchMove as EventListener)
    window.removeEventListener('touchend', handleTouchEnd as EventListener)
    window.removeEventListener('touchcancel', handleTouchEnd as EventListener)
    if (hideHudTimer) {
      clearTimeout(hideHudTimer)
    }
  })

  return {
    isSwiping,
    showHud,
  }
}
