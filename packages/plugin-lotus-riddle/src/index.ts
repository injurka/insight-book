import type { InsightBookPlugin } from '@injurka/insight-book-plugin-api'
import { addCollection } from '@iconify/vue'
import { setActiveApi } from './shared/api'
import { connectDevRemoteHmr } from './shared/dev-hmr'
import navigationIcon from './shared/navigation-icon.json'
import RiddlePage from './ui/riddle-page.vue'
import TrainingWidget from './ui/training-widget.vue'

void connectDevRemoteHmr()
const plugin: InsightBookPlugin = {
  id: 'lotus-riddle',
  name: 'Павильон загадок',
  version: '1.0.0',
  description: 'Да-нетка с хранителем лотоса: вспомните существительные из очереди SRS.',
  icon: 'mdi:help-circle-outline',
  immersive: true,
  pages: { index: RiddlePage },
  activate(ctx) {
    addCollection(navigationIcon)
    setActiveApi(ctx.api)
    ctx.addNavigationItem({ title: 'Павильон загадок', icon: 'mdi:help-circle-outline', routeName: 'plugin-lotus-riddle-index' })
    ctx.registerUIWidget('dictionary:training-modes', 'lotus-riddle-mode', TrainingWidget)
  },
  deactivate(ctx) {
    addCollection(navigationIcon)
    ctx.unregisterUIWidget('lotus-riddle-mode')
    setActiveApi(null)
  },
}
export default plugin
