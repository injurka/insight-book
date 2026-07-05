import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

function isTauriEnv() {
  return !!(window as any).__TAURI__
    || '__TAURI_INTERNALS__' in window
    || !!(window as any).__TAURI_IPC__
}

export const router = createRouter({
  history: isTauriEnv()
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/sign-in',
      name: AppRouteNames.SignIn,
      component: () => import('~/pages/sign-in.vue'),
    },
    {
      path: '/api/auth/yandex/callback',
      name: 'YandexApiCallbackProxy',
      component: () => import('~/pages/auth/yandex/callback.vue'),
      beforeEnter: (to) => {
        const BASE_API_URL = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
        window.location.href = `${BASE_API_URL}${to.fullPath}`

        return false
      },
    },
    {
      path: '/auth/yandex/callback',
      name: AppRouteNames.YandexCallback,
      component: () => import('~/pages/auth/yandex/callback.vue'),
    },
    {
      path: '/',
      name: AppRouteNames.Home,
      component: () => import('~/pages/index.vue'),
    },
    {
      path: '/book/:id',
      name: AppRouteNames.BookInfo,
      component: () => import('~/pages/book.vue'),
    },
    {
      path: '/reader',
      name: AppRouteNames.Reader,
      component: () => import('~/pages/reader.vue'),
    },
    {
      path: '/dictionary',
      name: AppRouteNames.Dictionary,
      component: () => import('~/pages/dictionary.vue'),
    },
    {
      path: '/settings',
      name: AppRouteNames.Settings,
      component: () => import('~/pages/settings.vue'),
    },
    {
      path: '/limits',
      name: AppRouteNames.Limits,
      component: () => import('~/pages/limits.vue'),
    },
    {
      path: '/notebook',
      name: AppRouteNames.Notebook,
      component: () => import('~/pages/notebook.vue'),
    },
    {
      path: '/onboarding',
      name: AppRouteNames.Onboarding,
      component: () => import('~/pages/onboarding.vue'),
    },
  ],
})

const LAST_VIEW_QUERY_KEY = 'library_last_view_query'

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
