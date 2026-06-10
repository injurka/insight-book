declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: any) => any), eventData?: Record<string, any>) => void
      identify: (userData: Record<string, string | number>) => void
    }
  }
}

export function useUmami() {
  function trackEvent(eventName: string, eventData?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData)
    }
  }

  function identifyUser(userData: Record<string, string | number>) {
    if (typeof window !== 'undefined' && window.umami && window.umami.identify) {
      window.umami.identify(userData)
    }
  }

  return { trackEvent, identifyUser }
}
