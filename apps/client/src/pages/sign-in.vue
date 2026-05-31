<script setup lang="ts">
import { KitBtn, KitInput } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { useAuthStore } from '~/shared/store/auth.store'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const username = ref('')
const password = ref('')
const isLoading = ref(false)

async function handleSignIn() {
  if (!username.value || !password.value)
    return
  isLoading.value = true

  try {
    const res = await api.auth.login({ username: username.value, password: password.value })
    localStorage.setItem('insight_token', res.token)
    await authStore.checkAuth()
    router.push('/')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка авторизации')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="sign-in-wrapper">
    <form class="sign-in-card" @submit.prevent="handleSignIn">
      <h2>Вход в библиотеку</h2>
      <p>Введите учетные данные для доступа</p>

      <div class="form-fields">
        <KitInput v-model="username" placeholder="Имя пользователя" autocomplete="username" />
        <KitInput v-model="password" type="password" placeholder="Пароль" autocomplete="current-password" />
      </div>

      <KitBtn type="submit" color="primary" class="sign-in-btn" :disabled="isLoading">
        Войти
      </KitBtn>
    </form>
  </div>
</template>

<style scoped lang="scss">
.sign-in-wrapper {
  width: 100%;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sign-in-card {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 8px;
    color: var(--fg-primary-color);
  }

  p {
    margin: 0 0 24px;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }

  .sign-in-btn {
    width: 100%;
  }
}
</style>
