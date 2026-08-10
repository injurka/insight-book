import type { AdminUser } from '~/01.shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'

const STORAGE_TOKEN = 'admin_token'
const STORAGE_USER = 'admin_user'

export const useAuthStore = defineStore('auth', () => {
  const repos = useRepos()

  const user = ref<AdminUser | null>(null)
  const isReady = ref(false)

  function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_USER)
    if (stored) {
      try {
        user.value = JSON.parse(stored)
      }
      catch {
        user.value = null
      }
    }
  }

  function persistUser(u: AdminUser) {
    user.value = u
    localStorage.setItem(STORAGE_USER, JSON.stringify(u))
  }

  function clearStorage() {
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_USER)
    user.value = null
  }

  async function checkAuth() {
    const token = localStorage.getItem(STORAGE_TOKEN)
    if (!token) {
      isReady.value = true

      return
    }

    try {
      const res = await repos.auth.me()
      if (res.user && res.user.role === 'admin') {
        persistUser(res.user)
      }
      else {
        clearStorage()
      }
    }
    catch {
      loadFromStorage()
    }
    finally {
      isReady.value = true
    }
  }

  async function login(loginStr: string, password: string) {
    const res = await repos.auth.login(loginStr, password)
    if (res.user.role !== 'admin')
      throw new Error('Доступ запрещён: требуется роль администратора')

    localStorage.setItem(STORAGE_TOKEN, res.token)
    persistUser(res.user)
  }

  function logout() {
    clearStorage()
  }

  loadFromStorage()

  return {
    user,
    isReady,
    checkAuth,
    login,
    logout,
  }
})
