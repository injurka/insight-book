import type { Router } from 'vue-router'
import { nextTick, ref } from 'vue'
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

export function isViewTransitionSupported(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document
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
        document.startViewTransition(async () => {
          // Подтверждаем навигацию и ждём, пока Vue отрендерит новую страницу —
          // только после этого браузер снимет «новый» снапшот.
          confirmNavigation()
          await nextTick()
        })
      }
      catch {
        confirmNavigation()
      }
    })
  })
}
