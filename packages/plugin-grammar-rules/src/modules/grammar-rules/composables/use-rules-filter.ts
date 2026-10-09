import type { Ref } from 'vue'
import type { LanguageConfig, Rule } from '../../../shared/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

function matchesSearch(rule: Rule, query: string): boolean {
  if (!query) {
    return true
  }

  return rule.title.toLowerCase().includes(query)
    || rule.description.toLowerCase().includes(query)
    || rule.tags.some(tag => tag.toLowerCase().includes(query))
    || rule.examples.some(ex => ex.sentence.toLowerCase().includes(query) || ex.translation.toLowerCase().includes(query))
}

function matchesSelectedCategory(rule: Rule, category: string): boolean {
  return category === 'all' || rule.category === category
}

function matchesSelectedLevel(rule: Rule, level: string): boolean {
  const ruleLevel = rule.level || rule.hskLevel || 'all'

  return level === 'all' || ruleLevel === level
}

export function useRulesFilter(rules: Ref<Rule[]>, currentConfig?: Ref<LanguageConfig>) {
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
      return currentConfig.value.categories.map(c => ({
        value: c.id,
        label: te(c.titleKey) ? t(c.titleKey) : c.id,
      }))
    }

    return [{ value: 'all', label: t('plugins.grammar-rules.catAll') }]
  })

  const levelOptions = computed(() => {
    if (currentConfig?.value?.levels) {
      return currentConfig.value.levels.map(l => ({
        value: l.id,
        label: l.label,
      }))
    }

    return [{ value: 'all', label: t('plugins.grammar-rules.levelAll') }]
  })

  const filteredRules = computed(() => {
    return rules.value.filter((rule) => {
      const query = searchQuery.value.trim().toLowerCase()

      return matchesSearch(rule, query)
        && matchesSelectedCategory(rule, selectedCategory.value)
        && matchesSelectedLevel(rule, selectedLevel.value)
    })
  })

  return {
    searchQuery,
    selectedCategory,
    selectedLevel,
    categoryOptions,
    levelOptions,
    filteredRules,
  }
}
