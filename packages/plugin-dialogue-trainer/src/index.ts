import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import { setPluginApi, setPluginContext } from '@injurka/insight-book-plugin-api'
import { registerDialogueTrainerIcons } from './shared/icons'
import { setPluginApi as setLocalApi } from './shared/lib/api'
import en from './shared/locales/en'
import ru from './shared/locales/ru'
import zh from './shared/locales/zh'

const plugin: InsightBookPlugin = {
  id: 'dialogue-trainer',
  name: 'Dialogue Trainer',
  version: '1.0.0',
  description: 'Interactive voice dialogue practice with grammar, lexical, and conversational feedback.',
  icon: 'mdi:account-voice',
  immersive: true,

  pages: {
    index: () => import('./pages/dialogue-page.vue'),
  },

  activate(ctx: InsightBookPluginContext) {
    setPluginContext(ctx)

    if (ctx.api) {
      setPluginApi(ctx.api)
      setLocalApi(ctx.api)
    }

    registerDialogueTrainerIcons()
    ctx.registerTranslations({ ru, en, zh })

    const locales = { ru, en, zh } as const
    const t = locales[ctx.locale as keyof typeof locales] ?? en

    ctx.addNavigationItem({
      title: 'Dialogue Trainer',
      titleKey: 'plugins.dialogue-trainer.navItemTitle',
      icon: 'mdi:account-voice',
      routeName: 'plugin-dialogue-trainer-index',
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
