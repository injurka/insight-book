import { computed, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LanguageConfig, Rule } from '../../../shared/types'

export function useRulesFilter(
  rules: Ref<Rule[]>,
  currentConfig?: Ref<LanguageConfig>
) {
  const { t, te } = useI18n()
  const searchQuery = ref('')
  const selectedCategory = ref('all')
  const selectedLevel = ref('all')

  // Reset filters if language changes
  if (currentConfig) {
    watch(currentConfig, () => {
      selectedCategory.value = 'all'
      selectedLevel.value = 'all'
    })
  }

  const categoryOptions = computed(() => {
    if (currentConfig?.value?.categories) {
      return currentConfig.value.categories.map((c) => ({
        value: c.id,
        label: te(c.titleKey) ? t(c.titleKey) : c.id
      }))
    }
    return [{ value: 'all', label: t('plugins.grammar-rules.catAll') }]
  })

  const levelOptions = computed(() => {
    if (currentConfig?.value?.levels) {
      return currentConfig.value.levels.map((l) => ({
        value: l.id,
        label: l.label
      }))
    }
    return [{ value: 'all', label: t('plugins.grammar-rules.levelAll') }]
  })

  const filteredRules = computed(() => {
    return rules.value.filter((rule) => {
      const q = searchQuery.value.trim().toLowerCase()
      const matchesSearch =
        !q ||
        rule.title.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q) ||
        rule.tags.some(tag => tag.toLowerCase().includes(q)) ||
        rule.examples.some(ex => ex.sentence.toLowerCase().includes(q) || ex.translation.toLowerCase().includes(q))

      const matchesCategory =
        selectedCategory.value === 'all' || rule.category === selectedCategory.value

      const ruleLevel = rule.level || rule.hskLevel || 'all'
      const matchesLevel =
        selectedLevel.value === 'all' || ruleLevel === selectedLevel.value

      return matchesSearch && matchesCategory && matchesLevel
    })
  })

  return {
    searchQuery,
    selectedCategory,
    selectedLevel,
    categoryOptions,
    levelOptions,
    filteredRules
  }
}
