import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateGrammarTestsViaLlm } from '../../../shared/lib/api'
import type { Rule, RuleTest } from '../../../shared/types'

export function useAiGrammar() {
  const { locale } = useI18n()
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  const generateTestsForRule = async (
    rule: Rule,
    targetLang?: string,
    count = 3,
  ): Promise<RuleTest[] | null> => {
    const lang = targetLang || (locale.value as string) || 'ru'
    isGenerating.value = true
    error.value = null

    try {
      const questions = await generateGrammarTestsViaLlm(rule, lang, count)
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
