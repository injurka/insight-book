import { createSandboxApp } from '@injurka/insight-book-plugin-api/testing'
import plugin from './index'

const app = createSandboxApp({ plugin })
app.mount('#app')
