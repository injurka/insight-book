import { openUrl } from '@tauri-apps/plugin-opener'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { isTauri } from '~/01.shared/lib/env'
import { oauthErrorKey } from '~/01.shared/lib/oauth-flow'
import { isOAuthAborted, isOAuthLinkSuccess, OAuthTimeoutError, pollOAuthStatus } from '~/01.shared/lib/poll-oauth-status'
import { useAuthStore } from '~/01.shared/store/auth.store'

export function useAccountSettings() {
  const authStore = useAuthStore()
  const repos = useRepos()
  const toast = useToast()
  const { locale, t } = useI18n()

  const user = computed(() => authStore.user)
  const isYandexLinked = computed(() => Boolean(authStore.user?.yandexId || authStore.user?.isYandexLinked))

  const isLinking = ref(false)
  const isUnlinking = ref(false)
  const isUnlinkModalVisible = ref(false)
  const providerToUnlink = ref<string | null>(null)
  const isUsernamePromptOpen = ref(false)

  let oauthAbortController: AbortController | null = null

  function clearPolling() {
    oauthAbortController?.abort()
    oauthAbortController = null
  }

  async function linkYandex() {
    if (isLinking.value)
      return

    const controller = new AbortController()
    oauthAbortController = controller
    isLinking.value = true

    try {
      const sessionId = isTauri ? uuidv4() : undefined
      const { redirectUrl } = await repos.auth.startYandexLink({ sessionId, locale: locale.value }, { signal: controller.signal })
      controller.signal.throwIfAborted()

      if (!sessionId) {
        window.location.assign(redirectUrl)

        return
      }

      await openUrl(redirectUrl)
      const data = await pollOAuthStatus(signal => repos.auth.oauthStatus(sessionId, { signal }), { signal: controller.signal })

      if (!isOAuthLinkSuccess(data)) {
        toast.error(t(data.error ? oauthErrorKey(data.error) : 'settings.linkFailed'))

        return
      }

      await authStore.checkAuth()

      if (!controller.signal.aborted)
        toast.success(t('settings.yandexLinkedSuccess'))
    }
    catch (error) {
      if (!isOAuthAborted(controller.signal, error)) {
        toast.error(t(error instanceof OAuthTimeoutError ? 'signIn.oauthTimeout' : 'settings.linkFailed'))
      }
    }
    finally {
      clearPolling()
      isLinking.value = false
    }
  }

  function openUnlinkModal(provider: string) {
    providerToUnlink.value = provider
    isUnlinkModalVisible.value = true
  }

  async function confirmUnlink(password: string) {
    if (isUnlinking.value || !providerToUnlink.value || !password)
      return

    isUnlinking.value = true

    try {
      await authStore.unlinkProvider(providerToUnlink.value, password)
      toast.success(t('settings.yandexUnlinkedSuccess', 'Аккаунт Яндекс успешно отвязан'))
      isUnlinkModalVisible.value = false
    }
    catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error', 'Ошибка'))
    }
    finally {
      isUnlinking.value = false
    }
  }

  async function updateAvatar(file: File) {
    try {
      await authStore.updateAvatar(file)
      toast.success(t('globalActions.avatarUpdated', 'Аватар успешно обновлен'))
    }
    catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.avatarLoadError', 'Ошибка загрузки аватара'))
    }
  }

  async function updateUsername(newUsername: string) {
    try {
      await authStore.updateUsername(newUsername)
      toast.success(t('globalActions.usernameUpdated', 'Имя пользователя обновлено'))
    }
    catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.error', 'Ошибка'))
    }
  }

  onBeforeUnmount(() => {
    clearPolling()
  })

  return {
    user,
    isYandexLinked,
    isLinking,
    isUnlinking,
    isUnlinkModalVisible,
    providerToUnlink,
    isUsernamePromptOpen,
    linkYandex,
    openUnlinkModal,
    confirmUnlink,
    updateAvatar,
    updateUsername,
  }
}
