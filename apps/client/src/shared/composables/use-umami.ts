declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: any) => any), eventData?: Record<string, any>) => void
      identify: (sessionIdOrData: string | Record<string, any>, customData?: Record<string, any>) => void
    }
  }
}

export function useUmami() {
  function trackEvent(eventName: string, eventData?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData)
    }
  }

  function identifyUser(userData: { id: string | number } & Record<string, any>) {
    if (typeof window !== 'undefined' && window.umami && window.umami.identify) {
      window.umami.identify(userData)
    }
  }

  return { trackEvent, identifyUser }
}
