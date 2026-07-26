import type { ActivityRepository } from './activity.repository'
import type { BookRepository } from './book.repository'
import type { DictionaryRepository } from './dictionary.repository'
import type { HighlightRepository } from './highlight.repository'
import type { PushRepository } from './push.repository'
import type { QuizRepository } from './quiz.repository'
import type { UserRepository } from './user.repository'

export type IUserRepository = InstanceType<typeof UserRepository>
export type IBookRepository = InstanceType<typeof BookRepository>
export type IDictionaryRepository = InstanceType<typeof DictionaryRepository>
export type IActivityRepository = InstanceType<typeof ActivityRepository>
export type IHighlightRepository = InstanceType<typeof HighlightRepository>
export type IPushRepository = InstanceType<typeof PushRepository>
export type IQuizRepository = InstanceType<typeof QuizRepository>
