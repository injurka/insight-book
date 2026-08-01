import { PluginSandbox } from '@injurka/insight-book-plugin-api'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import plugin from './index'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'plugin-scroll-study-index', component: { template: '<div />' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div />' } },
  ],
})

const app = createApp(PluginSandbox, { plugin })
app.use(createPinia())
app.use(router)
app.mount('#app')
