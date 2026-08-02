import type { AuthLoginDto, AuthRegisterDto, AuthSendCodeDto, UserData } from '~/01.shared/types/models'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { AuthMeResponseSchema } from '~/01.shared/types/schemas/auth.schema'

export interface IAuthRepository {
  me: () => Promise<{ user: UserData | null, mode: string }>
  login: (credentials: AuthLoginDto) => Promise<{ token: string, user: UserData }>
  updateAvatar: (file: File) => Promise<{ avatarUrl: string }>
  updateUsername: (username: string) => Promise<{ username: string }>
  sendCode: (data: AuthSendCodeDto) => Promise<{ success: boolean, message: string }>
  register: (data: AuthRegisterDto) => Promise<{ token: string, user: UserData }>
}

export class DefaultAuthRepository implements IAuthRepository {
  async me() {
    const raw = await api.auth.me()

    return applyAcl(AuthMeResponseSchema, raw, 'auth.me()')
  }

  async login(credentials: AuthLoginDto) {
    return api.auth.login(credentials)
  }

  async sendCode(data: AuthSendCodeDto) {
    return api.auth.sendCode(data)
  }

  async register(data: AuthRegisterDto) {
    return api.auth.register(data)
  }

  async updateAvatar(file: File) {
    return api.auth.updateAvatar(file)
  }

  async updateUsername(username: string) {
    return api.auth.updateUsername(username)
  }
}

export const authRepository: IAuthRepository = new DefaultAuthRepository()
