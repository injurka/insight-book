import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('~/pages/index.vue'),
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
