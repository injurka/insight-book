declare global {
  interface Window {
    umami?: {
      track: (eventName: string | ((props: any) => any), eventData?: Record<string, any>) => void
      identify: (sessionIdOrData: string | Record<string, any>, customData?: Record<string, any>) => void
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
  function trackEvent(eventName: string, eventData?: Record<string, any>) {
    enqueue(() => {
      window.umami?.track(eventName, eventData)
    })
  }

  function identifyUser(userData: { id: string | number } & Record<string, any>) {
    enqueue(() => {
      if (window.umami?.identify) {
        const { id, ...sessionData } = userData
        window.umami.identify(String(id), sessionData)
      }
    })
  }

  return { trackEvent, identifyUser }
}
