import { ref } from 'vue'
import { generateGrammarTestsViaLlm } from '../../../shared/lib/api'
import type { Rule, RuleTest } from '../../../shared/types'

export function useAiGrammar() {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  const generateTestsForRule = async (
    rule: Rule,
    targetLang = 'ru',
    count = 3
  ): Promise<RuleTest[] | null> => {
    isGenerating.value = true
    error.value = null

    try {
      const questions = await generateGrammarTestsViaLlm(rule, targetLang, count)
      return questions
    }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'AI generation failed'
      error.value = message
      console.warn('[AI Grammar Generator]', message)
      return null
    }
    finally {
      isGenerating.value = false
    }
  }

  return {
    isGenerating,
    error,
    generateTestsForRule,
  }
}
