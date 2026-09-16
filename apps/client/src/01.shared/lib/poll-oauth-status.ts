import type { AuthOAuthStatusDomain } from '~/01.shared/types/schemas/auth.schema'

const DEFAULT_INTERVAL_MS = 2_000
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1_000

interface PollOAuthStatusOptions {
  signal: AbortSignal
  intervalMs?: number
  timeoutMs?: number
}

function abortError(): Error {
  const error = new Error('OAuth polling aborted')
  error.name = 'AbortError'

  return error
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())

      return
    }

    let timeoutId: number
    const onAbort = () => {
      window.clearTimeout(timeoutId)
      signal.removeEventListener('abort', onAbort)
      reject(abortError())
    }

    timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function pollOAuthStatus(fetchStatus: () => Promise<AuthOAuthStatusDomain>, options: PollOAuthStatusOptions): Promise<AuthOAuthStatusDomain> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  while (Date.now() < deadline) {
    if (options.signal.aborted)
      throw abortError()

    const result = await fetchStatus()
    if (result.status !== 'pending')
      return result

    await wait(Math.min(intervalMs, Math.max(0, deadline - Date.now())), options.signal)
  }

  throw new Error('OAuth polling timed out')
}
