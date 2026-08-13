/* eslint-disable perfectionist/sort-imports */
import 'zone.js' // MUST быть первым импортом: патчит глобальный API до загрузки остальных модулей (OTel ZoneContextManager)
import type { Pinia } from 'pinia'
import type { App as VueApp } from 'vue'
import type { Router } from 'vue-router'
import { addCollection } from '@iconify/vue'
import { PiniaColada } from '@pinia/colada'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp, watch } from 'vue'
import { defaultRepositories, REPOS_INJECTION_KEY } from '~/00.plugins/di'
import { i18n, localePromise } from '~/00.plugins/i18n'
import { vLongPress } from '~/01.shared/directives/long-press'
import { vRipple } from '~/01.shared/directives/ripple'
import { isMobileApp, isTauri } from '~/01.shared/lib/env'
import router from '~/01.shared/lib/router'
import { configureApi } from '~/01.shared/services/api.service'
import { initMonitoring, setupVueMonitoring } from '~/01.shared/services/monitoring.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useToastStore } from '~/01.shared/store/toast.store'
import App from './app.vue'

import '~/assets/scss/global.scss'
import '~/assets/scss/normalize.scss'
/* eslint-enable perfectionist/sort-imports */

async function bootstrap() {
  initMonitoring()

  const app = createApp(App)
  const pinia = createPinia()
  const head = createHead()

  // 1. Directives & Core Plugins
  app.directive('ripple', vRipple)
  app.directive('longPress', vLongPress)

  app.use(pinia)
  app.use(PiniaColada)
  app.use(i18n)
  app.use(head)
  app.provide(REPOS_INJECTION_KEY, defaultRepositories)

  // 2. Critical path: init auth from cache & configure API
  const settingsStore = useGlobalSettingsStore()
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  authStore.init()

  configureApi({
    getToken: () => localStorage.getItem('insight_token'),
    getAppLanguage: () => settingsStore.appLanguage || null,
    getCustomLlm: () => settingsStore.useCustomLlm && settingsStore.customLlmUrl && settingsStore.customLlmModel
      ? { url: settingsStore.customLlmUrl, key: settingsStore.customLlmKey || '', model: settingsStore.customLlmModel }
      : null,
    onUnauthorized: async () => authStore.logout(),
    onError: message => toastStore.error(message),
  })

  setupMobileDevtools(settingsStore)

  // 3. Critical path: sync auth session from backend before mount
  await authStore.checkAuth().catch((err: unknown) => console.warn('[bootstrap] Background auth check failed:', err))

  // 4. Router & Mount
  app.use(router)
  app.mount('#app')
  document.getElementById('app-preloader')?.remove()

  // 5. Non-blocking Post-mount tasks
  initDeferredTasks(app, router, pinia)

  if (import.meta.env.DEV) {
    app.config.performance = true
  }
}

/** Настройка Eruda (девтулы для мобильного приложения) */
function setupMobileDevtools(settingsStore: ReturnType<typeof useGlobalSettingsStore>) {
  if (!isMobileApp)
    return

  void import('~/01.shared/services/eruda.service').then(({ setErudaEnabled }) => {
    watch(() => settingsStore.enableEruda, (enabled) => {
      void setErudaEnabled(enabled)
    }, { immediate: true })
  })
}

/** Фоновые неблокирующие задачи после монтирования */
function initDeferredTasks(app: VueApp, router: Router, pinia: Pinia) {
  // Гидратация локали
  localePromise.catch((err: unknown) => console.warn('[bootstrap] Locale load failed:', err))

  // Регистрируем Vue error handler и router hooks (OTel SDK уже запущен в bootstrap())
  setupVueMonitoring(app, router)

  // Обновления платформы (Tauri / PWA)
  setupPlatformUpdaters(pinia).catch((err: unknown) => console.warn('[bootstrap] Platform updater setup failed:', err))

  // Плагины и слушатели событий
  Promise.all([
    import('~/00.plugins/index'),
    import('~/01.shared/events/dictionary-events'),
    import('~/01.shared/events/reader-events'),
  ]).then(async ([
    { setupPlugins },
    { setupDictionaryEvents },
    { setupReaderEvents },
  ]) => {
    await setupPlugins(app, router)
    void setupDictionaryEvents()
    void setupReaderEvents()
  }).catch(err => console.error('[bootstrap] Failed to setup plugins/events:', err))
}

/** Инициализаторы обновлений в зависимости от окружения */
async function setupPlatformUpdaters(pinia: Pinia) {
  if (isTauri) {
    const { initializeTauriUpdater } = await import('~/01.shared/services/tauri-update.service')
    initializeTauriUpdater(pinia)
  }
  else if ('serviceWorker' in navigator) {
    const { initializePwaUpdater } = await import('~/01.shared/services/pwa.service')
    initializePwaUpdater(pinia)
  }
}

bootstrap()

// Предзагрузка иконочного бандла Iconify
import('~/assets/icons-bundle.json').then((module) => {
  addCollection(module.default)
})
