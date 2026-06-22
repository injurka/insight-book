import { addCollection } from '@iconify/vue'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { vLongPress } from '~/shared/directives/long-press'
import { vRipple } from '~/shared/directives/ripple'
import router from '~/shared/lib/router'
import App from './app.vue'
import { i18n } from './shared/plugins/i18n.ts'

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
  app.use(i18n)
  app.use(head)
  app.use(router)

  app.mount('#app')

  document.getElementById('app-preloader')?.remove()

  if (!isTauri && 'serviceWorker' in navigator) {
    import('~/shared/services/pwa.service')
      .then(({ initializePwaUpdater }) => {
        initializePwaUpdater(pinia)
      })
      .catch((err) => {
        console.warn('PWA plugin not found or failed to register:', err)
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
