const REMOTE_HMR_EVENT = 'mf:remote-update'
export type DevHmrStatus = 'connected' | 'unavailable'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSocketUrl(metadata: unknown, remoteUrl: URL): URL | null {
  if (!isRecord(metadata) || metadata.event !== REMOTE_HMR_EVENT || typeof metadata.wsUrl !== 'string') {
    return null
  }

  const wsUrl = new URL(metadata.wsUrl)
  wsUrl.protocol = remoteUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  wsUrl.host = remoteUrl.host

  return wsUrl
}

function handleSocketMessage(event: MessageEvent<unknown>, isReloading: { value: boolean }): void {
  if (isReloading.value || typeof event.data !== 'string') {
    return
  }

  try {
    const message: unknown = JSON.parse(event.data) as unknown

    if (isRecord(message) && message.type === 'custom' && message.event === REMOTE_HMR_EVENT) {
      isReloading.value = true
      window.location.reload()
    }
  }
  catch {
    // Ignore non-JSON Vite websocket messages.
  }
}

function connectSocket(url: URL, onStatus?: (status: DevHmrStatus) => void): void {
  const socket = new WebSocket(url.toString(), 'vite-hmr')
  const isReloading = { value: false }

  socket.addEventListener('open', () => onStatus?.('connected'))
  socket.addEventListener('error', () => onStatus?.('unavailable'))
  socket.addEventListener('message', event => handleSocketMessage(event, isReloading))
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
    const metadata: unknown = (() => {
      try {
        return JSON.parse(responseText) as unknown
      }
      catch {
        throw new Error(`Expected JSON from ${endpoint}, received ${contentType}`)
      }
    })()

    const wsUrl = getSocketUrl(metadata, new URL(import.meta.url))

    if (!wsUrl) {
      onStatus?.('unavailable')

      return
    }

    connectSocket(wsUrl, onStatus)
  }
  catch (error: unknown) {
    console.warn('[Detective English] Dev HMR connection failed:', error)
    onStatus?.('unavailable')
  }
}
