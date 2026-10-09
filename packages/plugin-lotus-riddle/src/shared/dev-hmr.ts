import { record } from './contracts'

function reloadForUpdate(event: MessageEvent<unknown>) {
  if (typeof event.data !== 'string')
    return

  try {
    const message: unknown = JSON.parse(event.data)

    if (record(message) && message.type === 'custom' && message.event === 'mf:remote-update')
      window.location.reload()
  }
  catch { /* Ignore Vite protocol messages other than remote updates. */ }
}
export async function connectDevRemoteHmr(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined')
    return

  try {
    const remote = new URL(import.meta.url)
    const response = await fetch(`${remote.origin}/__mf_hmr`)

    if (!response.ok)
      return

    const metadata: unknown = await response.json()

    if (!record(metadata) || metadata.event !== 'mf:remote-update' || typeof metadata.wsUrl !== 'string')
      return

    const endpoint = new URL(metadata.wsUrl)
    endpoint.host = remote.host
    endpoint.protocol = remote.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(endpoint, 'vite-hmr')
    socket.addEventListener('message', reloadForUpdate)
    window.addEventListener('pagehide', () => socket.close(), { once: true })
  }
  catch { /* HMR is optional and must not affect gameplay. */ }
}
