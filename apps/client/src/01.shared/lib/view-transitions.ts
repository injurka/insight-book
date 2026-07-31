import type { Router } from 'vue-router'
import { nextTick, ref, watch } from 'vue'
import { AppRouteNames } from '~/01.shared/constants/routes'

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

/**
 * Сколько максимум ждём данные книги перед снятием «нового» снапшота.
 * ВАЖНО: всё это время страница заморожена (рендеринг приостановлен
 * View Transition), поэтому значение держим маленьким — оно нужно лишь
 * чтобы поймать быстрый ответ из кэша. Если данные не успели — целью
 * морфа обложки служит скелетон с оптимистичной обложкой.
 */
const BOOK_INFO_WAIT_TIMEOUT = 150

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
  const { useLibraryStore } = await import('~/05.modules/library/store/library.store')
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
 * Маршруты, между которыми работает View Transition (shared-element морф
 * обложки книги библиотека ↔ страница книги). На остальную навигацию
 * переход не вешаем намеренно: пока браузер снимает оба снапшота, страница
 * заморожена (сотни мс «зависания» после клика), а визуальной ценности
 * кросс-фейд корня на обычных страницах не несёт.
 */
const TRANSITION_ROUTES: AppRouteNames[] = [AppRouteNames.Home, AppRouteNames.BookInfo]

/**
 * Участвует ли маршрут в нативном View Transition (морф обложки).
 * Используется в app.vue, чтобы для остальных маршрутов оставить
 * CSS-переход fade — native и CSS анимации не должны дублироваться.
 */
export function isNativeTransitionRoute(name: unknown): boolean {
  return TRANSITION_ROUTES.includes(name as AppRouteNames)
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
    const isTransitionRoute = TRANSITION_ROUTES.includes(to.name as AppRouteNames)
      && TRANSITION_ROUTES.includes(from.name as AppRouteNames)

    // Обложка «перелетает» только между библиотекой и страницей книги.
    // При уходе на другие маршруты флаг сбрасываем, чтобы карточка
    // не сохраняла `view-transition-name` без надобности.
    if (!isTransitionRoute) {
      coverTransitionBookId.value = null
    }

    if (!isViewTransitionSupported() || reduceMotionQuery.matches || !from.name || isSamePage || !isTransitionRoute) {
      return true
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

          // Страница книги: ждём данные (с коротким таймаутом), чтобы снапшот
          // содержал финальную раскладку, а не скелетон. Пока ждём, страница
          // заморожена — поэтому таймаут маленький (см. BOOK_INFO_WAIT_TIMEOUT).
          if (to.name === AppRouteNames.BookInfo) {
            await waitForBookInfoReady(Number(to.params.id))
          }
        })

        // Страховка: пока колбэк перехода не завершится, рендеринг страницы
        // заморожен. Если что-то пойдёт не так — принудительно пропускаем
        // переход, чтобы приложение не осталось висеть на старом снапшоте.
        // После нормального завершения перехода skipTransition — безопасный no-op.
        const safetyTimer = setTimeout(() => transition.skipTransition(), 2000)
        transition.finished
          .catch(() => {}) // переход пропущен — finished отклоняется, это нормально
          .finally(() => clearTimeout(safetyTimer))
      }
      catch {
        confirmNavigation()
      }
    })
  })
}
