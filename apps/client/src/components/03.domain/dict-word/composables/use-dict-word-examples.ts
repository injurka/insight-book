import type { GeneratedWordExamples } from '~/shared/types/models'
import { ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'

export function useDictWordExamples() {
  const aiData = ref<GeneratedWordExamples | null>(null)
  const isAiLoading = ref(false)
  const toast = useToast()

  async function generateExamples(word: string, language: string) {
    isAiLoading.value = true
    aiData.value = null
    try {
      aiData.value = await api.dictionary.generateExamples(word, language)
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка генерации примеров (ИИ)')
    }
    finally {
      isAiLoading.value = false
    }
  }

  function clear() {
    aiData.value = null
    isAiLoading.value = false
  }

  return {
    aiData,
    isAiLoading,
    generateExamples,
    clear,
  }
}
