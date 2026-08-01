import { PluginSandbox } from '@injurka/insight-book-plugin-api'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import plugin from './index'

const app = createApp(PluginSandbox, { plugin })
app.use(createPinia())
app.mount('#app')
