import type { DictDeck } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { api } from '~/shared/services/api.service'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { useDictionaryStore } from './dictionary.store'

export const useDecksStore = defineStore('decks', () => {
  const toast = useToast()
  const { trackEvent } = useUmami()

  const decks = ref<DictDeck[]>([])

  async function fetchDecks() {
    try {
      decks.value = await api.dictionary.decks()
    }
    catch (e) {
      console.warn('Could not fetch decks:', e)
    }
  }

  async function createDeck(name: string, language: string) {
    try {
      const newDeck = await api.dictionary.createDeck({ name, language })
      decks.value.push(newDeck)
      toast.success('Колода создана')

      trackEvent('deck_created', { language })

      return newDeck
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания колоды')
      throw e
    }
  }

  async function updateDeck(id: number, name: string) {
    try {
      await api.dictionary.updateDeck(id, { name })
      const deck = decks.value.find(d => d.id === id)

      if (deck)
        deck.name = name

      trackEvent('deck_updated', { deckId: id })

      toast.success('Название колоды обновлено')
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка обновления колоды')
    }
  }

  async function deleteDeck(id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') {
    try {
      await api.dictionary.deleteDeck(id, mode)
      decks.value = decks.value.filter(d => d.id !== id)

      const filtersStore = useDictionaryFiltersStore()
      if (filtersStore.selectedDeckId.includes(id)) {
        filtersStore.selectedDeckId = filtersStore.selectedDeckId.filter(d => d !== id)
        if (filtersStore.selectedDeckId.length === 0)
          filtersStore.selectedDeckId = ['all']
      }

      const dictStore = useDictionaryStore() as any
      if (dictStore.words) {
        dictStore.words.forEach((w: any) => {
          if (w.deckId === id)
            w.deckId = null
        })
      }

      toast.success('Колода удалена')

      trackEvent('deck_deleted', { deckId: id })
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления колоды')
    }
  }

  return {
    decks,
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
  }
})
