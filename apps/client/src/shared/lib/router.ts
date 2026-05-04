import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('~/pages/index.vue'),
    },
    {
      path: '/book/:id',
      name: 'book-info',
      component: () => import('~/pages/book.vue'),
    },
    {
      path: '/reader',
      name: 'reader',
      component: () => import('~/pages/reader.vue'),
    },
    {
      path: '/dictionary',
      name: 'dictionary',
      component: () => import('~/pages/dictionary.vue'),
    },
  ],
})

export default router
