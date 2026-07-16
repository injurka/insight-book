import type { App } from 'vue'
import type { Router } from 'vue-router'
import grammarRulesPlugin from '@injurka/insight-book-plugin-grammar-rules'
import { pluginManager } from './plugin-manager'

export async function setupPlugins(app: App, router: Router) {
  await pluginManager.install(app, router, [
    grammarRulesPlugin,
  ])
}
