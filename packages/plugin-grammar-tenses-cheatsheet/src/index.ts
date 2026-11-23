import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import GrammarTensesWidget from './modules/tense-cheatsheet/ui/grammar-tenses-widget.vue'
import { registerTenseCheatsheetIcons } from './shared/icons'

const plugin: InsightBookPlugin = {
  id: 'grammar-tenses-cheatsheet',
  name: 'Grammar Tenses Cheatsheet',
  version: '1.0.3',
  description: 'Шпаргалка по временам английского языка внутри блока грамматического анализа.',
  icon: 'mdi:clock-check-outline',

  activate(ctx: InsightBookPluginContext) {
    registerTenseCheatsheetIcons()

    ctx.registerUIWidget(
      'reader:header-actions',
      'grammar-tenses-cheatsheet-reader-widget',
      GrammarTensesWidget,
    )
  },

  deactivate(ctx: InsightBookPluginContext) {
    ctx.unregisterUIWidget('grammar-tenses-cheatsheet-reader-widget')
  },
}

export default plugin
