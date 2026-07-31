import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { API_URL } from '~/01.shared/lib/env'
import { setupViewTransitions } from '~/01.shared/lib/view-transitions'
import { useAuthStore } from '~/01.shared/store/auth.store'

function isTauriEnv() {
  return !!(window as any).__TAURI__
    || '__TAURI_INTERNALS__' in window
    || !!(window as any).__TAURI_IPC__
}

const MAIN_SCROLLER_SELECTOR = '.main-content'

const mainScrollPositions = new Map<string, number>()

/** Скролл-контейнер приложения (.main-content из DefaultLayout, общий для всех страниц) */
function findScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(MAIN_SCROLLER_SELECTOR)
}

/**
 * Восстанавливает scrollTop контейнера. Контент страницы может дорисоваться
 * позже (асинхронные данные, обложки) — тогда scrollTop клампится высотой
 * неполного контента. Поэтому повторяем попытку несколько кадров, пока
 * позиция не «приклеится». rAF-колбэки не выполняются, пока идёт
 * View Transition (рендеринг заморожен), так что повторы случаются
 * уже после него, на финальной раскладке.
 */
function restoreScrollTop(top: number): void {
  let attempts = 0
  const tick = () => {
    const scroller = findScroller()
    if (!scroller) {
      return
    }
    if (scroller.scrollTop !== top && attempts < 20) {
      scroller.scrollTop = top
      attempts++
      requestAnimationFrame(tick)
    }
  }
  tick()
}

export const router = createRouter({
  history: isTauriEnv()
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),

  scrollBehavior(to, _from, savedPosition) {
    // vue-router умеет скроллить только window: даже при возврате { el, top }
    // он делает window.scrollTo до позиции элемента, а не el.scrollTop.
    // В нашем лейауте window не скроллится (100dvh + overflow: hidden),
    // скроллится контейнер — поэтому крутим его вручную. scrollBehavior
    // вызывается после рендера новой страницы, её DOM уже на месте.
    if (savedPosition) {
      // popstate (кнопка «назад»/«вперёд») — восстанавливаем позицию скролла,
      // которую запомнили при уходе со страницы
      const top = mainScrollPositions.get(to.fullPath)
      if (top != null) {
        restoreScrollTop(top)
      }
      return
    }

    // Обычная навигация — всегда в начало страницы. .main-content — общий
    // overflow-контейнер, который переживает смену страниц (window не
    // скроллится), поэтому сбрасываем его вручную.
    const main = findScroller()
    if (main) {
      main.scrollTop = 0
    }
  },

  routes: [
    {
      path: '/sign-in',
      name: AppRouteNames.SignIn,
      component: () => import('~/07.views/sign-in.vue'),
    },
    {
      path: '/api/auth/yandex/callback',
      name: 'YandexApiCallbackProxy',
      component: () => import('~/07.views/auth/yandex/callback.vue'),
      beforeEnter: (to) => {
        window.location.href = `${API_URL}${to.fullPath}`

        return false
      },
    },
    {
      path: '/auth/yandex/callback',
      name: AppRouteNames.YandexCallback,
      component: () => import('~/07.views/auth/yandex/callback.vue'),
    },
    {
      path: '/',
      name: AppRouteNames.Home,
      component: () => import('~/07.views/index.vue'),
    },
    {
      path: '/book/:id',
      name: AppRouteNames.BookInfo,
      component: () => import('~/07.views/book.vue'),
    },
    {
      path: '/reader',
      name: AppRouteNames.Reader,
      component: () => import('~/07.views/reader.vue'),
    },
    {
      path: '/dictionary',
      name: AppRouteNames.Dictionary,
      component: () => import('~/07.views/dictionary.vue'),
    },
    {
      path: '/settings',
      name: AppRouteNames.Settings,
      component: () => import('~/07.views/settings.vue'),
    },
    {
      path: '/limits',
      name: AppRouteNames.Limits,
      component: () => import('~/07.views/limits.vue'),
    },
    {
      path: '/notebook',
      name: AppRouteNames.Notebook,
      component: () => import('~/07.views/notebook.vue'),
    },
    {
      path: '/onboarding',
      name: AppRouteNames.Onboarding,
      component: () => import('~/07.views/onboarding.vue'),
    },
    {
      path: '/about',
      name: AppRouteNames.About,
      component: () => import('~/07.views/about.vue'),
    },
    {
      path: '/copyright',
      name: AppRouteNames.Copyright,
      component: () => import('~/07.views/copyright.vue'),
    },
    {
      path: '/privacy',
      name: AppRouteNames.Privacy,
      component: () => import('~/07.views/privacy.vue'),
    },
    {
      path: '/offer',
      name: AppRouteNames.Offer,
      component: () => import('~/07.views/offer.vue'),
    },
  ],
})

const LAST_VIEW_QUERY_KEY = 'library_last_view_query'

router.beforeEach((_to, from) => {
  if (from.name) {
    const scroller = findScroller()
    if (scroller) {
      mainScrollPositions.set(from.fullPath, scroller.scrollTop)
    }
  }
})

setupViewTransitions(router)

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthReady) {
    await authStore.checkAuth()
  }

  const hasSeenOnboarding = localStorage.getItem('insight_onboarding_completed') === 'true'

  if (
    !hasSeenOnboarding && to.name !== AppRouteNames.Onboarding
    && to.name !== AppRouteNames.SignIn
    && to.name !== AppRouteNames.YandexCallback
  ) {
    return { name: AppRouteNames.Onboarding }
  }

  if (to.name === AppRouteNames.Home && Object.keys(to.query).length === 0 && !from.name) {
    try {
      const savedQueryStr = localStorage.getItem(LAST_VIEW_QUERY_KEY)
      if (savedQueryStr) {
        const savedQuery = JSON.parse(savedQueryStr)
        if (Object.keys(savedQuery).length > 0) {
          return { name: AppRouteNames.Home, query: savedQuery, replace: true }
        }
      }
    }
    catch (e) {
      console.warn('Failed to parse saved query', e)
    }
  }

  const isAuthRoute = to.name === AppRouteNames.SignIn || to.name === AppRouteNames.YandexCallback

  if (authStore.user && isAuthRoute) {
    return { name: AppRouteNames.Home }
  }

  const protectedRoutes = [
    AppRouteNames.Dictionary,
    AppRouteNames.Reader,
    AppRouteNames.Settings,
    AppRouteNames.Limits,
    AppRouteNames.Notebook,
  ]
  if (!authStore.user && !authStore.isSingleMode && protectedRoutes.includes(to.name as AppRouteNames)) {
    return { name: AppRouteNames.SignIn }
  }
})

router.afterEach((to) => {
  const { trackPageview } = useUmami()
  trackPageview(to.fullPath, String(to.name || ''))

  if (to.name === AppRouteNames.Home) {
    localStorage.setItem(LAST_VIEW_QUERY_KEY, JSON.stringify(to.query))
  }
})

export default router
