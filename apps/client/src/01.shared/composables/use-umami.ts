declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: Record<string, unknown>) => Record<string, unknown>), eventData?: Record<string, unknown>) => void
      identify: (sessionIdOrData: string | Record<string, unknown>, customData?: Record<string, unknown>) => void
    }
  }
}

const queue: Array<() => void> = []
let isPolling = false

function processQueue() {
  if (typeof window !== 'undefined' && window.umami) {
    while (queue.length > 0) {
      const fn = queue.shift()
      if (fn)
        fn()
    }
  }
}

function enqueue(fn: () => void) {
  if (typeof window === 'undefined')
    return

  if (window.umami) {
    fn()
  }

  else {
    queue.push(fn)

    if (!isPolling) {
      isPolling = true
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (window.umami) {
          processQueue()
          clearInterval(interval)
          isPolling = false
        }
        else if (attempts > 100) {
          clearInterval(interval)
          isPolling = false
        }
      }, 100)
    }
  }
}

export function useUmami() {
  function trackEvent(eventName: string, eventData?: Record<string, unknown>) {
    enqueue(() => {
      window.umami?.track(eventName, eventData)
    })
  }

  function identifyUser(userData: Record<string, unknown> & { id?: string | number }) {
    enqueue(() => {
      if (window.umami?.identify) {
        if (userData.id !== undefined) {
          const { id, ...sessionData } = userData
          window.umami.identify(String(id), sessionData)
        }
        else {
          window.umami.identify(userData)
        }
      }
    })
  }

  function trackPageview(url: string, title?: string) {
    enqueue(() => {
      window.umami?.track(props => ({
        ...props,
        url,
        title: title || document.title,
      }))
    })
  }

  return { trackEvent, identifyUser, trackPageview }
}
