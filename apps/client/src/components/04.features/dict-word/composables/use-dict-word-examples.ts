import type { GeneratedWordExamples } from '~/shared/types/models'
import { ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useRepos } from '~/shared/plugins/di'
import { i18n } from '~/shared/plugins/i18n'

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
