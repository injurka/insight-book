import { addCollection } from '@iconify/vue'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import iconsBundle from '~/assets/icons-bundle.json'
import { vLongPress } from '~/shared/directives/long-press'
import { vRipple } from '~/shared/directives/ripple'
import router from '~/shared/lib/router'
import { i18n } from '~/shared/plugins/i18n'
import App from './app.vue'

import '~/assets/scss/global.scss'
import '~/assets/scss/normalize.scss'

const isTauri = '__TAURI_INTERNALS__' in window

async function bootstrap() {
  addCollection(iconsBundle)

  const app = createApp(App)
  const pinia = createPinia()
  const head = createHead()

  app.directive('ripple', vRipple)
  app.directive('longPress', vLongPress)

  app.use(pinia)
  app.use(head)
  app.use(router)
  app.use(i18n)

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

bootstrap()
