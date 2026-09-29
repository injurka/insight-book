<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const error = ref('')

onMounted(async () => {
  if (route.query.oauth_error === 'api_unavailable') {
    error.value = t('signIn.errorAuth')

    return
  }

  const token = typeof route.query.token === 'string' ? route.query.token : null

  if (token) {
    localStorage.setItem('insight_token', token)
    localStorage.removeItem('insight_uid')
    localStorage.removeItem('insight_user_data')
    localStorage.removeItem('insight_auth_mode')
    await router.replace({ name: AppRouteNames.YandexCallback })

    try {
      await authStore.checkAuth()
      if (!authStore.user) {
        error.value = t('signIn.errorAuth')

        return
      }

      await router.replace('/')
    }
    catch (e: unknown) {
      error.value = e instanceof Error ? e.message : t('signIn.errorAuth')
    }

    return
  }

  await router.replace('/sign-in')
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
