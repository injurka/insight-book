import type { IconifyJSON } from '@iconify/vue'
import { addCollection } from '@iconify/vue'

/**
 * Локальный набор иконок интерфейса игры.
 *
 * Иконки НЕ тянутся в рантайме с api.iconify.design: хост-бандл
 * `apps/client/src/assets/icons-bundle.json` не содержит часть используемых
 * плагином имён, а сетевой запрос приводил к тому, что кнопки «моргали»
 * пустыми квадратами уже после появления интерфейса. Данные сняты из
 * официального пакета `@iconify-json/mdi` (icons.json), поэтому отрисовка
 * мгновенная и работает офлайн.
 */
const scrollStudyIcons: IconifyJSON = {
  prefix: 'mdi',
  width: 24,
  height: 24,
  icons: {
    'arrow-right': { body: "<path fill=\"currentColor\" d=\"M4 11v2h12l-5.5 5.5l1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5L16 11z\"/>" },
    'check': { body: "<path fill=\"currentColor\" d=\"M21 7L9 19l-5.5-5.5l1.41-1.41L9 16.17L19.59 5.59z\"/>" },
    'close': { body: "<path fill=\"currentColor\" d=\"M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z\"/>" },
    'dice-multiple-outline': { body: "<path fill=\"currentColor\" d=\"M14 8c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1m-2 4v7H5v-7zm.78-2H4.22C3.55 10 3 10.55 3 11.22v8.56c0 .67.55 1.22 1.22 1.22h8.56c.67 0 1.22-.55 1.22-1.22v-8.56c0-.67-.55-1.22-1.22-1.22m7-7h-8.56C10.55 3 10 3.55 10 4.22V8h2V5h7v7h-3v2h3.78c.67 0 1.22-.55 1.22-1.22V4.22C21 3.55 20.45 3 19.78 3M17 8c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1m0 3c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1M7 15c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1m3 3c-.55 0-1-.45-1-1s.45-1 1-1s1 .45 1 1s-.45 1-1 1\"/>" },
    'magnify': { body: "<path fill=\"currentColor\" d=\"M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5l-1.5 1.5l-5-5v-.79l-.27-.27A6.52 6.52 0 0 1 9.5 16A6.5 6.5 0 0 1 3 9.5A6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14S14 12 14 9.5S12 5 9.5 5\"/>" },
    'map-marker-outline': { body: "<path fill=\"currentColor\" d=\"M12 6.5A2.5 2.5 0 0 1 14.5 9a2.5 2.5 0 0 1-2.5 2.5A2.5 2.5 0 0 1 9.5 9A2.5 2.5 0 0 1 12 6.5M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7m0 2a5 5 0 0 0-5 5c0 1 0 3 5 9.71C17 12 17 10 17 9a5 5 0 0 0-5-5\"/>" },
    'play': { body: "<path fill=\"currentColor\" d=\"M8 5.14v14l11-7z\"/>" },
    'script-text-outline': { body: "<path fill=\"currentColor\" d=\"M15 20a1 1 0 0 0 1-1V4H8a1 1 0 0 0-1 1v11H5V5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1h-2V5a1 1 0 0 0-1-1a1 1 0 0 0-1 1v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1h11a2 2 0 0 0 2 2M9 6h5v2H9zm0 4h5v2H9zm0 4h5v2H9z\"/>" },
    'scroll-text-outline': { body: "<path fill=\"currentColor\" d=\"M15 20a1 1 0 0 0 1-1V4H8a1 1 0 0 0-1 1v11H5V5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1h-2V5a1 1 0 0 0-1-1a1 1 0 0 0-1 1v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1h11a2 2 0 0 0 2 2M9 6h5v2H9zm0 4h5v2H9zm0 4h5v2H9z\"/>" },
    'yin-yang': { body: "<path fill=\"currentColor\" d=\"M12 2a10 10 0 0 1 10 10a10 10 0 0 1-10 10A10 10 0 0 1 2 12A10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8a8 8 0 0 0 8 8a4 4 0 0 1-4-4a4 4 0 0 1 4-4a4 4 0 0 0 4-4a4 4 0 0 0-4-4m0 2.5A1.5 1.5 0 0 1 13.5 8A1.5 1.5 0 0 1 12 9.5A1.5 1.5 0 0 1 10.5 8A1.5 1.5 0 0 1 12 6.5m0 8a1.5 1.5 0 0 0-1.5 1.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 1.5-1.5a1.5 1.5 0 0 0-1.5-1.5\"/>" },
  },
}

/** Регистрирует набор в локальном сторе Iconify (вызывается при активации плагина). */
export function registerScrollStudyIcons(): void {
  addCollection(scrollStudyIcons)
}
