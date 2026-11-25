import type { ActivitySection } from '~/01.shared/types/schemas/activity.schema'
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'

const TICK_INTERVAL_MS = 5_000
const FLUSH_THRESHOLD_SECONDS = 30
const MIN_FLUSH_SECONDS = 5
const DEFAULT_IDLE_TIMEOUT_MS = 60_000
const READER_IDLE_TIMEOUT_MS = 90_000
const MAX_SINGLE_TICK_MS = 10_000

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

export function resolveActivitySection(routeName: unknown): ActivitySection {
  if (routeName === AppRouteNames.Reader)
    return 'reader'

  if (routeName === AppRouteNames.Dictionary || routeName === AppRouteNames.BookDeck)
    return 'srs'

  if (routeName === AppRouteNames.Home || routeName === AppRouteNames.BookInfo)
    return 'library'

  return 'other'
}

export function useActivityHeartbeat() {
  const { activity } = useRepos()
  const authStore = useAuthStore()
  const networkStore = useNetworkStore()
  const route = useRoute()

  let currentSection: ActivitySection = resolveActivitySection(route.name)
  let pendingMs = 0
  let lastTickAt = Date.now()
  let lastInteractionAt = Date.now()
  let timerId: ReturnType<typeof setInterval> | null = null

  function isVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible'
  }

  function isTrackingAllowed(): boolean {
    return Boolean(authStore.user) && !networkStore.effectiveOffline && isVisible()
  }

  function getIdleTimeoutMs(): number {
    return currentSection === 'reader' ? READER_IDLE_TIMEOUT_MS : DEFAULT_IDLE_TIMEOUT_MS
  }

  function accumulateElapsed(now: number = Date.now()): void {
    const delta = now - lastTickAt
    lastTickAt = now

    if (!isTrackingAllowed() || delta <= 0)
      return

    if (now - lastInteractionAt > getIdleTimeoutMs())
      return

    pendingMs += Math.min(delta, MAX_SINGLE_TICK_MS)
  }

  function flush(options?: { force?: boolean, keepalive?: boolean, sectionOverride?: ActivitySection }): void {
    accumulateElapsed()

    const seconds = Math.floor(pendingMs / 1000)
    const minRequired = options?.force ? MIN_FLUSH_SECONDS : FLUSH_THRESHOLD_SECONDS

    if (seconds < minRequired || !authStore.user || networkStore.effectiveOffline)
      return

    pendingMs -= seconds * 1000
    const section = options?.sectionOverride ?? currentSection

    void activity.sendHeartbeat(seconds, section, { keepalive: options?.keepalive }).catch(() => {})
  }

  function onInteraction(): void {
    const now = Date.now()
    lastInteractionAt = now
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      flush({ force: true, keepalive: true })
    }
    else {
      const now = Date.now()
      lastTickAt = now
      lastInteractionAt = now
    }
  }

  function onPageHide(): void {
    flush({ force: true, keepalive: true })
  }

  watch(() => route.name, (newRouteName) => {
    const nextSection = resolveActivitySection(newRouteName)

    if (nextSection !== currentSection) {
      const previousSection = currentSection
      flush({ force: true, sectionOverride: previousSection })
      currentSection = nextSection
      lastTickAt = Date.now()
      lastInteractionAt = Date.now()
    }
  })

  watch(() => authStore.user, (user) => {
    if (!user) {
      pendingMs = 0

      return
    }

    const now = Date.now()
    lastTickAt = now
    lastInteractionAt = now
  })

  onMounted(() => {
    const now = Date.now()
    lastTickAt = now
    lastInteractionAt = now

    for (const evt of INTERACTION_EVENTS)
      window.addEventListener(evt, onInteraction, { passive: true })

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    timerId = setInterval(() => {
      flush()
    }, TICK_INTERVAL_MS)
  })

  onUnmounted(() => {
    flush({ force: true, keepalive: true })

    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }

    for (const evt of INTERACTION_EVENTS)
      window.removeEventListener(evt, onInteraction)

    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
  })
}
