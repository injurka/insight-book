import type { InsightBookPlugin } from '@injurka/insight-book-plugin-api'
import { defineAsyncComponent } from 'vue'
import DetectiveCasePage from './pages/detective-case-page.vue'
import { setActiveApi } from './shared/api'
import { connectDevRemoteHmr } from './shared/dev-hmr'

void connectDevRemoteHmr()

const TrainingModeWidget = defineAsyncComponent(() => import('./modules/detective-case/ui/detective-training-mode-widget.vue'))

const plugin: InsightBookPlugin = {
  id: 'detective-case',
  name: 'Detective English',
  version: '1.0.0',
  description: 'Расследуй дело и встречай изучаемые слова в репликах, уликах и собственных фразах.',
  icon: 'mdi:magnify',
  immersive: true,
  orientation: 'portrait',
  pages: {
    index: DetectiveCasePage,
  },
  activate(ctx) {
    setActiveApi(ctx.api)
    ctx.addNavigationItem({
      title: 'Detective English',
      icon: 'mdi:magnify',
      routeName: 'plugin-detective-case-index',
    })
    ctx.registerUIWidget('dictionary:training-modes', 'detective-case-mode', TrainingModeWidget)
  },
  deactivate() {
    // Widget registrations are removed by the plugin manager on deactivation.
    setActiveApi(null)
  },
}

export default plugin
