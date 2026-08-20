import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { defineAsyncComponent } from 'vue'
import { useScrollStudyStore } from './modules/scroll-study/model/scroll-study.store'
import en from './shared/locales/en'
import ru from './shared/locales/ru'
import zh from './shared/locales/zh'

const TrainingModeWidget = defineAsyncComponent(() => import('./modules/scroll-study/ui/partials/training-mode-widget.vue'))

const plugin: InsightBookPlugin = {
  id: 'scroll-study',
  name: 'Изучение свитков',
  version: '1.0.0',
  description: 'Магическое исследование свитков и иероглифов на шестиугольной доске в стиле ThaumCraft.',
  icon: 'mdi:scroll-text-outline',

  pages: {
    index: () => import('./pages/scroll-study-page.vue'),
  },

  activate(ctx: InsightBookPluginContext) {
    ctx.registerTranslations({ ru, en, zh })

    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en

    const scrollStore = useScrollStudyStore()
    scrollStore.setApiFacade(ctx.api)

    ctx.addNavigationItem({
      title: 'Изучение свитков',
      titleKey: 'plugins.scroll-study.navItemTitle',
      icon: 'mdi:scroll-text-outline',
      routeName: 'plugin-scroll-study-index',
    })

    ctx.registerUIWidget('dictionary:training-modes', 'scroll-study-mode', TrainingModeWidget)

    ctx.notify(t.notifyActivated, 'success')
  },

  deactivate(ctx: InsightBookPluginContext) {
    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en

    ctx.unregisterUIWidget('scroll-study-mode')
    ctx.notify(t.notifyDeactivated, 'info')
  },
}

export default plugin
