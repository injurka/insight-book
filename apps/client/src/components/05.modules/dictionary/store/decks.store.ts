import type { DictDeck } from '~/shared/types/models'
import { useMutation, useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { createOfflineQuery } from '~/shared/lib/query'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { useDictionaryStore } from './dictionary.store'

export const useDecksStore = defineStore('decks', () => {
  const toast = useToast()
  const { trackEvent } = useUmami()
  const queryCache = useQueryCache()
  const authStore = useAuthStore()

  const decks = ref<DictDeck[]>([])

  const {
    data: decksData,
    isLoading: isDecksLoading,
    refetch: refetchDecks,
  } = createOfflineQuery<DictDeck[]>({
    key: ['decks'],
    networkQuery: async () => {
      return await api.dictionary.decks()
    },
    saveOfflineData: async (list) => {
      await offlineService.saveDecks(list)
    },
    getOfflineData: async () => {
      return await offlineService.getDecks()
    },
    enabled: () => !!authStore.user || authStore.isSingleMode,
  })

  watch(decksData, (newDecks) => {
    if (newDecks) {
      decks.value = [...newDecks]
    }
  }, { immediate: true })

  async function fetchDecks() {
    try {
      await refetchDecks()
    }
    catch (e) {
      console.warn('Could not fetch decks:', e)
    }
  }

  const { mutateAsync: createDeckMutation, isLoading: isCreatingDeck } = useMutation({
    mutation: ({ name, language }: { name: string, language: string }) => api.dictionary.createDeck({ name, language }),
    async onSuccess(newDeck, { language }) {
      decks.value.push(newDeck)
      await offlineService.saveDecks(decks.value)
      queryCache.invalidateQueries({ key: ['decks'] })
      queryCache.invalidateQueries({ key: ['dictionary'] })
      toast.success('Колода создана')
      trackEvent('deck_created', { language })
    },
    onError(e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания колоды')
    },
  })

  async function createDeck(name: string, language: string) {
    return await createDeckMutation({ name, language })
  }

  const { mutateAsync: updateDeckMutation, isLoading: isUpdatingDeck } = useMutation({
    mutation: ({ id, name }: { id: number, name: string }) => api.dictionary.updateDeck(id, { name }),
    async onSuccess(_, { id, name }) {
      const deck = decks.value.find(d => d.id === id)
      if (deck)
        deck.name = name
      await offlineService.saveDecks(decks.value)
      queryCache.invalidateQueries({ key: ['decks'] })
      queryCache.invalidateQueries({ key: ['dictionary'] })
      trackEvent('deck_updated', { deckId: id })
      toast.success('Название колоды обновлено')
    },
    onError(e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка обновления колоды')
    },
  })

  async function updateDeck(id: number, name: string) {
    try {
      await updateDeckMutation({ id, name })
    }
    catch {
      // caught
    }
  }

  const { mutateAsync: deleteDeckMutation, isLoading: isDeletingDeck } = useMutation({
    mutation: ({ id, mode }: { id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' }) => api.dictionary.deleteDeck(id, mode),
    async onSuccess(_, { id }) {
      decks.value = decks.value.filter(d => d.id !== id)
      await offlineService.saveDecks(decks.value)

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
        await offlineService.saveDictionary(dictStore.words)
      }

      queryCache.invalidateQueries({ key: ['decks'] })
      queryCache.invalidateQueries({ key: ['dictionary'] })
      toast.success('Колода удалена')
      trackEvent('deck_deleted', { deckId: id })
    },
    onError(e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка удаления колоды')
    },
  })

  async function deleteDeck(id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' = 'keep') {
    try {
      await deleteDeckMutation({ id, mode })
    }
    catch {
      // caught
    }
  }

  const isLoading = computed(() => {
    return isDecksLoading.value
      || isCreatingDeck.value
      || isUpdatingDeck.value
      || isDeletingDeck.value
  })

  return {
    decks,
    isLoading,
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
  }
})
