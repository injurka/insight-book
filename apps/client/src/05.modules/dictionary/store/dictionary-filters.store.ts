import type { UserDictItem } from '~/01.shared/types/models'

import { computed, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { dictionaryWords } from './dictionary-words.state'

export const useDictionaryFiltersStore = defineStore('dictionary-filters', () => {
  const repos = useRepos()
  const toast = useToast()
  const { trackEvent } = useTracking()

  const searchTerm = ref('')
  const selectedLanguage = ref('all')
  const selectedDeckId = ref<(number | 'all' | 'none')[]>(['all'])
  const selectedDifficulty = ref<(string | 'all' | 'none')[]>(['all'])
  const selectedStatus = ref<('all' | '0' | '1' | '2' | '3')[]>(['all'])
  const selectedWordIds = ref<Set<number>>(new Set())

  const availableLanguages = computed<string[]>(() => {
    const langs = new Set<string>(dictionaryWords.value.map(wordItem => wordItem.language))

    return Array.from(langs)
  })

  const filteredWords = computed<UserDictItem[]>(() => {
    let result = dictionaryWords.value

    if (selectedLanguage.value !== 'all')
      result = result.filter(wordItem => wordItem.language === selectedLanguage.value)

    if (!selectedDeckId.value.includes('all') && selectedDeckId.value.length > 0) {
      result = result.filter((wordItem) => {
        if (!wordItem.deckIds || wordItem.deckIds.length === 0)
          return selectedDeckId.value.includes('none')

        return wordItem.deckIds.some((id: number) => selectedDeckId.value.includes(id))
      })
    }

    if (!selectedDifficulty.value.includes('all') && selectedDifficulty.value.length > 0) {
      result = result.filter((wordItem) => {
        return selectedDifficulty.value.some((diffVal) => {
          if (diffVal === 'none')
            return !wordItem.difficulty
          if (diffVal.startsWith('level_')) {
            const targetLevel = Number.parseInt(diffVal.split('_')[1], 10)
            const sys = DIFFICULTY_SYSTEMS[wordItem.language] || DIFFICULTY_SYSTEMS.default
            const diffDef = sys.find(sysItem => sysItem.value === wordItem.difficulty)

            return diffDef && diffDef.level === targetLevel
          }

          return wordItem.difficulty === diffVal
        })
      })
    }

    if (!selectedStatus.value.includes('all') && selectedStatus.value.length > 0)
      result = result.filter(wordItem => selectedStatus.value.includes(String(wordItem.state) as '0' | '1' | '2' | '3'))

    if (searchTerm.value) {
      const lowerTerm = searchTerm.value.toLowerCase()
      result = result.filter(item => matchesSearchTerm(item, lowerTerm))
    }

    return result
  })

  function matchesSearchTerm(item: UserDictItem, lowerTerm: string): boolean {
    const fields = [item.word, item.transcription, item.translation, item.notes, item.tags, item.difficulty]

    return fields.some(field => field && field.toLowerCase().includes(lowerTerm))
  }

  function toggleWordSelection(id: number) {
    const next = new Set(selectedWordIds.value)
    if (next.has(id))
      next.delete(id)
    else
      next.add(id)
    selectedWordIds.value = next
  }

  function clearSelection() {
    if (selectedWordIds.value.size === 0)
      return
    selectedWordIds.value = new Set()
  }

  function selectAllFiltered() {
    selectedWordIds.value = new Set(filteredWords.value.map(wordItem => wordItem.id))
  }

  async function bulkDelete() {
    const ids = Array.from(selectedWordIds.value)
    if (!ids.length)
      return

    try {
      await repos.dictionary.bulkDelete(ids)
      dictionaryWords.value = dictionaryWords.value.filter(wordItem => !ids.includes(wordItem.id))
      clearSelection()
      toast.success(`Удалено ${ids.length} слов`)

      trackEvent('bulk_words_deleted', { count: ids.length })
    }
    catch {
      toast.error('Ошибка удаления')
    }
  }

  async function bulkMoveToDecks(deckIds: number[]) {
    const ids = Array.from(selectedWordIds.value)
    if (!ids.length)
      return

    try {
      await repos.dictionary.bulkMove(ids, deckIds)
      dictionaryWords.value.forEach((wordItem) => {
        if (ids.includes(wordItem.id))
          wordItem.deckIds = [...deckIds]
      })
      clearSelection()
      toast.success(`Перемещено ${ids.length} слов`)

      trackEvent('bulk_words_moved', { count: ids.length })
    }
    catch {
      toast.error('Ошибка перемещения')
    }
  }

  return {
    searchTerm,
    selectedLanguage,
    selectedDeckId,
    selectedDifficulty,
    selectedStatus,
    selectedWordIds,
    availableLanguages,
    filteredWords,
    toggleWordSelection,
    clearSelection,
    selectAllFiltered,
    bulkDelete,
    bulkMoveToDecks,
  }
})
