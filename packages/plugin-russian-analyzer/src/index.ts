import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { setPluginApi, setPluginContext } from '@injurka/insight-book-plugin-api'
import { registerRussianAnalyzerIcons } from './shared/icons'
import { setLocalPluginApi } from './shared/lib/api'
import en from './shared/locales/en'
import ru from './shared/locales/ru'
import zh from './shared/locales/zh'

const plugin: InsightBookPlugin = {
  id: 'russian-analyzer',
  name: 'Russian Sentence Analyzer',
  version: '1.0.0',
  description: 'Comprehensive AI Russian sentence breakdown on an interactive canvas: cases, verb aspect, morphemes, stress rhythm, intonation (IK), and pragmatics.',
  icon: 'mdi:alphabet-cyrillic',

  pages: {
    index: () => import('./pages/analyzer-page.vue'),
  },

  activate(ctx: InsightBookPluginContext) {
    setPluginContext(ctx)

    if (ctx.api) {
      setPluginApi(ctx.api)
      setLocalPluginApi(ctx.api)
    }

    registerRussianAnalyzerIcons()
    ctx.registerTranslations({ ru, en, zh })

    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en

    ctx.addNavigationItem({
      title: 'Russian Analyzer',
      titleKey: 'plugins.russian-analyzer.navItemTitle',
      icon: 'mdi:alphabet-cyrillic',
      routeName: 'plugin-russian-analyzer-index',
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
