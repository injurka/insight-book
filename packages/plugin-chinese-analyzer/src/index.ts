import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { setPluginApi, setPluginContext } from '@injurka/insight-book-plugin-api'
import { registerChineseAnalyzerIcons } from './shared/icons'
import { setLocalPluginApi } from './shared/lib/api'
import en from './shared/locales/en'
import ru from './shared/locales/ru'
import zh from './shared/locales/zh'

const plugin: InsightBookPlugin = {
  id: 'chinese-analyzer',
  name: 'Разбор китайских предложений',
  version: '1.0.0',
  description: 'Комплексный ИИ-разбор китайских предложений на интерактивном полотне: лексемы, иероглифы, ключи, грамматика, тоны и контекст.',
  icon: 'mdi:ideogram-cjk-variant',

  pages: {
    index: () => import('./pages/analyzer-page.vue'),
  },

  activate(ctx: InsightBookPluginContext) {
    setPluginContext(ctx)

    if (ctx.api) {
      setPluginApi(ctx.api)
      setLocalPluginApi(ctx.api)
    }

    registerChineseAnalyzerIcons()
    ctx.registerTranslations({ ru, en, zh })

    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? ru

    ctx.addNavigationItem({
      title: 'Разбор предложений',
      titleKey: 'plugins.chinese-analyzer.navItemTitle',
      icon: 'mdi:ideogram-cjk-variant',
      routeName: 'plugin-chinese-analyzer-index',
    })

    ctx.notify(t.notifyActivated, 'success')
  },

  deactivate(ctx: InsightBookPluginContext) {
    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? ru
    ctx.notify(t.notifyDeactivated, 'info')
  },
}

export default plugin
