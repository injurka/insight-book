import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateRuleExplanationViaLlm } from '../../../shared/lib/api'
import type { Rule } from '../../../shared/types'

const EXPLANATION_CACHE_PREFIX = 'plugin_grammar_rule_explanation_'

function getCachedExplanation(ruleId: string): string | null {
  try {
    return localStorage.getItem(`${EXPLANATION_CACHE_PREFIX}${ruleId}`)
  }
  catch {
    return null
  }
}

function setCachedExplanation(ruleId: string, text: string) {
  try {
    localStorage.setItem(`${EXPLANATION_CACHE_PREFIX}${ruleId}`, text)
  }
  catch (e) {
    console.warn('[Rule Details] Failed to cache explanation', e)
  }
}

export function useRuleDetails() {
  const { locale } = useI18n()
  const selectedRule = ref<Rule | null>(null)
  const isModalOpen = ref(false)
  const explanation = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchExplanation = async (rule: Rule, targetLang?: string, forceRefresh = false) => {
    const lang = targetLang || (locale.value as string) || 'ru'

    if (!forceRefresh) {
      const cached = getCachedExplanation(rule.id)
      if (cached) {
        explanation.value = cached
        isLoading.value = false
        error.value = null
        return
      }
    }

    isLoading.value = true
    error.value = null
    explanation.value = ''

    try {
      const generated = await generateRuleExplanationViaLlm(rule, lang)

      if (generated) {
        explanation.value = generated
        setCachedExplanation(rule.id, generated)
      }
      else {
        error.value = 'Failed to generate explanation'
      }
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error generating explanation'
      error.value = msg
      console.warn('[Rule Details] Generation error:', msg)
    }
    finally {
      isLoading.value = false
    }
  }

  const openRuleDetails = (rule: Rule, targetLang?: string) => {
    const lang = targetLang || (locale.value as string) || 'ru'
    selectedRule.value = rule
    isModalOpen.value = true
    fetchExplanation(rule, lang, false)
  }

  const regenerate = (targetLang?: string) => {
    const lang = targetLang || (locale.value as string) || 'ru'
    if (selectedRule.value) {
      fetchExplanation(selectedRule.value, lang, true)
    }
  }

  const closeRuleDetails = () => {
    isModalOpen.value = false
  }

  return {
    selectedRule,
    isModalOpen,
    explanation,
    isLoading,
    error,
    openRuleDetails,
    regenerate,
    closeRuleDetails,
  }
}
