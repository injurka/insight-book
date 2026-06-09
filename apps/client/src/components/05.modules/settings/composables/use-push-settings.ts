import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'
import { usePwaStore } from '~/shared/store/pwa.store'

export function usePushSettings() {
  const pwaStore = usePwaStore()
  const authStore = useAuthStore()
  const dictStore = useDictionaryStore()
  const toast = useToast()
  const { t } = useI18n()

  const pushTimeStartModel = ref(authStore.user?.pushTimeStart || '10:00')
  const pushTimeEndModel = ref(authStore.user?.pushTimeEnd || '21:00')

  onMounted(() => {
    pwaStore.checkPushStatus()
    dictStore.fetchDecks()
  })

  const pushDeckOptions = computed(() => {
    const opts: any[] = [{ label: t('dictionary.allDecks'), value: 'all' }]
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

  const pushTargetDeckModel = computed({
    get: () => authStore.user?.pushTargetDeckId || 'all',
    set: async (val) => {
      try {
        await pwaStore.updatePushSettings({
          deckId: val,
          timeStart: pushTimeStartModel.value,
          timeEnd: pushTimeEndModel.value,
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
      })
      toast.success(t('settings.pushSettingsUpdated'))
    }
    catch {
      toast.error('Ошибка сохранения настроек')
    }
  }

  async function handlePushToggle() {
    try {
      await pwaStore.togglePushSubscription()
      if (pwaStore.isPushSubscribed) {
        toast.success(t('settings.pushEnabled'))
      }
      else {
        toast.info(t('settings.pushDisabled'))
      }
    }
    catch (err: any) {
      toast.error(err.message || t('settings.pushError'))
    }
  }

  return {
    pwaStore,
    pushDeckOptions,
    timeOptions,
    pushTargetDeckModel,
    pushTimeStartModel,
    pushTimeEndModel,
    savePushSettings,
    handlePushToggle,
  }
}
