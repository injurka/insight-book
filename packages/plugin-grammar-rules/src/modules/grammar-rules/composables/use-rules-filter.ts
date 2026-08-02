import { ref, computed, type Ref } from 'vue'
import type { Rule } from '~plugin-grammar-rules/shared/types'

export function useRulesFilter(rules: Ref<Rule[]>) {
  const searchQuery = ref('')
  const selectedCategory = ref('all')
  const selectedLevel = ref('all')

  const filteredRules = computed(() => {
    return rules.value.filter(rule => {
      const matchesSearch = 
        rule.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
        rule.description.toLowerCase().includes(searchQuery.value.toLowerCase())
      
      const matchesCategory = selectedCategory.value === 'all' || rule.category === selectedCategory.value
      const matchesLevel = selectedLevel.value === 'all' || rule.hskLevel === selectedLevel.value

      return matchesSearch && matchesCategory && matchesLevel
    })
  })

  return {
    searchQuery,
    selectedCategory,
    selectedLevel,
    filteredRules
  }
}
