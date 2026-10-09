import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

/** One geometry contract for the panel, workspace and debug overlay (CSS pixels). */
export function useGameLayout() {
  const rootRef = ref<HTMLElement | null>(null)
  const viewport = reactive({ width: 0, height: 0 })
  const isCompact = computed(() => viewport.width < 1000 || viewport.height < 600)
  const isPanelOpen = ref(false)
  const gap = computed(() => Math.round(Math.max(8, Math.min(24, viewport.width * 0.015))))
  const panelWidth = computed(() => isCompact.value
    ? Math.max(0, Math.min(480, viewport.width - gap.value * 2))
    : Math.round(Math.max(320, Math.min(420, viewport.width * 0.3))))
  const layoutStyle = computed(() => ({
    '--game-gap': `${gap.value}px`,
    '--panel-width': `${panelWidth.value}px`,
    '--panel-reserve': `${!isCompact.value && isPanelOpen.value ? panelWidth.value + gap.value : 0}px`,
  }))
  let observer: ResizeObserver | undefined
  let initialized = false

  function measure() {
    const rect = rootRef.value?.getBoundingClientRect()

    if (!rect)
      return

    viewport.width = Math.round(rect.width)
    viewport.height = Math.round(rect.height)

    if (!initialized && rect.width > 0 && rect.height > 0) {
      isPanelOpen.value = !isCompact.value
      initialized = true
    }
  }

  watch(isCompact, compact => isPanelOpen.value = !compact)
  onMounted(() => {
    measure()
    observer = new ResizeObserver(measure)

    if (rootRef.value)
      observer.observe(rootRef.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return {
    rootRef,
    viewport,
    isCompact,
    isPanelOpen,
    panelWidth,
    layoutStyle,
  }
}
