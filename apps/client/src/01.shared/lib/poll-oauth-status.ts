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

/** Bounds even an in-flight request, without leaving timers or listeners behind. */
async function runPolling(fetchStatus: () => Promise<AuthOAuthStatusDomain>, signal: AbortSignal, intervalMs: number): Promise<AuthOAuthStatusDomain> {
  while (!signal.aborted) {
    const result = await fetchStatus()

    if (signal.aborted)
      throw signal.reason

    if (result.status !== 'pending')
      return result

    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      const onAbort = () => {
        clearTimeout(timer)
        reject(signal.reason)
      }
      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, intervalMs)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  throw signal.reason
}

export async function pollOAuthStatus(fetchStatus: () => Promise<AuthOAuthStatusDomain>, options: PollOAuthStatusOptions): Promise<AuthOAuthStatusDomain> {
  if (options.signal.aborted)
    throw abortError()

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new RangeError('OAuth polling intervals and timeout must be positive finite numbers')

  const controller = new AbortController()
  const onAbort = () => controller.abort(abortError())
  options.signal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('OAuth polling timed out')), timeoutMs)
  let rejectOnAbort: () => void = () => {}
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
  })

  try {
    return await Promise.race([runPolling(fetchStatus, controller.signal, intervalMs), cancelled])
  }
  finally {
    clearTimeout(timer)
    options.signal.removeEventListener('abort', onAbort)
    controller.signal.removeEventListener('abort', rejectOnAbort)
  }
}
