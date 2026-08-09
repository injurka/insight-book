import type { FaroEventName } from '~/01.shared/services/monitoring.service'
import { setFaroUser, trackFaroEvent } from '~/01.shared/services/monitoring.service'

export function useTracking() {
  function trackEvent(eventName: FaroEventName, eventData?: Record<string, unknown>) {
    trackFaroEvent(eventName, eventData)
  }

  function identifyUser(userData: Record<string, unknown> & { id?: string | number, username?: string, role?: string }) {
    if (userData.id !== undefined) {
      setFaroUser({
        id: userData.id,
        username: userData.username,
        role: typeof userData.role === 'string' ? userData.role : undefined,
      })
    }
  }

  function trackPageview(url: string, title?: string) {
    trackFaroEvent('page_view', { url, title: title || document.title })
  }

  return { trackEvent, identifyUser, trackPageview }
}
