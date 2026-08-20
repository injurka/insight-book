import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { setPluginApi, setPluginContext } from '@injurka/insight-book-plugin-api'

import en from './shared/locales/en'
import ru from './shared/locales/ru'
import zh from './shared/locales/zh'

const plugin: InsightBookPlugin = {
  id: 'grammar-rules',
  name: 'Grammar Rules',
  version: '1.0.0',
  description: 'A plugin to learn and test language grammar rules.',
  icon: 'mdi:school-outline',

  pages: {
    index: () => import('./pages/rules-page.vue'),
  },

  activate(ctx: InsightBookPluginContext) {
    setPluginContext(ctx)
    if (ctx.api) {
      setPluginApi(ctx.api)
    }

    ctx.registerTranslations({ ru, en, zh })

    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en

    ctx.addNavigationItem({
      title: 'Grammar Rules',
      titleKey: 'plugins.grammar-rules.navItemTitle',
      icon: 'mdi:school-outline',
      routeName: 'plugin-grammar-rules-index',
    })
    ctx.notify(t.notifyActivated, 'success')
  },

  deactivate(ctx: InsightBookPluginContext) {
    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en
    ctx.notify(t.notifyDeactivated, 'info')
  },
}

export default plugin
