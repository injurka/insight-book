import { createRouter, createWebHistory } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/sign-in',
      name: AppRouteNames.SignIn,
      component: () => import('~/pages/sign-in.vue'),
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
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthReady) {
    await authStore.checkAuth()
  }

  const isAuthRoute = to.name === AppRouteNames.SignIn

  if (authStore.user && isAuthRoute) {
    return { name: AppRouteNames.Home }
  }

  const protectedRoutes = [AppRouteNames.Dictionary, AppRouteNames.Reader, AppRouteNames.Settings]
  if (!authStore.user && !authStore.isSingleMode && protectedRoutes.includes(to.name as AppRouteNames)) {
    return { name: AppRouteNames.SignIn }
  }
})


router.afterEach((to) => {
  const { trackPageview } = useUmami()
  trackPageview(to.fullPath, String(to.name || ''))
})

export default router
