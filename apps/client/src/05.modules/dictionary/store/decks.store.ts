import type { DictDeck } from '~/01.shared/types/models'
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'

import { computed, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useUmami } from '~/01.shared/composables/use-umami'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'
import { dictionaryWords } from './dictionary-words.state'

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
    key: queryKeys.decks.all,
    query: async () => {
      return repos.dictionary.getDecks()
    },
    enabled: () => !!authStore.user || authStore.isSingleMode,
  })

  watch(decksData, (newDecks) => {
    if (newDecks)
      decks.value = [...newDecks]
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
    mutation: async ({ name, language }: { name: string, language: string }) => repos.dictionary.createDeck({ name, language }),
    async onSuccess(newDeck, { language }) {
      decks.value.push(newDeck)
      await repos.dictionary.saveLocalDecks(decks.value)
      queryCache.invalidateQueries({ key: queryKeys.decks.all })
      queryCache.invalidateQueries({ key: queryKeys.dictionary.all })
      toast.success('Колода создана')
      trackEvent('deck_created', { language })
    },
    onError(e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка создания колоды')
    },
  })

  async function createDeck(name: string, language: string) {
    return createDeckMutation({ name, language })
  }

  const { mutateAsync: updateDeckMutation, isLoading: isUpdatingDeck } = useMutation({
    mutation: async ({ id, name }: { id: number, name: string }) => repos.dictionary.updateDeck(id, { name }),
    async onSuccess(_, { id, name }) {
      const deck = decks.value.find(d => d.id === id)
      if (deck)
        deck.name = name
      await repos.dictionary.saveLocalDecks(decks.value)
      queryCache.invalidateQueries({ key: queryKeys.decks.all })
      queryCache.invalidateQueries({ key: queryKeys.dictionary.all })
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
    mutation: async ({ id, mode }: { id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive' }) => repos.dictionary.deleteDeck(id, mode),
    async onSuccess(_, { id }) {
      decks.value = decks.value.filter(d => d.id !== id)
      await repos.dictionary.saveLocalDecks(decks.value)

      const filtersStore = useDictionaryFiltersStore()
      if (filtersStore.selectedDeckId.includes(id)) {
        filtersStore.selectedDeckId = filtersStore.selectedDeckId.filter(d => d !== id)
        if (filtersStore.selectedDeckId.length === 0)
          filtersStore.selectedDeckId = ['all']
      }

      dictionaryWords.value.forEach((w) => {
        if (w.deckIds && w.deckIds.includes(id)) {
          w.deckIds = w.deckIds.filter(deckId => deckId !== id)
        }
      })
      await repos.dictionary.saveLocalDictionary(dictionaryWords.value)

      queryCache.invalidateQueries({ key: queryKeys.decks.all })
      queryCache.invalidateQueries({ key: queryKeys.dictionary.all })
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
