import { addCollection } from '@iconify/vue'
import { PiniaColada } from '@pinia/colada'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defaultRepositories, REPOS_INJECTION_KEY } from '~/00.plugins/di'
import { i18n, localePromise } from '~/00.plugins/i18n.ts'
import { vLongPress } from '~/01.shared/directives/long-press'
import { vRipple } from '~/01.shared/directives/ripple'
import { isTauri } from '~/01.shared/lib/env'
import router from '~/01.shared/lib/router'
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

  const { configureApi } = await import('~/01.shared/services/api.service')
  const { useGlobalSettingsStore } = await import('~/01.shared/store/settings.store')
  const { useAuthStore } = await import('~/01.shared/store/auth.store')
  const { useToastStore } = await import('~/01.shared/store/toast.store')

  const settingsStore = useGlobalSettingsStore()
  const authStore = useAuthStore()
  const toastStore = useToastStore()

  configureApi({
    getToken: () => localStorage.getItem('insight_token'),
    getAppLanguage: () => settingsStore.appLanguage || null,
    getCustomLlm: () => settingsStore.useCustomLlm && settingsStore.customLlmUrl && settingsStore.customLlmModel
      ? { url: settingsStore.customLlmUrl, key: settingsStore.customLlmKey || '', model: settingsStore.customLlmModel }
      : null,
    onUnauthorized: () => authStore.logout(),
    onError: message => toastStore.error(message),
  })

  try {
    const { setupPlugins } = await import('~/00.plugins/index')
    const { setupDictionaryEvents } = await import('~/01.shared/events/dictionary-events')
    const { setupReaderEvents } = await import('~/01.shared/events/reader-events')

    await setupPlugins(app, router)
    void setupDictionaryEvents()
    void setupReaderEvents()
  }
  catch (err) {
    console.error('Failed to setup plugins:', err)
  }

  app.use(router)

  await localePromise
  await router.isReady()
  app.mount('#app')

  document.getElementById('app-preloader')?.remove()

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

  if (import.meta.env.DEV) {
    app.config.performance = true
  }
}

import('~/assets/icons-bundle.json').then((module) => {
  addCollection(module.default)
})

bootstrap()
