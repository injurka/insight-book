import type { TelemetryEventName } from '~/01.shared/services/monitoring.service'
import { setTelemetryUser, trackEvent as trackTelemetryEvent } from '~/01.shared/services/monitoring.service'

export function useTracking() {
  function trackEvent(eventName: TelemetryEventName, eventData?: Record<string, unknown>) {
    trackTelemetryEvent(eventName, eventData)
  }

  function identifyUser(userData: Record<string, unknown> & { id?: string | number, username?: string, role?: string }) {
    if (userData.id !== undefined) {
      setTelemetryUser({
        id: userData.id,
        username: userData.username,
        role: typeof userData.role === 'string' ? userData.role : undefined,
      })
    }
  }

  function trackPageview(url: string, title?: string) {
    trackEvent('page_view', { url, title: title || document.title })
  }

  return { trackEvent, identifyUser, trackPageview }
}
