import type { DictionaryPage, DictionaryPageOptions } from '~/01.shared/types/schemas/dictionary.schema'
import { useQuery } from '@pinia/colada'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { queryKeys, scopedQueryKey } from '~/01.shared/lib/query-keys'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useDictionaryFiltersStore } from '../store/dictionary-filters.store'
import { dictionaryWords } from '../store/dictionary-words.state'

export function usePagedDictionary() {
  const repos = useRepos()
  const auth = useAuthStore()
  const settings = useGlobalSettingsStore()
  const filters = useDictionaryFiltersStore()
  const search = refDebounced(computed(() => filters.searchTerm), 300)
  const offset = ref(0)
  const metadata = ref<DictionaryPage | null>(null)
  const options = computed<DictionaryPageOptions>(() => ({
    limit: 50,
    search: search.value,
    language: filters.selectedLanguage,
    decks: filters.selectedDeckId.join(',') || 'all',
    difficulties: filters.selectedDifficulty.join(',') || 'all',
    statuses: filters.selectedStatus.join(',') || 'all',
  }))
  const scope = computed(() => JSON.stringify(scopedQueryKey(queryKeys.dictionary.page(options.value, settings.appLanguage))))
  const key = computed(() => scopedQueryKey(queryKeys.dictionary.page({ ...options.value, offset: offset.value }, settings.appLanguage)))

  watch(scope, () => {
    offset.value = 0
    dictionaryWords.value = []
    metadata.value = null
    filters.clearSelection()
  }, { immediate: true, flush: 'sync' })

  const {
    data,
    isLoading,
    error,
    refresh,
    refetch,
  } = useQuery({
    key: () => key.value,
    enabled: () => !!auth.user || auth.isSingleMode,
    refetchOnWindowFocus: false,
    query: async () => {
      const requestScope = scope.value
      const requestOffset = offset.value
      const page = await repos.dictionary.page({ ...options.value, offset: requestOffset })

      return { page, scope: requestScope, offset: requestOffset }
    },
  })

  watch(data, (result) => {
    if (!result || result.scope !== scope.value || result.offset !== offset.value)
      return

    metadata.value = result.page
    const previous = result.offset === 0 ? [] : dictionaryWords.value
    const merged = new Map(previous.map(word => [word.id, word]))

    for (const word of result.page.items)
      merged.set(word.id, word)

    dictionaryWords.value = [...merged.values()]
  }, { immediate: true, flush: 'sync' })

  async function loadMore() {
    if (error.value || (!isLoading.value && metadata.value?.nextOffset == null))
      return

    if (!isLoading.value && metadata.value?.nextOffset != null)
      offset.value = metadata.value.nextOffset

    await refresh()
  }

  async function reload(force = true) {
    if (force) {
      offset.value = 0
      filters.clearSelection()
    }

    const result = await (force ? refetch() : refresh())

    if (result.error)
      throw result.error
  }

  async function loadAll() {
    const requestScope = scope.value

    while (metadata.value?.nextOffset != null) {
      await loadMore()

      if (requestScope !== scope.value)
        throw new Error('Dictionary filters changed')

      if (error.value)
        throw error.value
    }
  }

  return {
    metadata,
    isLoading,
    error,
    loadMore,
    reload,
    loadAll,
    retry: refetch,
  }
}
