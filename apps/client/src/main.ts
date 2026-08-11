import { addCollection } from '@iconify/vue'
import { PiniaColada } from '@pinia/colada'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defaultRepositories, REPOS_INJECTION_KEY } from '~/00.plugins/di'
import { i18n, localePromise } from '~/00.plugins/i18n.ts'
import { vLongPress } from '~/01.shared/directives/long-press'
import { vRipple } from '~/01.shared/directives/ripple'
import { isMobileApp } from '~/01.shared/lib/env'
import router from '~/01.shared/lib/router'
import { initMonitoring, setupVueMonitoring } from '~/01.shared/services/monitoring.service.ts'
import App from './app.vue'

import '~/assets/scss/global.scss'
import '~/assets/scss/normalize.scss'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  const head = createHead()

  app.directive('ripple', vRipple)
  app.directive('longPress', vLongPress)

  app.use(pinia)
  app.use(PiniaColada)
  app.use(i18n)
  app.use(head)
  app.provide(REPOS_INJECTION_KEY, defaultRepositories)

  // ── Critical path: load stores & API synchronously, init from cache ──
  const [
    { configureApi },
    { useGlobalSettingsStore },
    { useAuthStore },
    { useToastStore },
  ] = await Promise.all([
    import('~/01.shared/services/api.service'),
    import('~/01.shared/store/settings.store'),
    import('~/01.shared/store/auth.store'),
    import('~/01.shared/store/toast.store'),
  ])

  const settingsStore = useGlobalSettingsStore()
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  // Init auth from cached session (sync, no API call — isAuthReady = true immediately)
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

  if (isMobileApp) {
    const [{ setErudaEnabled }] = await Promise.all([
      import('~/01.shared/services/eruda.service'),
    ])
    import('vue').then(({ watch }) => {
      watch(() => settingsStore.enableEruda, (enabled) => {
        void setErudaEnabled(enabled)
      }, { immediate: true })
    })
  }

  // ── Router & mount: DON'T wait for initial navigation ──
  // Mount immediately — router guards use cached auth (isAuthReady already true).
  // The initial navigation + redirects (onboarding, auth) resolve from cache
  // without hitting the API.
  app.use(router)
  setupVueMonitoring(app, router)
  app.mount('#app')

  // Remove preloader now that Vue has mounted
  document.getElementById('app-preloader')?.remove()

  // ── Post-mount: everything below is non-blocking ──
  // Refresh auth in background (API call, updates reactively)
  authStore.checkAuth().catch((err: unknown) => console.warn('[bootstrap] Background auth check failed:', err))

  // Locale is already loaded from cache by i18n plugin; await the promise
  // for hydration but it doesn't block render
  localePromise.catch((err: unknown) => console.warn('[bootstrap] Locale load failed:', err))

  // Plugins & event wiring — fire-and-forget, don't block render
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
  }).catch(err => console.error('Failed to setup plugins:', err))

  // Monitoring — init after mount, non-blocking
  initMonitoring()
  // Re-register Vue monitoring now that Faro API is available.
  // The pre-mount call at line 79 set up the error handler structure;
  // this call registers router.afterEach page_view tracking with a live Faro instance.
  setupVueMonitoring(app, router)

  // Platform-specific initializers (Tauri updater / PWA) — non-blocking
  const platformStrategies = [
    {
      shouldRun: isTauri,
      run: async () => {
        const { initializeTauriUpdater } = await import('~/01.shared/services/tauri-update.service')
        initializeTauriUpdater(pinia)
      },
      name: 'Tauri updater',
    },
    {
      shouldRun: !isTauri && 'serviceWorker' in navigator,
      run: async () => {
        const { initializePwaUpdater } = await import('~/01.shared/services/pwa.service')
        initializePwaUpdater(pinia)
      },
      name: 'PWA plugin',
    },
  ]

  const activeStrategy = platformStrategies.find(s => s.shouldRun)
  if (activeStrategy) {
    activeStrategy.run().catch((err: unknown) => {
      console.warn(`Failed to initialize ${activeStrategy.name}:`, err)
    })
  }

  if (import.meta.env.DEV)
    app.config.performance = true
}

import('~/assets/icons-bundle.json').then((module) => {
  addCollection(module.default)
})

bootstrap()
