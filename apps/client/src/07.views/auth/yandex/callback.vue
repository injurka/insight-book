<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { BASE_API_URL } from '~/01.shared/services/api.service'
import { useAuthStore } from '~/01.shared/store/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const error = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined
  const code = route.query.code as string | undefined

  // Web flow: server already exchanged code → token and redirected here with token
  if (token) {
    localStorage.setItem('insight_token', token)
    await authStore.checkAuth()
    router.push('/')

    return
  }

  // Mobile flow: Yandex redirected insightbook://auth/callback?code=...
  // APK caught the deep link and navigated here with the code
  if (code) {
    try {
      const res = await fetch(`${BASE_API_URL}/api/auth/yandex/mobile-exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json() as { token?: string, error?: string }
      if (!res.ok || !data.token) {
        error.value = data?.error || 'Ошибка обмена кода авторизации'

        return
      }

      localStorage.setItem('insight_token', data.token)
      await authStore.checkAuth()
      router.push('/')
    }
    catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Ошибка сети'
    }

    return
  }

  router.push('/sign-in')
})
</script>

<template>
  <div class="callback-wrapper">
    <div v-if="error" class="callback-error">
      {{ error }}
      <br>
      <a href="/sign-in">← Вернуться к входу</a>
    </div>
    <div v-else class="loader">
      Выполняется вход...
    </div>
  </div>
</template>

<style scoped>
.callback-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.callback-error {
  color: var(--color-error, #e55);
  text-align: center;
  padding: 24px;
}
</style>
