import type {
  InsightBookPluginApiFacade,
  InsightBookPluginContext,
  InsightBookPluginEventBus,
  PluginUIWidget,
  UIPosition,
} from '../types'
import { markRaw, reactive, ref } from 'vue'
import { MockEventBus } from './event-bus'

export interface PluginNotification {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
}

export interface ApiLogEntry {
  id: string
  method: string
  args: unknown[]
  timestamp: Date
}

export interface NavigationItem {
  title: string
  titleKey?: string
  icon?: string
  routeName: string
}

export interface MockContextOptions {
  locale?: string
  words?: Array<{ id: number, word: string, score?: number, grade?: number }>
  currentBook?: Record<string, unknown> | null
  userProfile?: Record<string, unknown> | null
}

export interface MockPluginContextResult {
  context: InsightBookPluginContext
  widgets: Record<string, PluginUIWidget>
  navigationItems: NavigationItem[]
  notifications: PluginNotification[]
  apiLogs: ApiLogEntry[]
  translations: Record<string, unknown>
  locale: { value: string }
  events: InsightBookPluginEventBus
  clearLogs: () => void
  clearNotifications: () => void
  setWords: (words: Array<{ id: number, word: string, score?: number, grade?: number }>) => void
}

class MockLogger {
  constructor(private apiLogs: ApiLogEntry[]) { }

  log(method: string, ...args: unknown[]) {
    this.apiLogs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      method,
      args,
      timestamp: new Date(),
    })
  }
}

class MockDictionaryApi {
  private words: Array<{ id: number, word: string, score?: number, grade?: number }>

  constructor(initialWords: Array<{ id: number, word: string, score?: number, grade?: number }>, private logger: MockLogger) {
    this.words = reactive([...initialWords])
  }

  async getWords() {
    this.logger.log('dictionary.getWords')
    return JSON.parse(JSON.stringify(this.words))
  }

  async updateWordStats(id: number, score: number) {
    this.logger.log('dictionary.updateWordStats', id, score)
    const word = this.words.find(w => w.id === id)
    if (word) {
      word.score = (word.score ?? 0) + score
    }
  }

  async submitGrade(wordId: number, grade: number) {
    this.logger.log('dictionary.submitGrade', wordId, grade)
    const word = this.words.find(w => w.id === wordId)
    if (word) {
      word.grade = grade
    }
  }

  setWords(newWords: Array<{ id: number, word: string, score?: number, grade?: number }>) {
    this.words.length = 0
    this.words.push(...newWords)
  }
}

class MockReaderApi {
  constructor(private currentBook: Record<string, unknown> | null, private logger: MockLogger) { }

  getCurrentBook() {
    this.logger.log('reader.getCurrentBook')
    return this.currentBook
  }
}

class MockUserApi {
  constructor(private userProfile: Record<string, unknown> | null, private logger: MockLogger) { }

  getProfile() {
    this.logger.log('user.getProfile')
    return this.userProfile
  }
}

export function createMockPluginContext(options: MockContextOptions = {}): MockPluginContextResult {
  const currentLocale = ref(options.locale ?? 'ru')
  const widgets = reactive<Record<string, PluginUIWidget>>({})
  const navigationItems = reactive<NavigationItem[]>([])
  const notifications = reactive<PluginNotification[]>([])
  const apiLogs = reactive<ApiLogEntry[]>([])
  const translations = reactive<Record<string, unknown>>({})

  const eventBus = new MockEventBus()
  const logger = new MockLogger(apiLogs)

  const defaultWords = options.words ?? [
    { id: 1, word: '火', score: 10 },
    { id: 2, word: '水', score: 15 },
    { id: 3, word: '木', score: 8 },
    { id: 4, word: '日', score: 20 },
    { id: 5, word: '月', score: 12 },
    { id: 6, word: '明', score: 5 },
    { id: 7, word: '林', score: 7 },
  ]

  const dictionaryApi = new MockDictionaryApi(defaultWords, logger)
  const readerApi = new MockReaderApi(options.currentBook !== undefined
    ? options.currentBook
    : {
        id: 'book-1',
        title: 'Тестовая Книга / Sample Book',
        author: 'InsightBook Author',
      }, logger)
  const userApi = new MockUserApi(options.userProfile !== undefined
    ? options.userProfile
    : {
        id: 'user-1',
        username: 'ScholarDev',
        level: 42,
      }, logger)

  const api: InsightBookPluginApiFacade = {
    dictionary: {
      getWords: () => dictionaryApi.getWords(),
      updateWordStats: (id, score) => dictionaryApi.updateWordStats(id, score),
      submitGrade: (wordId, grade) => dictionaryApi.submitGrade(wordId, grade),
    },
    reader: {
      getCurrentBook: () => readerApi.getCurrentBook(),
    },
    user: {
      getProfile: () => userApi.getProfile(),
    },
  }

  const context: InsightBookPluginContext = {
    get locale() {
      return currentLocale.value
    },
    set locale(val: string) {
      currentLocale.value = val
    },
    notify: (message: string, type = 'info') => {
      notifications.unshift({
        id: Math.random().toString(36).substring(2, 9),
        message,
        type,
        timestamp: new Date(),
      })
    },
    addNavigationItem: (item) => {
      const exists = navigationItems.some(n => n.routeName === item.routeName)
      if (!exists) {
        navigationItems.push(item)
      }
    },
    registerUIWidget: (
      position: UIPosition,
      id: string,
      component: any,
      props?: Record<string, unknown>,
    ) => {
      widgets[id] = { id, position, component: markRaw(component), props }
    },
    unregisterUIWidget: (id: string) => {
      delete widgets[id]
    },
    events: eventBus,
    registerTranslations: (msgs: Record<string, unknown>) => {
      Object.assign(translations, msgs)
    },
    api,
  }

  return {
    context,
    widgets,
    navigationItems,
    notifications,
    apiLogs,
    translations,
    locale: currentLocale,
    events: eventBus,
    clearLogs: () => {
      apiLogs.length = 0
    },
    clearNotifications: () => {
      notifications.length = 0
    },
    setWords: (newWords) => {
      dictionaryApi.setWords(newWords)
    },
  }
}
