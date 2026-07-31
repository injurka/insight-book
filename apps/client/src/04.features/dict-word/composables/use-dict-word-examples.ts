import type { GeneratedWordExamples } from '~/01.shared/types/models'
import { ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { useToast } from '~/01.shared/composables/use-toast'

export function useDictWordExamples() {
  const repos = useRepos()
  const aiData = ref<GeneratedWordExamples | null>(null)
  const isAiLoading = ref(false)
  const toast = useToast()

  async function generateExamples(word: string, language: string) {
    isAiLoading.value = true
    aiData.value = null
    try {
      aiData.value = await repos.dictionary.generateExamples(word, language)
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.global.t('dictionary.errorExamples'))
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
