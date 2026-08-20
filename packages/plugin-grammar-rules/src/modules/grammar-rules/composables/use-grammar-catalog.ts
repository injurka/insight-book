import { ref, computed, watch } from 'vue'
import type { LanguageConfig, Rule, RuleTest, SupportedLanguage } from '~plugin-grammar-rules/shared/types'
import {
  getAvailableLanguages,
  getLanguageConfig,
  loadLanguageRules,
  loadLanguageTests
} from '~plugin-grammar-rules/shared/data/languages'

const STORAGE_KEY = 'plugin_grammar_selected_lang'

export function useGrammarCatalog() {
  const savedLang = (localStorage.getItem(STORAGE_KEY) as SupportedLanguage) || 'en'
  const currentLanguage = ref<SupportedLanguage>(savedLang)

  const availableLanguages = computed(() => getAvailableLanguages())
  const currentConfig = computed<LanguageConfig>(() => getLanguageConfig(currentLanguage.value))

  const rules = ref<Rule[]>(loadLanguageRules(currentLanguage.value))
  const tests = ref<RuleTest[]>(loadLanguageTests(currentLanguage.value))
  const isLoading = ref(false)

  const setLanguage = (lang: SupportedLanguage) => {
    if (currentLanguage.value === lang) return
    currentLanguage.value = lang
    localStorage.setItem(STORAGE_KEY, lang)
    loadData(lang)
  }

  const loadData = (lang: SupportedLanguage) => {
    isLoading.value = true
    try {
      rules.value = loadLanguageRules(lang)
      tests.value = loadLanguageTests(lang)
    } finally {
      isLoading.value = false
    }
  }

  watch(currentLanguage, (newLang) => {
    loadData(newLang)
  })

  return {
    currentLanguage,
    availableLanguages,
    currentConfig,
    rules,
    tests,
    isLoading,
    setLanguage
  }
}
