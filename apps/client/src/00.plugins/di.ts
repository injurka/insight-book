import type { InjectionKey } from 'vue'
import { hasInjectionContext, inject } from 'vue'
import { activityRepository } from '~/01.shared/repositories/activity.repository'
import { analysisRepository } from '~/01.shared/repositories/analysis.repository'
import { authRepository } from '~/01.shared/repositories/auth.repository'
import { bookRepository } from '~/01.shared/repositories/book.repository'
import { catalogPluginRepository } from '~/01.shared/repositories/catalog-plugin.repository'
import { dictionaryRepository } from '~/01.shared/repositories/dictionary.repository'
import { highlightsRepository } from '~/01.shared/repositories/highlights.repository'
import { pluginRepository } from '~/01.shared/repositories/plugin.repository'
import { pushRepository } from '~/01.shared/repositories/push.repository'
import { quizRepository } from '~/01.shared/repositories/quiz.repository'
import { storageRepository } from '~/01.shared/repositories/storage.repository'

export interface Repositories {
  activity: typeof activityRepository
  analysis: typeof analysisRepository
  auth: typeof authRepository
  book: typeof bookRepository
  catalogPlugin: typeof catalogPluginRepository
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
  catalogPlugin: catalogPluginRepository,
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
