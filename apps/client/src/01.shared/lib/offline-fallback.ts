function getStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed))
      return parsed
  }

  return null
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object')
    return null

  const errorObject = error as Record<string, unknown>
  const response = errorObject.response as Record<string, unknown> | undefined

  return getStatus(errorObject.status)
    ?? getStatus(errorObject.statusCode)
    ?? getStatus(response?.status)
}

/**
 * Offline data is safe only when the server could not be reached or failed.
 * Never hide an authentication, permission, or not-found response with stale data.
 */
// eslint-disable-next-line complexity
export function canUseOfflineFallback(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== null)
    return status === 0 || status >= 500

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const isTimeout = error.name === 'TimeoutError'
      || message.includes('timed out')
      || message.includes('timeout')

    if (error.name === 'AbortError' && !isTimeout)
      return false

    return error.name === 'TypeError'
      || error.name === 'FetchError'
      || message.includes('failed to fetch')
      || message.includes('network error')
      || message.includes('fetch failed')
      || message.includes('error sending request')
      || isTimeout
      || message.includes('connection refused')
      || message.includes('dns')
  }

  return false
}
