import type { InsightBookPluginApiFacade } from '@injurka/insight-book-plugin-api'
import {
  getPluginApi as getGlobalPluginApi,

} from '@injurka/insight-book-plugin-api'

let activeApi: InsightBookPluginApiFacade | null = null

export function setActiveApi(api: InsightBookPluginApiFacade | null): void {
  activeApi = api
}

export function getActiveApi(): InsightBookPluginApiFacade {
  const api = activeApi ?? getGlobalPluginApi()
  if (!api) {
    throw new Error('API плагина ещё не подключён.')
  }
  return api
}
