<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/01.shared/store/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const error = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined

  if (token) {
    localStorage.setItem('insight_token', token)
    await authStore.checkAuth()
    router.push('/')

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
