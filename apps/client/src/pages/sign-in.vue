<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitInput } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { api, BASE_API_URL } from '~/shared/services/api.service'
import { useAuthStore } from '~/shared/store/auth.store'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { trackEvent } = useUmami()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const showAdvanced = ref(false)

async function handleSignIn() {
  if (!username.value || !password.value)
    return
  isLoading.value = true

  try {
    const res = await api.auth.login({ username: username.value, password: password.value })
    localStorage.setItem('insight_token', res.token)
    await authStore.checkAuth()

    trackEvent('login_success')
    router.push('/')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('signIn.errorAuth'))
  }
  finally {
    isLoading.value = false
  }
}

function handleYandexLogin() {
  window.location.href = `${BASE_API_URL}/api/auth/yandex`
}
</script>

<template>
  <div class="sign-in-wrapper">
    <div class="sign-in-card">
      <div class="header">
        <h2>{{ t('signIn.title') }}</h2>
        <p>{{ t('signIn.subtitle') }}</p>
      </div>

      <KitBtn type="button" class="sign-in-yandex-btn" :disabled="isLoading" @click="handleYandexLogin">
        <Icon icon="mdi:yandex-international" class="yandex-icon" />
        Вход через Яндекс
      </KitBtn>

      <div class="advanced-login-toggle" @click="showAdvanced = !showAdvanced">
        <span>Вход по белому списку</span>
        <Icon :icon="showAdvanced ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      </div>

      <Transition name="expand">
        <form v-show="showAdvanced" class="advanced-form" @submit.prevent="handleSignIn">
          <div class="form-fields">
            <KitInput v-model="username" :placeholder="t('signIn.username')" autocomplete="username" />
            <KitInput v-model="password" type="password" :placeholder="t('signIn.password')" autocomplete="current-password" />
          </div>

          <KitBtn type="submit" color="primary" class="sign-in-btn" :disabled="isLoading">
            {{ t('signIn.loginBtn') }}
          </KitBtn>
        </form>
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sign-in-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, var(--bg-tertiary-color) 0%, var(--bg-primary-color) 100%);
}

.sign-in-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 24px;
  text-align: center;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 24px;

  .header {
    h2 {
      margin: 0 0 8px;
      color: var(--fg-primary-color);
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 1rem;
    }
  }

  .sign-in-yandex-btn {
    width: 100%;
    height: 52px;
    background: linear-gradient(135deg, #fc3f1d, #e3381a);
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 12px;
    border: none;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 8px 16px rgba(252, 63, 29, 0.25);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 20px rgba(252, 63, 29, 0.35);
    }
    &:active {
      transform: translateY(0);
    }
    .yandex-icon {
      font-size: 1.4rem;
    }
  }

  .advanced-login-toggle {
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--fg-tertiary-color);
    font-size: 0.9rem;
    cursor: pointer;
    transition: color 0.2s ease;
    user-select: none;

    &:hover {
      color: var(--fg-secondary-color);
    }
  }

  .advanced-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 8px;

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sign-in-btn {
      width: 100%;
      height: 44px;
      border-radius: 8px;
      font-weight: 500;
    }
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  margin-top: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 250px;
}
</style>
