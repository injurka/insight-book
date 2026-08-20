import { computed, ref, watch } from 'vue'
import type { LanguageConfig, Rule, RuleTest, SupportedLanguage } from '../../../shared/types'
import {
  getAvailableLanguages,
  getLanguageConfig,
  loadLanguageRules,
  loadLanguageTests,
} from '../../../shared/data/languages'

const STORAGE_KEY = 'plugin_grammar_selected_lang'
const CUSTOM_TESTS_PREFIX = 'plugin_grammar_custom_tests_'

function getCustomTests(lang: string): RuleTest[] {
  try {
    const raw = localStorage.getItem(`${CUSTOM_TESTS_PREFIX}${lang}`)
    return raw ? JSON.parse(raw) : []
  }
  catch {
    return []
  }
}

function saveCustomTests(lang: string, customTests: RuleTest[]) {
  try {
    localStorage.setItem(`${CUSTOM_TESTS_PREFIX}${lang}`, JSON.stringify(customTests))
  }
  catch (e) {
    console.warn('[Grammar Catalog] Failed to save custom tests', e)
  }
}

export function useGrammarCatalog() {
  const savedLang = (localStorage.getItem(STORAGE_KEY) as SupportedLanguage) || 'en'
  const currentLanguage = ref<SupportedLanguage>(savedLang)

  const availableLanguages = computed(() => getAvailableLanguages())
  const currentConfig = computed<LanguageConfig>(() => getLanguageConfig(currentLanguage.value))

  const rules = ref<Rule[]>(loadLanguageRules(currentLanguage.value))
  const tests = ref<RuleTest[]>([...loadLanguageTests(currentLanguage.value), ...getCustomTests(currentLanguage.value)])
  const isLoading = ref(false)

  const loadData = (lang: SupportedLanguage) => {
    isLoading.value = true
    try {
      rules.value = loadLanguageRules(lang)
      const baseTests = loadLanguageTests(lang)
      const customTests = getCustomTests(lang)
      tests.value = [...baseTests, ...customTests]
    }
    finally {
      isLoading.value = false
    }
  }

  const setLanguage = (lang: SupportedLanguage) => {
    if (currentLanguage.value === lang)
      return
    currentLanguage.value = lang
    localStorage.setItem(STORAGE_KEY, lang)
    loadData(lang)
  }

  const addCustomTests = (newTests: RuleTest[]) => {
    const lang = currentLanguage.value
    const existingCustom = getCustomTests(lang)
    const updatedCustom = [...existingCustom, ...newTests]
    saveCustomTests(lang, updatedCustom)
    tests.value = [...tests.value, ...newTests]
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
    setLanguage,
    addCustomTests,
  }
}
