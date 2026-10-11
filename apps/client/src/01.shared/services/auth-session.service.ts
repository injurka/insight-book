import type { AuthSessionDomain } from '../types/schemas/auth.schema'
import { AuthSessionSchema } from '../types/schemas/auth.schema'

const SESSION_KEY = 'insight_session'
const TOKEN_KEY = 'insight_token'
let sessionRevision = 0

export function authSessionSnapshot(): string {
  return `${sessionRevision}:${authSessionIdentity() || ''}`
}

interface StoredSession {
  id: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function cancelled(): Error {
  return new DOMException('Session changed during request', 'AbortError')
}

function stored(): StoredSession | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')

    if (!value || typeof value !== 'object')
      return null

    const session = value as Partial<StoredSession>

    if (typeof session.id !== 'string' || typeof session.accessToken !== 'string'
      || typeof session.refreshToken !== 'string' || typeof session.expiresAt !== 'number') {
      return null
    }

    // A legacy callback or another tab may have replaced just the access token.
    return localStorage.getItem(TOKEN_KEY) === session.accessToken ? session as StoredSession : null
  }
  catch {
    return null
  }
}

export function authSessionIdentity(): string | null {
  return stored()?.id || localStorage.getItem(TOKEN_KEY)
}

export function clearAuthSession(): void {
  ++sessionRevision
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

export function acceptAuthSession(value: { token?: string, accessToken?: string, refreshToken?: string, expiresIn?: number }, id: string = crypto.randomUUID()): void {
  const sameSession = authSessionIdentity() === id
  const accessToken = value.accessToken || value.token

  if (!accessToken)
    throw new Error('Missing access token')

  if (value.accessToken !== undefined)
    AuthSessionSchema.parse(value)

  const pair = AuthSessionSchema.safeParse(value)

  if (pair.success) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ...pair.data, expiresAt: Date.now() + pair.data.expiresIn * 1000 }))
  }
  else {
    localStorage.removeItem(SESSION_KEY)
  }

  if (!sameSession)
    ++sessionRevision

  localStorage.setItem(TOKEN_KEY, accessToken)
}

async function serialized<T>(name: string, run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request)
    return navigator.locks.request(name, run)

  return run()
}

function needsRenewal(session: StoredSession | null, failedToken: string | undefined, retryAt: number): boolean {
  if (failedToken && (session?.accessToken || localStorage.getItem(TOKEN_KEY)) !== failedToken)
    return false

  if (session && !failedToken && session.expiresAt > Date.now() + 30_000)
    return false

  return !!session || Date.now() >= retryAt
}

function assertSession(identity: string | null): void {
  if (authSessionIdentity() !== identity)
    throw cancelled()
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit, token?: string | null): Headers {
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))

  if (token)
    headers.set('Authorization', `Bearer ${token}`)
  else
    headers.delete('Authorization')

  return headers
}

function shouldRetry(response: Response, token: string | null): boolean {
  return response.status === 401 && !!token && !!stored()
}

/** One refresh per tab, plus a browser lock across tabs sharing localStorage. */
export class AuthSessionManager {
  private pending: Promise<void> | null = null
  private legacyRetryAt = 0

  constructor(private transport: Transport, private baseUrl: string) {
    this.baseUrl = new URL(baseUrl || '/', location.origin).href.replace(/\/$/, '')
  }

  private async sessionRequest(path: string, body?: object, token?: string): Promise<Response> {
    return this.transport(`${this.baseUrl}/api/auth/session/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
  }

  async logout(): Promise<void> {
    const session = stored()
    clearAuthSession()

    if (session) {
      const response = await this.sessionRequest('logout', { refreshToken: session.refreshToken })

      if (!response.ok)
        throw new Error('Could not revoke the remote session')
    }
  }

  private rotateOnServer(session: StoredSession | null): Promise<Response> {
    if (session)
      return this.sessionRequest('refresh', { refreshToken: session.refreshToken })

    return this.sessionRequest('upgrade', undefined, localStorage.getItem(TOKEN_KEY) || undefined)
  }

  private async renew(failedToken?: string): Promise<void> {
    const identity = authSessionIdentity()

    if (!identity)
      return

    const session = stored()

    if (!needsRenewal(session, failedToken, this.legacyRetryAt))
      return

    const response = await this.rotateOnServer(session)

    if (authSessionIdentity() !== identity)
      await this.checkRotationResponse(response, identity)

    if (!session && !response.ok) {
      // Keep existing 30-day sessions usable against older deployments.
      this.legacyRetryAt = Date.now() + 300_000

      return
    }

    this.checkRefreshStatus(response)
    const pair: AuthSessionDomain = AuthSessionSchema.parse(await response.json())

    if (authSessionIdentity() !== identity) {
      this.revokeDiscardedPair(pair)
      throw cancelled()
    }

    acceptAuthSession(pair, identity)
  }

  private revokeDiscardedPair(pair: AuthSessionDomain): void {
    void this.sessionRequest('logout', { refreshToken: pair.refreshToken }).catch(() => {})
  }

  discard(value: unknown): void {
    const pair = AuthSessionSchema.safeParse(value)

    if (pair.success)
      this.revokeDiscardedPair(pair.data)
  }

  private async checkRotationResponse(response: Response, identity: string): Promise<void> {
    if (authSessionIdentity() === identity)
      return

    if (response.ok) {
      const pair = AuthSessionSchema.safeParse(await response.json())

      if (pair.success)
        this.revokeDiscardedPair(pair.data)
    }

    throw cancelled()
  }

  private checkRefreshStatus(response: Response): void {
    if (response.ok)
      return

    if (response.status === 401 || response.status === 403)
      clearAuthSession()

    throw Object.assign(new Error('Session refresh failed'), { status: response.status })
  }

  async ensure(failedToken?: string): Promise<void> {
    if (!this.pending) {
      this.pending = serialized(`insight-auth:${this.baseUrl}`, () => this.renew(failedToken)).finally(() => {
        this.pending = null
      })
    }

    await this.pending

    // A proactive request may have completed without rotating the token.
    if (failedToken && stored()?.accessToken === failedToken)
      await serialized(`insight-auth:${this.baseUrl}`, () => this.renew(failedToken))
  }

  private isOwnApi(url: URL): boolean {
    const base = new URL(this.baseUrl)

    return url.origin === base.origin && url.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/api/`)
  }

  private isCredentialRoute(url: URL): boolean {
    const path = url.pathname.slice(new URL(this.baseUrl).pathname.replace(/\/$/, '').length)

    return /^\/api\/auth\/(?:session\/|login|register|send-code|status|yandex)/.test(path)
  }

  private async authenticatedRequest(input: RequestInfo | URL, init: RequestInit | undefined, getToken: () => string | null): Promise<Response> {
    const identity = authSessionIdentity()

    if (identity)
      await this.ensure()

    init?.signal?.throwIfAborted()
    assertSession(identity)
    const token = getToken()
    const headers = requestHeaders(input, init, token)
    const retryInput = input instanceof Request ? input.clone() : input
    const response = await this.transport(input, { ...init, headers })
    assertSession(identity)

    if (!shouldRetry(response, token))
      return response

    await this.ensure(token!)
    init?.signal?.throwIfAborted()
    assertSession(identity)
    headers.set('Authorization', `Bearer ${getToken()}`)
    // Only an unauthenticated response is retried; network failures never replay writes.
    const retry = await this.transport(retryInput, { ...init, headers })
    assertSession(identity)

    return retry
  }

  wrap(getToken: () => string | null): Transport {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), this.baseUrl)

      if (!this.isOwnApi(url))
        return this.transport(input, { ...init, headers: requestHeaders(input, init) })

      if (this.isCredentialRoute(url))
        return this.transport(input, init)

      return this.authenticatedRequest(input, init, getToken)
    }
  }
}
