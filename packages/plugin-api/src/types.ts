import type { Component } from 'vue'

export type UIPosition
  = | 'dictionary:training-modes'
    | 'reader:header-actions'
    | 'settings:custom-tab'
    | (string & {})

export interface PluginUIWidget {
  id: string
  position: UIPosition
  component: any
  props?: Record<string, unknown>
}

export interface InsightBookPluginEventBus {
  on: (event: string, callback: (data: unknown) => void) => void
  off: (event: string, callback: (data: unknown) => void) => void
  emit: (event: string, data?: unknown) => void
}

export interface InsightBookPluginApiFacade {
  dictionary: {
    getWords: () => Promise<unknown[]>
    updateWordStats: (id: number, score: number) => Promise<void>
    submitGrade: (wordId: number, grade: number) => Promise<void>
  }
  reader: {
    getCurrentBook: () => Promise<unknown | null> | (unknown | null)
  }
  user: {
    getProfile: () => Promise<unknown | null> | (unknown | null)
  }
}

export interface InsightBookPluginContext {
  /** Показать уведомление пользователю */
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  /** Добавляет элемент в главное навигационное меню приложения */
  addNavigationItem: (item: { title: string, titleKey?: string, icon?: string, routeName: string }) => void
  /** Регистрация UI виджета в точке расширения */
  registerUIWidget: (position: UIPosition, id: string, component: any, props?: Record<string, unknown>) => void
  /** Отмена регистрации UI виджета */
  unregisterUIWidget: (id: string) => void
  /** Канал связи между плагинами и основной системой */
  events: InsightBookPluginEventBus
  /** Текущая локаль приложения (например, 'ru', 'en') */
  locale: string
  /** Зарегистрировать локализацию для плагина */
  registerTranslations: (messages: Record<string, unknown>) => void
  /** Стабильный контракт API приложения (Facade) */
  api: InsightBookPluginApiFacade
}

export interface InsightBookPluginManifest {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  entryUrl: string
}

export interface InsightBookPlugin {
  /** Уникальный идентификатор плагина (kebab-case) */
  id: string
  /** Отображаемое название плагина */
  name: string
  /** Версия плагина */
  version: string
  /** Краткое описание плагина */
  description?: string
  /** Иконка плагина (например, mdi:book) */
  icon?: string

  /**
   * Страницы, предоставляемые плагином.
   * Ключ: путь маршрута относительно `/plugin/:pluginId/` (используйте 'index' для корня плагина)
   * Значение: Vue-компонент
   */
  pages?: Record<string, Component>

  /** Хук жизненного цикла: вызывается при активации плагина */
  activate?: (ctx: InsightBookPluginContext) => void | Promise<void>

  /** Хук жизненного цикла: вызывается при деактивации плагина */
  deactivate?: (ctx: InsightBookPluginContext) => void | Promise<void>
}
