import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import GrammarTensesWidget from './modules/tense-cheatsheet/ui/grammar-tenses-widget.vue'
import { registerTenseCheatsheetIcons } from './shared/icons'
// Критические сабсеты Maple Mono CN (латиница + кириллица, 3 веса, ~200 КБ):
// плагин должен рендериться тем же шрифтом, что и основное приложение, в том
// числе в песочнице. Полный fonts.css тянул бы в бандл ~413 woff2 (~32 МБ).
import '../../../apps/client/public/fonts/split/regular/result-critical.css'
import '../../../apps/client/public/fonts/split/medium/result-critical.css'
import '../../../apps/client/public/fonts/split/semibold/result-critical.css'

const plugin: InsightBookPlugin = {
  id: 'grammar-tenses-cheatsheet',
  name: 'Grammar Tenses Cheatsheet',
  version: '1.0.1',
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
