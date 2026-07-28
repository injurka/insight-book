import type { InjectionKey } from 'vue'
import { hasInjectionContext, inject } from 'vue'
import { activityRepository } from '~/shared/repositories/activity.repository'
import { analysisRepository } from '~/shared/repositories/analysis.repository'
import { authRepository } from '~/shared/repositories/auth.repository'
import { bookRepository } from '~/shared/repositories/book.repository'
import { dictionaryRepository } from '~/shared/repositories/dictionary.repository'
import { highlightsRepository } from '~/shared/repositories/highlights.repository'
import { pluginRepository } from '~/shared/repositories/plugin.repository'
import { pushRepository } from '~/shared/repositories/push.repository'
import { quizRepository } from '~/shared/repositories/quiz.repository'
import { storageRepository } from '~/shared/repositories/storage.repository'

export interface Repositories {
  activity: typeof activityRepository
  analysis: typeof analysisRepository
  auth: typeof authRepository
  book: typeof bookRepository
  dictionary: typeof dictionaryRepository
  highlights: typeof highlightsRepository
  plugin: typeof pluginRepository
  push: typeof pushRepository
  quiz: typeof quizRepository
  storage: typeof storageRepository
}

export const defaultRepositories: Repositories = {
  activity: activityRepository,
  analysis: analysisRepository,
  auth: authRepository,
  book: bookRepository,
  dictionary: dictionaryRepository,
  highlights: highlightsRepository,
  plugin: pluginRepository,
  push: pushRepository,
  quiz: quizRepository,
  storage: storageRepository,
}

export const REPOS_INJECTION_KEY = Symbol('Repositories') as InjectionKey<Repositories>

// A helper that uses inject if in Vue setup context, otherwise falls back to defaults.
export function useRepos(): Repositories {
  if (hasInjectionContext()) {
    return inject(REPOS_INJECTION_KEY, defaultRepositories)
  }

  return defaultRepositories
}
