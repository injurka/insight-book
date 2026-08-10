import { addCollection } from '@iconify/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { defaultRepositories, REPOS_INJECTION_KEY } from '~/00.plugins/di'
import { vuetify } from '~/00.plugins/vuetify'
import { configureApi } from '~/01.shared/lib/api'
import router from '~/01.shared/lib/router'
import App from './app.vue'
import './assets/global.css'

function createAuthProviders() {
  return {
    getToken: () => localStorage.getItem('admin_token'),
    onUnauthorized: () => {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      router.push({ name: 'login' })
    },
  }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)
app.provide(REPOS_INJECTION_KEY, defaultRepositories)

configureApi(createAuthProviders())

import('~/assets/icons-bundle.json').then((module) => {
  addCollection(module.default)
})

app.mount('#app')
