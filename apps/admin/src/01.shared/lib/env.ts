/** Рантайм-конфиг, генерируется entrypoint'ом контейнера при запуске (/configs/app-config.js) */
interface AppRuntimeConfig {
  API_URL?: string
}

const runtimeConfig = (window as { __APP_CONFIG__?: AppRuntimeConfig }).__APP_CONFIG__

/** Базовый URL API: рантайм-конфиг контейнера → env при сборке → прод */
export const API_URL = runtimeConfig?.API_URL || import.meta.env.VITE_API_URL || 'https://api.insight-book.ru'
