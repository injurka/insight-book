import { ref } from 'vue'
import { useToast } from '~/01.shared/composables/use-toast'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'

export function useCustomModels() {
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  const availableModels = ref<{ label: string, value: string }[]>([])
  const isFetchingModels = ref(false)

  async function fetchModels() {
    if (!settingsStore.customLlmUrl) {
      toast.warn('Сначала укажите URL API')

      return
    }

    isFetchingModels.value = true
    try {
      const baseUrl = settingsStore.customLlmUrl.replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/models`, {
        headers: settingsStore.customLlmKey
          ? { Authorization: `Bearer ${settingsStore.customLlmKey}` }
          : undefined,
      })

      if (!res.ok)
        throw new Error(`Ошибка HTTP: ${res.status}`)

      const data = await res.json()

      if (data && Array.isArray(data.data)) {
        availableModels.value = data.data.map((modelItem: { id: string }) => ({
          label: modelItem.id,
          value: modelItem.id,
        }))

        if (availableModels.value.length > 0) {
          toast.success('Список моделей успешно загружен')
          if (!availableModels.value.some(modelItem => modelItem.value === settingsStore.customLlmModel))
            settingsStore.customLlmModel = availableModels.value[0].value
        }
        else {
          toast.info('Сервер вернул пустой список')
          availableModels.value = []
        }
      }
      else {
        throw new Error('Неизвестный формат ответа сервера')
      }
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить модели')
      availableModels.value = []
    }
    finally {
      isFetchingModels.value = false
    }
  }

  return {
    availableModels,
    isFetchingModels,
    fetchModels,
  }
}
