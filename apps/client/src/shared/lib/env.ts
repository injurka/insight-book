/** Базовый URL API: берётся из env при сборке, иначе прод */
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.insight-book.ru'

/** Приложение запущено внутри Tauri (десктоп или мобильное приложение) */
export const isTauri = '__TAURI_INTERNALS__' in window

/** Мобильное устройство по User-Agent */
export const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|windows phone|windows mobile|kindle|silk|fennec|mobile|tablet/i.test(navigator.userAgent)

/** Мобильная сборка приложения (APK/iOS через Tauri) */
export const isMobileApp = isTauri && isMobile
