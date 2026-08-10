import type { MeResponse } from '~/01.shared/types/models'
import { api } from '~/01.shared/lib/api'

export interface IAuthRepository {
  login: (login: string, password: string) => Promise<{ token: string, user: { id: number, username: string, role: string } }>
  me: () => Promise<MeResponse>
}

export class DefaultAuthRepository implements IAuthRepository {
  async login(login: string, password: string) {
    return api.auth.login(login, password)
  }

  async me() {
    return api.auth.me()
  }
}

export const authRepository: IAuthRepository = new DefaultAuthRepository()
