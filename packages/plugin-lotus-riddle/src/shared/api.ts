import type { InsightBookPluginApiFacade } from '@injurka/insight-book-plugin-api'

let activeApi: InsightBookPluginApiFacade | null = null
export function setActiveApi(api: InsightBookPluginApiFacade | null) {
  activeApi = api
}
export function getApi(): InsightBookPluginApiFacade {
  if (!activeApi)
    throw new Error('Плагин ещё не подключён. Откройте его через меню InsightBook.')

  return activeApi
}
export async function bounded<T>(promise: Promise<T>, milliseconds = 45000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Хранитель не ответил вовремя. Попробуйте ещё раз.')), milliseconds)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}
