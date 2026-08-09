import { setFaroUser, trackFaroEvent } from '~/01.shared/services/monitoring.service'

export function useTracking() {
  function trackEvent(eventName: string, eventData?: Record<string, unknown>) {
    trackFaroEvent(eventName, eventData)
  }

  function identifyUser(userData: Record<string, unknown> & { id?: string | number, username?: string, role?: string }) {
    if (userData.id) {
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
