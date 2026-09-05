import type { LocationQuery } from 'vue-router'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { API_URL, isTauri } from '~/01.shared/lib/env'
import { setupViewTransitions } from '~/01.shared/lib/view-transitions'
import { useAuthStore } from '~/01.shared/store/auth.store'

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
    if (!scroller)
      return

    if (scroller.scrollTop !== top && attempts < 20) {
      scroller.scrollTop = top
      attempts++
      requestAnimationFrame(tick)
    }
  }

  tick()
}

export const router = createRouter({
  history: isTauri
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
      if (top != null)
        restoreScrollTop(top)

      return
    }

    // Обычная навигация — всегда в начало страницы. .main-content — общий
    // overflow-контейнер, который переживает смену страниц (window не
    // скроллится), поэтому сбрасываем его вручную.
    const main = findScroller()
    if (main)
      main.scrollTop = 0
  },

  routes: [
    {
      path: '/sign-in',
      name: AppRouteNames.SignIn,
      component: async () => import('~/07.views/sign-in.vue'),
    },
    {
      path: '/api/auth/yandex/callback',
      name: 'YandexApiCallbackProxy',
      component: async () => import('~/07.views/auth/yandex/callback.vue'),
      beforeEnter: (to) => {
        window.location.href = `${API_URL}${to.fullPath}`

        return false
      },
    },
    {
      path: '/auth/yandex/callback',
      name: AppRouteNames.YandexCallback,
      component: async () => import('~/07.views/auth/yandex/callback.vue'),
    },
    {
      path: '/',
      name: AppRouteNames.Home,
      component: async () => import('~/07.views/index.vue'),
    },
    {
      path: '/book/:id',
      name: AppRouteNames.BookInfo,
      component: async () => import('~/07.views/book.vue'),
    },
    {
      path: '/reader',
      name: AppRouteNames.Reader,
      component: async () => import('~/07.views/reader.vue'),
    },
    {
      path: '/dictionary',
      name: AppRouteNames.Dictionary,
      component: async () => import('~/07.views/dictionary.vue'),
    },
    {
      path: '/settings',
      name: AppRouteNames.Settings,
      component: async () => import('~/07.views/settings.vue'),
    },
    {
      path: '/limits',
      name: AppRouteNames.Limits,
      component: async () => import('~/07.views/limits.vue'),
    },
    {
      path: '/notebook',
      name: AppRouteNames.Notebook,
      component: async () => import('~/07.views/notebook.vue'),
    },
    {
      path: '/onboarding',
      name: AppRouteNames.Onboarding,
      component: async () => import('~/07.views/onboarding.vue'),
    },
    {
      path: '/about',
      name: AppRouteNames.About,
      component: async () => import('~/07.views/about.vue'),
    },
    {
      path: '/copyright',
      name: AppRouteNames.Copyright,
      component: async () => import('~/07.views/copyright.vue'),
    },
    {
      path: '/privacy',
      name: AppRouteNames.Privacy,
      component: async () => import('~/07.views/privacy.vue'),
    },
    {
      path: '/offer',
      name: AppRouteNames.Offer,
      component: async () => import('~/07.views/offer.vue'),
    },
  ],
})

const LAST_VIEW_QUERY_KEY = 'library_last_view_query'

router.beforeEach((_to, from) => {
  if (from.name) {
    const scroller = findScroller()
    if (scroller)
      mainScrollPositions.set(from.fullPath, scroller.scrollTop)
  }
})

setupViewTransitions(router)

function getOnboardingRedirect(toName: string | symbol | null | undefined, hasSeenOnboarding: boolean) {
  if (
    !hasSeenOnboarding
    && toName !== AppRouteNames.Onboarding
    && toName !== AppRouteNames.SignIn
    && toName !== AppRouteNames.YandexCallback
  ) {
    return { name: AppRouteNames.Onboarding }
  }

  return null
}

function getSavedHomeQueryRedirect(toName: string | symbol | null | undefined, toQuery: LocationQuery, fromName: string | symbol | null | undefined) {
  if (toName === AppRouteNames.Home && Object.keys(toQuery).length === 0 && !fromName) {
    try {
      const savedQueryStr = localStorage.getItem(LAST_VIEW_QUERY_KEY)
      if (savedQueryStr) {
        const savedQuery = JSON.parse(savedQueryStr)
        if (Object.keys(savedQuery).length > 0)
          return { name: AppRouteNames.Home, query: savedQuery, replace: true }
      }
    }
    catch (e) {
      console.warn('Failed to parse saved query', e)
    }
  }

  return null
}

function getAuthRedirect(toName: string | symbol | null | undefined, isAuth: boolean, isSingleMode: boolean) {
  const isAuthRoute = toName === AppRouteNames.SignIn || toName === AppRouteNames.YandexCallback

  if (isAuth && isAuthRoute)
    return { name: AppRouteNames.Home }

  const protectedRoutes = [
    AppRouteNames.Dictionary,
    AppRouteNames.Reader,
    AppRouteNames.Settings,
    AppRouteNames.Limits,
    AppRouteNames.Notebook,
  ]
  if (!isAuth && !isSingleMode && protectedRoutes.includes(toName as AppRouteNames))
    return { name: AppRouteNames.SignIn }

  return null
}

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthReady)
    await authStore.checkAuth()

  const hasSeenOnboarding = localStorage.getItem('insight_onboarding_completed') === 'true'

  const onboardingRedirect = getOnboardingRedirect(to.name, hasSeenOnboarding)
  if (onboardingRedirect)
    return onboardingRedirect

  const savedQueryRedirect = getSavedHomeQueryRedirect(to.name, to.query, from.name)
  if (savedQueryRedirect)
    return savedQueryRedirect

  const authRedirect = getAuthRedirect(to.name, !!authStore.user, !!authStore.isSingleMode)
  if (authRedirect)
    return authRedirect
})

router.afterEach((to) => {
  const { trackPageview } = useTracking()
  trackPageview(to.fullPath, String(to.name || ''))

  if (to.name === AppRouteNames.Home)
    localStorage.setItem(LAST_VIEW_QUERY_KEY, JSON.stringify(to.query))
})

export default router
