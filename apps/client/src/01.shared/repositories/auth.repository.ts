import type { ApiRequestOptions } from '~/01.shared/services/api.service'
import type { AuthLoginDto, AuthRegisterDto, AuthSendCodeDto, UserData } from '~/01.shared/types/models'
import type { AuthOAuthStatusDomain } from '~/01.shared/types/schemas/auth.schema'
import { applyAcl } from '~/01.shared/lib/acl'
import { setAuthQueryScope } from '~/01.shared/lib/query-keys'
import { api } from '~/01.shared/services/api.service'
import { acceptAuthSession, authSessionSnapshot } from '~/01.shared/services/auth-session.service'
import { AuthLoginResponseSchema, AuthMeResponseSchema, AuthOAuthStatusSchema } from '~/01.shared/types/schemas/auth.schema'

export interface IAuthRepository {
  logout: () => Promise<void>
  acceptOAuthSession: (result: AuthOAuthStatusDomain, snapshot?: string) => void
  acceptLegacyToken: (token: string) => void
  me: () => Promise<{ user: UserData | null, mode: string }>
  startYandexLink: (data: { sessionId?: string, locale: string }, options?: ApiRequestOptions) => Promise<{ redirectUrl: string }>
  oauthStatus: (sessionId: string, options?: ApiRequestOptions) => Promise<AuthOAuthStatusDomain>
  login: (credentials: AuthLoginDto) => Promise<{ token: string, user: UserData }>
  updateAvatar: (file: File) => Promise<{ avatarUrl: string }>
  updateUsername: (username: string) => Promise<{ username: string }>
  sendCode: (data: AuthSendCodeDto) => Promise<{ success: boolean, message: string }>
  register: (data: AuthRegisterDto) => Promise<{ token: string, user: UserData }>
  unlinkProvider: (provider: string, password?: string) => Promise<{ success: boolean, user: UserData }>
}

function acceptLogin(value: { token?: string, accessToken?: string, refreshToken?: string, expiresIn?: number }) {
  acceptAuthSession(value)

  for (const key of ['insight_uid', 'insight_user_data', 'insight_auth_mode'])
    localStorage.removeItem(key)

  setAuthQueryScope(null)
}

export class DefaultAuthRepository implements IAuthRepository {
  async logout() {
    await api.auth.logout()
  }

  acceptOAuthSession(result: AuthOAuthStatusDomain, snapshot = authSessionSnapshot()) {
    if (authSessionSnapshot() !== snapshot) {
      api.auth.discardSession(result)
      throw new DOMException('Login cancelled', 'AbortError')
    }

    acceptLogin(applyAcl(AuthOAuthStatusSchema, result, 'auth.acceptOAuthSession()'))
  }

  acceptLegacyToken(token: string) {
    acceptLogin({ token })
  }

  async me() {
    const raw = await api.auth.me()

    return applyAcl(AuthMeResponseSchema, raw, 'auth.me()')
  }

  async startYandexLink(data: { sessionId?: string, locale: string }, options?: ApiRequestOptions) {
    return api.auth.startYandexLink(data, options)
  }

  async oauthStatus(sessionId: string, options?: ApiRequestOptions) {
    const raw = await api.auth.oauthStatus(sessionId, options)

    return applyAcl(AuthOAuthStatusSchema, raw, 'auth.oauthStatus()')
  }

  async login(credentials: AuthLoginDto) {
    const snapshot = authSessionSnapshot()
    const result = applyAcl(AuthLoginResponseSchema, await api.auth.login(credentials), 'auth.login()')

    if (authSessionSnapshot() !== snapshot) {
      api.auth.discardSession(result)
      throw new DOMException('Login cancelled', 'AbortError')
    }

    acceptLogin(result)

    return { ...result, token: result.accessToken || result.token! }
  }

  async sendCode(data: AuthSendCodeDto) {
    return api.auth.sendCode(data)
  }

  async register(data: AuthRegisterDto) {
    const snapshot = authSessionSnapshot()
    const result = applyAcl(AuthLoginResponseSchema, await api.auth.register(data), 'auth.register()')

    if (authSessionSnapshot() !== snapshot) {
      api.auth.discardSession(result)
      throw new DOMException('Registration cancelled', 'AbortError')
    }

    acceptLogin(result)

    return { ...result, token: result.accessToken || result.token! }
  }

  async updateAvatar(file: File) {
    return api.auth.updateAvatar(file)
  }

  async updateUsername(username: string) {
    return api.auth.updateUsername(username)
  }

  async unlinkProvider(provider: string, password?: string) {
    return api.auth.unlinkProvider(provider, password)
  }
}

export const authRepository: IAuthRepository = new DefaultAuthRepository()
