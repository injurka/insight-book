import type { DictDeck } from '~/shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { useRepos } from '~/shared/plugins/di'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { useDictionaryStore } from './dictionary.store'

export const useDecksStore = defineStore('decks', () => {
  const repos = useRepos()
  const toast = useToast()
  const { trackEvent } = useUmami()
  const queryCache = useQueryCache()
  const authStore = useAuthStore()

  const decks = ref<DictDeck[]>([])

  const {
    data: decksData,
    isLoading: isDecksLoading,
    refetch: refetchDecks,
  } = useQuery<DictDeck[]>({
    key: ['decks'],
    query: async () => {
      return await repos.dictionary.getDecks()
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
    mutation: ({ name, language }: { name: string, language: string }) => repos.dictionary.createDeck({ name, language }),
    async onSuccess(newDeck, { language }) {
      decks.value.push(newDeck)
      await repos.dictionary.saveLocalDecks(decks.value)
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
    mutation: ({ id, name }: { id: number, name: string }) => repos.dictionary.updateDeck(id, { name }),
    async onSuccess(_, { id, name }) {
      const deck = decks.value.find(d => d.id === id)
      if (deck)
        deck.name = name
      await repos.dictionary.saveLocalDecks(decks.value)
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
    mutation: ({ id, mode }: { id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' }) => repos.dictionary.deleteDeck(id, mode),
    async onSuccess(_, { id }) {
      decks.value = decks.value.filter(d => d.id !== id)
      await repos.dictionary.saveLocalDecks(decks.value)

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
        await repos.dictionary.saveLocalDictionary(dictStore.words)
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
