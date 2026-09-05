import { isTauri } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { BASE_API_URL } from '~/01.shared/services/api.service'
import { useAuthStore } from '~/01.shared/store/auth.store'

export function useAccountSettings() {
  const authStore = useAuthStore()
  const toast = useToast()
  const { t } = useI18n()

  const user = computed(() => authStore.user)
  const isYandexLinked = computed(() => Boolean(authStore.user?.yandexId || authStore.user?.isYandexLinked))

  const isLinking = ref(false)
  const isUnlinking = ref(false)
  const isUnlinkModalVisible = ref(false)
  const providerToUnlink = ref<string | null>(null)
  const isUsernamePromptOpen = ref(false)

  let pollingInterval: number | undefined

  function clearPolling() {
    if (pollingInterval !== undefined) {
      window.clearInterval(pollingInterval)
      pollingInterval = undefined
    }
  }

  async function linkOAuth(provider: 'yandex') {
    try {
      const token = localStorage.getItem('insight_token') || ''

      if (isTauri()) {
        isLinking.value = true
        const sessionId = uuidv4()
        const url = `${BASE_API_URL}/api/auth/${provider}?session_id=${sessionId}&linkToken=${encodeURIComponent(token)}`

        await openUrl(url)

        clearPolling()
        pollingInterval = window.setInterval(async () => {
          try {
            const fetchImpl = isTauri() ? tauriFetch : fetch
            const res = await fetchImpl(`${BASE_API_URL}/api/auth/status?session_id=${sessionId}`)
            const data = await res.json()

            if (data.status === 'success') {
              clearPolling()
              isLinking.value = false
              toast.success(t('settings.yandexLinkedSuccess', 'Аккаунт Яндекс успешно привязан!'))
              await authStore.checkAuth()
            }
            else if (data.status === 'error') {
              clearPolling()
              isLinking.value = false
              toast.error(data.error || t('settings.linkFailed', 'Не удалось привязать аккаунт'))
            }
          }
          catch {
            // Network polling error - continue polling
          }
        }, 2000)
      }
      else {
        window.location.href = `${BASE_API_URL}/api/auth/${provider}?linkToken=${encodeURIComponent(token)}`
      }
    }
    catch (e: unknown) {
      isLinking.value = false
      toast.error(e instanceof Error ? e.message : t('settings.linkFailed', 'Не удалось привязать аккаунт'))
    }
  }

  function openUnlinkModal(provider: string) {
    providerToUnlink.value = provider
    isUnlinkModalVisible.value = true
  }

  async function confirmUnlink() {
    if (!providerToUnlink.value)
      return

    isUnlinking.value = true
    try {
      await authStore.unlinkProvider(providerToUnlink.value)
      toast.success(t('settings.yandexUnlinkedSuccess', 'Аккаунт Яндекс успешно отвязан'))
      isUnlinkModalVisible.value = false
    }
    catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error', 'Ошибка'))
    }
    finally {
      isUnlinking.value = false
      providerToUnlink.value = null
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
    linkOAuth,
    openUnlinkModal,
    confirmUnlink,
    updateAvatar,
    updateUsername,
  }
}
