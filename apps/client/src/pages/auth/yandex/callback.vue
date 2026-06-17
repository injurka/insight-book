<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/shared/store/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  const token = route.query.token as string

  if (token) {
    localStorage.setItem('insight_token', token)
    await authStore.checkAuth()
    router.push('/')
  } else {
    // If no token, just redirect to sign-in
    router.push('/sign-in')
  }
})
</script>

<template>
  <div class="callback-wrapper">
    <div class="loader">Loading...</div>
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
</style>
