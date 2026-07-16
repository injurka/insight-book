import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import RulesPage from './pages/rules-page.vue'

const plugin: InsightBookPlugin = {
  id: 'grammar-rules',
  name: 'Grammar Rules',
  version: '1.0.0',
  description: 'A plugin to learn and test language grammar rules.',
  icon: 'mdi:school-outline',

  pages: {
    index: RulesPage
  },

  activate(ctx: InsightBookPluginContext) {
    ctx.addNavigationItem({
      title: 'Grammar Rules',
      icon: 'mdi:school-outline',
      routeName: 'plugin-grammar-rules-index'
    })
    ctx.notify('Grammar Rules plugin activated!', 'success')
  },

  deactivate(ctx: InsightBookPluginContext) {
    ctx.notify('Grammar Rules plugin deactivated.', 'info')
  }
}

export default plugin
