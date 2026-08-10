import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '~/01.shared/store/auth.store'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('~/07.views/login.vue'),
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('~/07.views/dashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('~/07.views/users.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users/create',
      name: 'user-create',
      component: () => import('~/07.views/user-create.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users/:id',
      name: 'user-edit',
      component: () => import('~/07.views/user-edit.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
    {
      path: '/books/pending',
      name: 'books-pending',
      component: () => import('~/07.views/books-pending.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/plugins/pending',
      name: 'plugins-pending',
      component: () => import('~/07.views/plugins-pending.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.isReady)
    await auth.checkAuth()

  if (to.meta.requiresAuth && !auth.user)
    return { name: 'login' }

  if (to.name === 'login' && auth.user)
    return { name: 'dashboard' }
})

export default router
