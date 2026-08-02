import type { SelectOption } from '~/01.shared/types/models'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { usePwaStore } from '~/01.shared/store/pwa.store'
import { useDictionaryStore } from '~/05.modules/dictionary/store/dictionary.store'

export function usePushSettings(): {
  pwaStore: ReturnType<typeof usePwaStore>
  pushDeckOptions: import('vue').ComputedRef<SelectOption[]>
  timeOptions: import('vue').ComputedRef<SelectOption[]>
  countOptions: import('vue').ComputedRef<{ label: string, value: number }[]>
  pushTargetDeckModel: import('vue').WritableComputedRef<string | number>
  pushTimeStartModel: import('vue').Ref<string>
  pushTimeEndModel: import('vue').Ref<string>
  pushCountModel: import('vue').Ref<number>
  savePushSettings: () => Promise<void>
  handlePushToggle: () => Promise<void>
  isPushLoading: import('vue').Ref<boolean>
} {
  const pwaStore = usePwaStore()
  const authStore = useAuthStore()
  const dictStore = useDictionaryStore()
  const toast = useToast()
  const { t } = useI18n()

  const pushTimeStartModel = ref(authStore.user?.pushTimeStart || '10:00')
  const pushTimeEndModel = ref(authStore.user?.pushTimeEnd || '21:00')
  const pushCountModel = ref(authStore.user?.pushCount || 1)

  const isPushLoading = ref(false)

  onMounted(() => {
    pwaStore.checkPushStatus()
    dictStore.fetchDecks()
  })

  const pushDeckOptions = computed(() => {
    const opts: SelectOption[] = [{ label: t('dictionary.allDecks'), value: 'all' }]
    dictStore.decks.forEach((d) => {
      opts.push({ label: d.name, value: d.id })
    })

    return opts
  })

  const timeOptions = computed(() => {
    const opts = []
    for (let h = 0; h < 24; h++) {
      const hourStr = h.toString().padStart(2, '0')
      opts.push({ label: `${hourStr}:00`, value: `${hourStr}:00` })
      opts.push({ label: `${hourStr}:30`, value: `${hourStr}:30` })
    }

    return opts
  })

  const countOptions = computed(() => {
    return [
      { label: `1 ${t('settings.timesPerDay1')}`, value: 1 },
      { label: `2 ${t('settings.timesPerDay2')}`, value: 2 },
      { label: `3 ${t('settings.timesPerDay2')}`, value: 3 },
      { label: `5 ${t('settings.timesPerDay5')}`, value: 5 },
      { label: `10 ${t('settings.timesPerDay5')}`, value: 10 },
    ]
  })

  const pushTargetDeckModel = computed({
    get: () => authStore.user?.pushTargetDeckId || 'all',
    set: async (val) => {
      try {
        await pwaStore.updatePushSettings({
          deckId: val,
          timeStart: pushTimeStartModel.value,
          timeEnd: pushTimeEndModel.value,
          pushCount: pushCountModel.value,
        })
        toast.success(t('settings.pushSettingsUpdated'))
      }
      catch {
        toast.error('Ошибка сохранения настроек')
      }
    },
  })

  async function savePushSettings() {
    try {
      await pwaStore.updatePushSettings({
        deckId: pushTargetDeckModel.value,
        timeStart: pushTimeStartModel.value,
        timeEnd: pushTimeEndModel.value,
        pushCount: pushCountModel.value,
      })
      toast.success(t('settings.pushSettingsUpdated'))
    }
    catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  async function handlePushToggle() {
    if (isPushLoading.value)
      return

    isPushLoading.value = true

    try {
      await pwaStore.togglePushSubscription()
    }
    catch (err) {
      console.warn('[Push Service] Toggle error:', err)
    }
    finally {
      isPushLoading.value = false
    }
  }

  return {
    pwaStore,
    pushDeckOptions,
    timeOptions,
    countOptions,
    pushTargetDeckModel,
    pushTimeStartModel,
    pushTimeEndModel,
    pushCountModel,
    savePushSettings,
    handlePushToggle,
    isPushLoading,
  }
}
