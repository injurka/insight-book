import type { Component } from 'vue'

export interface InsightBookPluginEventBus {
  on(event: string, callback: (data: any) => void): void
  off(event: string, callback: (data: any) => void): void
  emit(event: string, data?: any): void
}

export interface InsightBookPluginContext {
  /** Показать уведомление пользователю */
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  /** Добавляет элемент в главное навигационное меню приложения */
  addNavigationItem: (item: { title: string, titleKey?: string, icon?: string, routeName: string }) => void
  /** Канал связи между плагинами и основной системой */
  events: InsightBookPluginEventBus
  /** Текущая локаль приложения (например, 'ru', 'en') */
  locale: string
  /** Зарегистрировать локализацию для плагина */
  registerTranslations: (messages: Record<string, any>) => void
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
