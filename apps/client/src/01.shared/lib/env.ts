/** Рантайм-конфиг, генерируется entrypoint'ом контейнера при запуске (/configs/app-config.js) */
interface AppRuntimeConfig {
  API_URL?: string
  OTEL_EXPORTER_OTLP_ENDPOINT?: string
  CDN_URL?: string
}

const runtimeConfig = (window as { __APP_CONFIG__?: AppRuntimeConfig }).__APP_CONFIG__

/** Приложение запущено внутри Tauri (десктоп или мобильное приложение) */
export const isTauri = typeof window !== 'undefined' && Boolean((window as { isTauri?: boolean }).isTauri
  || '__TAURI_INTERNALS__' in window
  || '__TAURI__' in window
  || '__TAURI_IPC__' in window
  || window.location.hostname === 'tauri.localhost'
  || window.location.protocol === 'tauri:'
  || (typeof __TAURI_BUILD__ !== 'undefined' && __TAURI_BUILD__))

/** Мобильное устройство по User-Agent */
export const isMobile = typeof navigator !== 'undefined'
  && /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|windows phone|windows mobile|kindle|silk|fennec|mobile|tablet/i.test(navigator.userAgent)

/** Мобильная сборка приложения (APK/iOS через Tauri) */
export const isMobileApp = isTauri && isMobile

export const DEFAULT_API_URL = 'https://insight-book-api.limited-dissolve.ru'

function isLocalhost(url?: string | null): boolean {
  if (!url)
    return false

  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('tauri.localhost')
}

function resolveApiUrl(): string {
  // 1. Рантайм-конфиг контейнера (__APP_CONFIG__)
  if (runtimeConfig?.API_URL)
    return runtimeConfig.API_URL

  const envApiUrl = import.meta.env.VITE_API_URL

  // 2. Внутри Tauri (десктоп или мобильное приложение):
  // Запросы к localhost недопустимы (на мобайле localhost - сам девайс, на tauri.localhost перехватывается WebView).
  // Поэтому при пустом значении или localhost всегда используем продакшн API.
  if (isTauri) {
    if (envApiUrl && !isLocalhost(envApiUrl))
      return envApiUrl

    return DEFAULT_API_URL
  }

  // 3. Веб-окружение: VITE_API_URL (если задан) или пустая строка для относительных запросов (через proxy / Nginx)
  return envApiUrl || ''
}

/** Базовый URL API: рантайм-конфиг контейнера → env при сборке → прод для Tauri → пусто для веба */
export const API_URL = resolveApiUrl()

/** OTLP-эндпоинт (SigNoz ingester через traefik): рантайм-конфиг → env при сборке → прод */
export const OTEL_EXPORTER_OTLP_ENDPOINT = runtimeConfig?.OTEL_EXPORTER_OTLP_ENDPOINT || import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || ''

/** Базовый URL CDN (Pull Zone) для раздачи загруженных файлов (манга, обложки, аватарки) */
export const CDN_URL = runtimeConfig?.CDN_URL || import.meta.env.VITE_CDN_URL || (isTauri ? 'https://cdn.insight-book.ru' : '')
