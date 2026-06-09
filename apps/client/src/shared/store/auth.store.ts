import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api.service'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{
    id: number
    username: string
    pushTargetDeckId?: number | null
    pushTimeStart?: string
    pushTimeEnd?: string
    timezone?: string
    uiLanguage?: string 
  } | null>(null)

  const isSingleMode = ref(false)
  const isAuthReady = ref(false)

  async function checkAuth() {
    try {
      const res = await api.auth.me()

      user.value = res.user
      isSingleMode.value = res.mode === 'single'

      if (res.user) {
        localStorage.setItem('insight_uid', String(res.user.id))
        localStorage.setItem('insight_user_data', JSON.stringify(res.user))
        localStorage.setItem('insight_auth_mode', res.mode)
      }
    }
    catch {
      const token = localStorage.getItem('insight_token')
      const cachedUser = localStorage.getItem('insight_user_data')
      const cachedMode = localStorage.getItem('insight_auth_mode')

      if (cachedMode) {
        isSingleMode.value = cachedMode === 'single'
      }

      if ((token || isSingleMode.value) && cachedUser) {
        user.value = JSON.parse(cachedUser)
      }
      else {
        user.value = null
      }
    }
    finally {
      isAuthReady.value = true
    }
  }

  function logout() {
    localStorage.removeItem('insight_token')
    localStorage.removeItem('insight_uid')
    localStorage.removeItem('insight_user_data')
    localStorage.removeItem('insight_auth_mode')
    user.value = null
  }

  return { user, isSingleMode, isAuthReady, checkAuth, logout }
})
