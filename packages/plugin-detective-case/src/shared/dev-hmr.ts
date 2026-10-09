const REMOTE_HMR_EVENT = 'mf:remote-update'
export type DevHmrStatus = 'connected' | 'unavailable'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function connectDevRemoteHmr(onStatus?: (status: DevHmrStatus) => void): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  try {
    const endpoint = `${new URL(import.meta.url).origin}/__mf_hmr`
    const response = await fetch(endpoint, { cache: 'no-store' })
    if (!response.ok) {
      onStatus?.('unavailable')
      return
    }

    const contentType = response.headers.get('content-type') ?? 'unknown content type'
    const responseText = await response.text()
    let metadata: unknown

    try {
      metadata = JSON.parse(responseText) as unknown
    }
    catch {
      throw new Error(`Expected JSON from ${endpoint}, received ${contentType}`)
    }

    if (!isRecord(metadata) || metadata.event !== REMOTE_HMR_EVENT || typeof metadata.wsUrl !== 'string') {
      onStatus?.('unavailable')
      return
    }

    const wsUrl = new URL(metadata.wsUrl)
    const remoteUrl = new URL(import.meta.url)
    // Vite can move to the next free port; its HMR socket follows the remote origin.
    wsUrl.protocol = remoteUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl.host = remoteUrl.host

    const socket = new WebSocket(wsUrl.toString(), 'vite-hmr')
    let isReloading = false
    socket.addEventListener('open', () => onStatus?.('connected'))
    socket.addEventListener('error', () => onStatus?.('unavailable'))
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (isReloading || typeof event.data !== 'string') {
        return
      }

      try {
        const message: unknown = JSON.parse(event.data) as unknown
        if (isRecord(message) && message.type === 'custom' && message.event === REMOTE_HMR_EVENT) {
          isReloading = true
          window.location.reload()
        }
      }
      catch {
        // Ignore non-JSON Vite websocket messages.
      }
    })
  }
  catch (error: unknown) {
    console.warn('[Detective English] Dev HMR connection failed:', error)
    onStatus?.('unavailable')
  }
}
