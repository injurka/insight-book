import { addCollection } from '@iconify/vue'
import { PiniaColada } from '@pinia/colada'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp, vaporInteropPlugin } from 'vue'
import { vLongPress } from '~/shared/directives/long-press'
import { vRipple } from '~/shared/directives/ripple'
import router from '~/shared/lib/router'
import { defaultRepositories, REPOS_INJECTION_KEY } from '~/shared/plugins/di'
import App from './app.vue'
import { i18n, localePromise } from './shared/plugins/i18n.ts'

import '~/assets/scss/global.scss'
import '~/assets/scss/normalize.scss'

const isTauri = '__TAURI_INTERNALS__' in window

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
  app.use(vaporInteropPlugin)
  app.provide(REPOS_INJECTION_KEY, defaultRepositories)

  try {
    const { setupPlugins } = await import('~/shared/plugins/index')
    await setupPlugins(app, router)

    const { setupDictionaryEvents } = await import('~/shared/events/dictionary-events')
    const { setupReaderEvents } = await import('~/shared/events/reader-events')
    setupDictionaryEvents()
    setupReaderEvents()
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
        const { initializeTauriUpdater } = await import('~/shared/services/tauri-update.service')
        initializeTauriUpdater(pinia)
      },
      name: 'Tauri updater',
    },
    {
      shouldRun: !isTauri && 'serviceWorker' in navigator,
      run: async () => {
        const { initializePwaUpdater } = await import('~/shared/services/pwa.service')
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
