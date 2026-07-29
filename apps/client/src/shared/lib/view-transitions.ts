import type { Router } from 'vue-router'
import { nextTick, ref, watch } from 'vue'
import { AppRouteNames } from '~/shared/constants/routes'

/**
 * `view-transition-name` для «перелетающей» обложки книги.
 * Имя фиксированное (а не per-book), т.к. элемент с таким именем
 * в каждый момент времени существует только один.
 */
export const BOOK_COVER_TRANSITION_NAME = 'active-book-cover'

/**
 * Id книги, чья обложка участвует в shared-element переходе
 * (библиотека → страница книги и обратно).
 * Выставляется при клике по карточке и сбрасывается при навигации
 * на страницы, где обложка не участвует в переходе.
 */
export const coverTransitionBookId = ref<number | null>(null)

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

/** Сколько максимум ждём данные книги перед снятием «нового» снапшота */
const BOOK_INFO_WAIT_TIMEOUT = 400

export function isViewTransitionSupported(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document
}

/** Пауза на декодирование изображений из памяти перед снятием снапшота */
const SNAPSHOT_SETTLE_DELAY = 50

/**
 * Ждёт, пока загрузятся данные книги (с таймаутом).
 * Нужно, чтобы «новый» снапшот View Transition содержал финальную раскладку
 * страницы книги, а не скелетон — иначе по окончании анимации скелетон
 * резко подменяется реальным контентом.
 */
async function waitForBookInfoReady(bookId: number): Promise<void> {
  const { useLibraryStore } = await import('~/components/05.modules/library/store/library.store')
  const libraryStore = useLibraryStore()

  if (libraryStore.currentBookInfo?.id !== bookId) {
    await Promise.race([
      new Promise<void>((resolve) => {
        const stop = watch(() => libraryStore.currentBookInfo?.id, (id) => {
          if (id === bookId) {
            stop()
            resolve()
          }
        })
      }),
      new Promise<void>(resolve => setTimeout(resolve, BOOK_INFO_WAIT_TIMEOUT)),
    ])
  }

  // Даём странице отрисовать панели и обложку (blob/data URL декодируются из
  // памяти почти мгновенно), и только потом разрешаем снятие снапшота.
  // ВАЖНО: нельзя ждать requestAnimationFrame внутри колбэка startViewTransition —
  // пока колбэк не завершится, рендеринг заморожен и rAF не срабатывает (дедлок).
  await nextTick()
  await new Promise<void>(resolve => setTimeout(resolve, SNAPSHOT_SETTLE_DELAY))
}

/**
 * Оборачивает навигацию vue-router в нативный View Transitions API:
 * DOM обновляется внутри `document.startViewTransition`, поэтому браузер
 * сам анимирует старый и новый снапшоты страниц (кросс-фейд root-снапшотов
 * и морф элементов с совпадающим `view-transition-name`).
 */
export function setupViewTransitions(router: Router): void {
  router.beforeResolve((to, from) => {
    const isSamePage = to.path === from.path // смена query/hash на той же странице — без анимации

    if (!isViewTransitionSupported() || reduceMotionQuery.matches || !from.name || isSamePage) {
      return true
    }

    // Обложка «перелетает» только между библиотекой и страницей книги.
    // На остальных маршрутах флаг сбрасываем до снапшота, чтобы обложка
    // не анимируется отдельно от страницы.
    const keepsCoverTransition = to.name === AppRouteNames.Home || to.name === AppRouteNames.BookInfo
    if (!keepsCoverTransition) {
      coverTransitionBookId.value = null
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false
      const confirmNavigation = () => {
        if (!resolved) {
          resolved = true
          resolve(true)
        }
      }

      try {
        const transition = document.startViewTransition(async () => {
          // Подтверждаем навигацию и ждём, пока Vue отрендерит новую страницу —
          // только после этого браузер снимет «новый» снапшот.
          confirmNavigation()
          await nextTick()

          // Страница книги: ждём данные (с таймаутом), чтобы снапшот содержал
          // финальную раскладку, а не скелетон. Пока ждём, пользователь видит
          // прежнюю страницу — переход просто стартует чуть позже.
          if (to.name === AppRouteNames.BookInfo) {
            await waitForBookInfoReady(Number(to.params.id))
          }
        })

        // Страховка: пока колбэк перехода не завершится, рендеринг страницы
        // заморожен. Если что-то пойдёт не так — принудительно пропускаем
        // переход, чтобы приложение не осталось висеть на старом снапшоте.
        // После нормального завершения перехода skipTransition — безопасный no-op.
        setTimeout(() => transition.skipTransition(), 2000)
      }
      catch {
        confirmNavigation()
      }
    })
  })
}
