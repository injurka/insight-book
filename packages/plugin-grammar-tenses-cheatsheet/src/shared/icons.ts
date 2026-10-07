import type { IconifyJSON } from '@iconify/vue'
import { addCollection } from '@iconify/vue'

/**
 * Локальный набор MDI-иконок плагина.
 *
 * Данные сняты из официального пакета `@iconify-json/mdi` (icons.json).
 * Хост-бандл `icons-bundle.json` содержит не все имена, поэтому без локальной
 * регистрации `<Icon icon="mdi:...">` уходит в `api.iconify.design` и
 * появляется с задержкой (пустой квадрат в первые кадры). Локальная коллекция
 * отрисовывается мгновенно и работает офлайн.
 */
const tenseCheatsheetIcons: IconifyJSON = {
  prefix: 'mdi',
  width: 24,
  height: 24,
  icons: {
    'clock-check-outline': { body: '<path fill="currentColor" d="m23.5 17l-5 5l-3.5-3.5l1.5-1.5l2 2l3.5-3.5zm-10.4 2.9c-.4.1-.7.1-1.1.1c-4.4 0-8-3.6-8-8s3.6-8 8-8s8 3.6 8 8c0 .4 0 .7-.1 1.1c.7.1 1.3.3 1.9.6c.1-.6.2-1.1.2-1.7c0-5.5-4.5-10-10-10S2 6.5 2 12s4.5 10 10 10c.6 0 1.2-.1 1.7-.2c-.3-.5-.5-1.2-.6-1.9m2.5-5.8l-3.1-1.8V7H11v6l3.5 2.1c.3-.4.7-.7 1.1-1"/>' },
    'close': { body: '<path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>' },
  },
}

/** Регистрирует набор в локальном сторе Iconify (вызывается при активации плагина). */
export function registerTenseCheatsheetIcons(): void {
  addCollection(tenseCheatsheetIcons)
}
