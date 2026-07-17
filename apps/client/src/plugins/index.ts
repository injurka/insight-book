import type { App } from 'vue'
import type { Router } from 'vue-router'
import { pluginManager } from './plugin-manager'

export async function setupPlugins(app: App, router: Router) {
  const [{ default: grammarRulesPlugin }] = await Promise.all([
    import('@injurka/insight-book-plugin-grammar-rules'),
  ])

  await pluginManager.install(app, router, [
    grammarRulesPlugin,
  ])
}
