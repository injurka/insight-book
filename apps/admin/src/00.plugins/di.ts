import type { InjectionKey } from 'vue'
import type { IAdminRepository } from '~/01.shared/repositories/admin.repository'
import type { IAuthRepository } from '~/01.shared/repositories/auth.repository'
import { hasInjectionContext, inject } from 'vue'
import { adminRepository } from '~/01.shared/repositories/admin.repository'
import { authRepository } from '~/01.shared/repositories/auth.repository'

export interface Repositories {
  auth: IAuthRepository
  admin: IAdminRepository
}

export const defaultRepositories: Repositories = {
  auth: authRepository,
  admin: adminRepository,
}

export const REPOS_INJECTION_KEY = Symbol('Repositories') as InjectionKey<Repositories>

export function useRepos(): Repositories {
  if (hasInjectionContext())
    return inject(REPOS_INJECTION_KEY, defaultRepositories)

  return defaultRepositories
}
