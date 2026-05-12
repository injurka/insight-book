import { createRouter, createWebHistory } from 'vue-router'
import { AppRouteNames } from '~/shared/constants/routes'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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

export default router
