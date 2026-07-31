import { useToastStore } from '~/01.shared/store/toast.store'
import { KitPageLoader } from '~/02.kit/atoms/kit-page-loader'

/**
 * Умная обертка для ленивой загрузки компонентов.
 * Обрабатывает ошибки сети, ошибки версионирования чанков и показывает лоадер.
 */
export function lazyComponent(loader: () => Promise<any>) {
  return defineAsyncComponent({
    loader,

    // Глобальный лоадер для всех ленивых компонентов
    loadingComponent: () => h('div', {
      style: 'display: flex; justify-content: center; padding: 24px; width: 100%;',
    }, [h(KitPageLoader)]),

    // Задержка перед показом лоадера (избегает моргания при быстром интернете)
    delay: 200,

    // Таймаут загрузки (10 секунд)
    timeout: 10000,

    // Обработка ошибок (очень важно для Vite)
    onError(
      error,
      retry,
      fail,
      attempts,
    ) {
      const errorMessage = error.message.toLowerCase()
      const isChunkLoadError = errorMessage.includes('fetch dynamically imported module')
        || errorMessage.includes('importing a module script failed')

      if (isChunkLoadError) {
        // Защита от бесконечного цикла перезагрузок
        const reloadCount = Number(sessionStorage.getItem('chunk_reload_count') || '0')
        if (reloadCount < 2) {
          sessionStorage.setItem('chunk_reload_count', String(reloadCount + 1))
          window.location.reload()
          return
        }
      }

      // Для других сетевых ошибок — делаем до 3 попыток перезапроса
      if (attempts <= 3) {
        setTimeout(retry, 1000) // Ждем 1 секунду перед новой попыткой
      }
      else {
        const toast = useToastStore()
        toast.error('Ошибка загрузки компонента. Проверьте интернет-соединение.')
        fail()
      }
    },
  })
}
