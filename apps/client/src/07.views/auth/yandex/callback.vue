<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { claimWebOAuthAttempt, oauthErrorKey } from '~/01.shared/lib/oauth-flow'
import { hasOAuthSession } from '~/01.shared/lib/poll-oauth-status'
import { authSessionIdentity, authSessionSnapshot } from '~/01.shared/services/auth-session.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

const repos = useRepos()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const error = ref('')
const controller = new AbortController()

onMounted(async () => {
  const { session_id: sessionId } = route.query

  try {
    const snapshot = authSessionSnapshot()

    // Remove the one-use identifier from the address bar before redeeming it.
    if (Object.keys(route.query).length)
      await router.replace({ name: AppRouteNames.YandexCallback })

    controller.signal.throwIfAborted()

    if (!claimWebOAuthAttempt(sessionId, authSessionIdentity(), sessionStorage)) {
      error.value = 'signIn.oauthExpired'

      return
    }

    const result = await repos.auth.oauthStatus(sessionId, { signal: controller.signal })

    controller.signal.throwIfAborted()

    if (!hasOAuthSession(result)) {
      error.value = result.status === 'pending' ? 'signIn.oauthExpired' : oauthErrorKey(result.error)

      return
    }

    repos.auth.acceptOAuthSession(result, snapshot)
    await authStore.checkAuth()

    if (!authStore.user) {
      error.value = 'signIn.errorAuth'

      return
    }

    if (!controller.signal.aborted)
      await router.replace({ name: AppRouteNames.Home })
  }
  catch {
    if (!controller.signal.aborted)
      error.value = 'signIn.errorAuth'
  }
})

onUnmounted(() => controller.abort())
</script>

<template>
  <main class="callback-wrapper">
    <div class="callback-card">
      <span class="callback-icon" aria-hidden="true">
        <Icon :icon="error ? 'mdi:alert-circle-outline' : 'mdi:lock-outline'" />
      </span>
      <p class="brand">
        InsightBook
      </p>
      <h1 :role="error ? 'alert' : 'status'">
        {{ t(error || 'signIn.oauthFinishing') }}
      </h1>
      <KitBtn v-if="error" icon="mdi:arrow-left" @click="router.replace({ name: AppRouteNames.SignIn })">
        {{ t('signIn.oauthBack') }}
      </KitBtn>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.callback-wrapper {
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 24px;
}

.callback-card {
  width: min(100%, 26rem);
  padding: clamp(22px, 6vw, 36px);
  border-radius: 24px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);

  h1 {
    margin: 8px 0 20px;
    font-size: clamp(1.25rem, 5vw, 1.6rem);
    line-height: 1.3;
  }
}

.callback-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--bg-tertiary-color);
  color: var(--fg-accent-color);
  font-size: 1.5rem;
}

.brand {
  margin: 12px 0 0;
  color: var(--fg-secondary-color);
  font-weight: 700;
}
</style>
