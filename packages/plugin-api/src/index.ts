import type { InsightBookPluginApiFacade, InsightBookPluginContext } from './types'

export * from './types'

let currentPluginContext: InsightBookPluginContext | null = null
let currentPluginApi: InsightBookPluginApiFacade | null = null

/**
 * Устанавливает активный контекст плагина.
 * Обычно вызывается внутри метода activate(ctx) плагина.
 */
export function setPluginContext(ctx: InsightBookPluginContext): void {
  currentPluginContext = ctx
  if (ctx.api) {
    currentPluginApi = ctx.api
  }
}

/**
 * Возвращает текущий активный контекст плагина (если установлен).
 */
export function getPluginContext(): InsightBookPluginContext | null {
  return currentPluginContext
}

/**
 * Устанавливает активный API фасад плагина.
 */
export function setPluginApi(api: InsightBookPluginApiFacade): void {
  currentPluginApi = api
}

/**
 * Возвращает текущий активный API фасад плагина (если установлен).
 */
export function getPluginApi(): InsightBookPluginApiFacade | null {
  return currentPluginApi ?? currentPluginContext?.api ?? null
}

/**
 * Хук / геттер для получения API фасада в компонентах или логике плагина.
 * Выбрасывает ошибку, если API плагина ещё не был установлен.
 */
export function usePluginApi(): InsightBookPluginApiFacade {
  const api = getPluginApi()
  if (!api) {
    throw new Error('[insight-book-plugin] Plugin API is not initialized. Ensure setPluginContext(ctx) or setPluginApi(ctx.api) was called in activate(ctx).')
  }
  return api
}

/**
 * Хук / геттер для получения контекста плагина.
 */
export function usePluginContext(): InsightBookPluginContext {
  const ctx = getPluginContext()
  if (!ctx) {
    throw new Error('[insight-book-plugin] Plugin Context is not initialized. Ensure setPluginContext(ctx) was called in activate(ctx).')
  }
  return ctx
}
