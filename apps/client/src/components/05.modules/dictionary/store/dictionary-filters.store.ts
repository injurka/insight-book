import type { UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { useDictionaryStore } from './dictionary.store'

export const useDictionaryFiltersStore = defineStore('dictionary-filters', () => {
  const toast = useToast()
  const { trackEvent } = useUmami()

  const searchTerm = ref('')
  const selectedLanguage = ref('all')
  const selectedDeckId = ref<(number | 'all' | 'none')[]>(['all'])
  const selectedDifficulty = ref<(string | 'all' | 'none')[]>(['all'])
  const selectedStatus = ref<('all' | '0' | '1' | '2' | '3')[]>(['all'])
  const selectedWordIds = ref<Set<number>>(new Set())

  const availableLanguages = computed<string[]>(() => {
    const dictStore = useDictionaryStore() as any
    const langs = new Set<string>((dictStore.words || []).map((w: any) => w.language))
    return Array.from(langs)
  })

  const filteredWords = computed<UserDictItem[]>(() => {
    const dictStore = useDictionaryStore() as any
    let result = (dictStore.words || []) as UserDictItem[]

    if (selectedLanguage.value !== 'all') {
      result = result.filter(w => w.language === selectedLanguage.value)
    }

    if (!selectedDeckId.value.includes('all') && selectedDeckId.value.length > 0) {
      result = result.filter((w) => {
        if (!w.deckIds || w.deckIds.length === 0)
          return selectedDeckId.value.includes('none')
        return w.deckIds.some((id: number) => selectedDeckId.value.includes(id))
      })
    }

    if (!selectedDifficulty.value.includes('all') && selectedDifficulty.value.length > 0) {
      result = result.filter((w) => {
        return selectedDifficulty.value.some((d) => {
          if (d === 'none')
            return !w.difficulty
          if (d.startsWith('level_')) {
            const targetLevel = Number.parseInt(d.split('_')[1], 10)
            const sys = DIFFICULTY_SYSTEMS[w.language] || DIFFICULTY_SYSTEMS.default
            const diffDef = sys.find(s => s.value === w.difficulty)
            return diffDef && diffDef.level === targetLevel
          }
          return w.difficulty === d
        })
      })
    }

    if (!selectedStatus.value.includes('all') && selectedStatus.value.length > 0) {
      result = result.filter(w => selectedStatus.value.includes(String(w.state) as '0' | '1' | '2' | '3'))
    }

    if (searchTerm.value) {
      const lowerTerm = searchTerm.value.toLowerCase()
      result = result.filter(item =>
        item.word.toLowerCase().includes(lowerTerm)
        || item.transcription?.toLowerCase().includes(lowerTerm)
        || item.translation?.toLowerCase().includes(lowerTerm)
        || item.notes?.toLowerCase().includes(lowerTerm)
        || item.tags?.toLowerCase().includes(lowerTerm)
        || item.difficulty?.toLowerCase().includes(lowerTerm),
      )
    }
    return result
  })

  function toggleWordSelection(id: number) {
    if (selectedWordIds.value.has(id))
      selectedWordIds.value.delete(id)
    else selectedWordIds.value.add(id)
  }

  function clearSelection() {
    selectedWordIds.value.clear()
  }

  function selectAllFiltered() {
    filteredWords.value.forEach(w => selectedWordIds.value.add(w.id))
  }

  async function bulkDelete() {
    const ids = Array.from(selectedWordIds.value)
    if (!ids.length)
      return

    try {
      await api.dictionary.bulkDelete(ids)
      const dictStore = useDictionaryStore() as any
      dictStore.words = (dictStore.words || []).filter((w: any) => !ids.includes(w.id))
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
      await api.dictionary.bulkMove(ids, deckIds)
      const dictStore = useDictionaryStore() as any
      if (dictStore.words) {
        dictStore.words.forEach((w: any) => {
          if (ids.includes(w.id))
            w.deckIds = [...deckIds]
        })
      }
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
