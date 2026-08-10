<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useAuthStore } from '~/01.shared/store/auth.store'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitFormGroup from '~/02.kit/molecules/kit-form-group.vue'

const auth = useAuthStore()
const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  if (!login.value || !password.value)
    return
  error.value = ''
  loading.value = true
  try {
    await auth.login(login.value, password.value)
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Ошибка входа'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form">
    <h1 class="login-form__title">
      <Icon icon="mdi:bookshelf" class="login-form__icon" />
      <span>InsightBook Admin</span>
    </h1>
    <p class="login-form__subtitle">
      Вход для администраторов
    </p>

    <KitFormGroup>
      <template #label>
        Логин или email
      </template>
      <KitInput v-model="login" placeholder="admin" @keyup.enter="handleSubmit" />
    </KitFormGroup>
    <KitFormGroup>
      <template #label>
        Пароль
      </template>
      <KitInput
        v-model="password"
        type="password"
        placeholder="••••••"
        @keyup.enter="handleSubmit"
      />
    </KitFormGroup>

    <KitBtn
      variant="primary"
      :disabled="loading"
      style="width:100%; padding:12px"
      @click="handleSubmit"
    >
      <Icon v-if="!loading" icon="mdi:login" />
      <span>{{ loading ? 'Вход...' : 'Войти' }}</span>
    </KitBtn>

    <div v-if="error" class="login-form__error">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.login-form {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-primary-color, #c7c0b6);
  border-radius: 12px;
  padding: 40px;
  width: 400px;
  max-width: 90vw;
}
.login-form__title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  color: var(--fg-primary-color, #4a443c);
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.login-form__icon {
  font-size: 32px;
  color: var(--fg-accent-color, #4b8266);
}
.login-form__subtitle {
  text-align: center;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 14px;
  margin: 0 0 24px;
}
.login-form__error {
  color: var(--fg-error-color, #c46d6d);
  font-size: 14px;
  margin-top: 12px;
  text-align: center;
}
</style>
