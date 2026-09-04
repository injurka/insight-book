/** Рантайм-конфиг, генерируется entrypoint'ом контейнера при запуске (/configs/app-config.js) */
interface AppRuntimeConfig {
  API_URL?: string
  OTEL_EXPORTER_OTLP_ENDPOINT?: string
  CDN_URL?: string
}

const runtimeConfig = (window as { __APP_CONFIG__?: AppRuntimeConfig }).__APP_CONFIG__

/** Приложение запущено внутри Tauri (десктоп или мобильное приложение) */
export const isTauri = '__TAURI_INTERNALS__' in window

/** Мобильное устройство по User-Agent */
export const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|windows phone|windows mobile|kindle|silk|fennec|mobile|tablet/i.test(navigator.userAgent)

/** Мобильная сборка приложения (APK/iOS через Tauri) */
export const isMobileApp = isTauri && isMobile

/** Базовый URL API: рантайм-конфиг контейнера → env при сборке → прод для Tauri → пусто для веба */
export const API_URL = runtimeConfig?.API_URL || import.meta.env.VITE_API_URL || (isTauri ? 'https://api.insight-book.ru' : '')

/** OTLP-эндпоинт (SigNoz ingester через traefik): рантайм-конфиг → env при сборке → прод */
export const OTEL_EXPORTER_OTLP_ENDPOINT = runtimeConfig?.OTEL_EXPORTER_OTLP_ENDPOINT || import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || ''

/** Базовый URL CDN (Pull Zone) для раздачи загруженных файлов (манга, обложки, аватарки) */
export const CDN_URL = runtimeConfig?.CDN_URL || import.meta.env.VITE_CDN_URL || ''
