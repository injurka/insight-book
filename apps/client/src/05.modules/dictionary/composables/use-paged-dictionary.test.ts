import type { DictionaryPage } from '~/01.shared/types/schemas/dictionary.schema'
import { PiniaColada } from '@pinia/colada'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope } from 'vue'
import { setAuthQueryScope } from '~/01.shared/lib/query-keys'
import { UserDictItemSchema } from '~/01.shared/types/schemas/dictionary.schema'

const mocks = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock('~/00.plugins/di', () => ({ useRepos: () => ({ dictionary: { page: mocks.page } }) }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 1 }, isSingleMode: false }) }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => ({ appLanguage: 'ru' }) }))
vi.mock('../store/dictionary-filters.store', async () => {
  const { reactive } = await import('vue')
  const filters = reactive({
    searchTerm: '',
    selectedLanguage: 'all',
    selectedDeckId: ['all'],
    selectedDifficulty: ['all'],
    selectedStatus: ['all'],
    clearSelection: vi.fn(),
  })

  return { useDictionaryFiltersStore: () => filters }
})

const { usePagedDictionary } = await import('./use-paged-dictionary')
const { useDictionaryFiltersStore } = await import('../store/dictionary-filters.store')
const { dictionaryWords } = await import('../store/dictionary-words.state')
let scope: ReturnType<typeof effectScope>
let app: ReturnType<typeof createApp>

function page(ids: number[], nextOffset: number | null): DictionaryPage {
  return {
    items: ids.map(id => UserDictItemSchema.parse({
      id,
      word: `word-${id}`,
      due: '2026-10-09',
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
    })),
    total: 3,
    totalWords: 3,
    languages: ['en'],
    deckCounts: [],
    nextOffset,
  }
}

beforeEach(() => {
  mocks.page.mockReset()
  dictionaryWords.value = []
  const filters = useDictionaryFiltersStore()
  filters.selectedLanguage = 'all'
  filters.searchTerm = ''
  filters.selectedDeckId = ['all']
  filters.selectedDifficulty = ['all']
  filters.selectedStatus = ['all']
  setAuthQueryScope(`test-${Math.random()}`)
  const pinia = createPinia()
  app = createApp({ render: () => null })
  app.use(pinia).use(PiniaColada)
  setActivePinia(pinia)
  scope = effectScope()
})
afterEach(() => scope.stop())

describe('paged dictionary', () => {
  it('deduplicates initial refresh, appends pages and stops at the end', async () => {
    mocks.page.mockResolvedValueOnce(page([1, 2], 2)).mockResolvedValueOnce(page([3], null))
    const pagination = scope.run(() => usePagedDictionary())!
    await pagination.reload(false)
    await flushPromises()
    expect(mocks.page).toHaveBeenCalledTimes(1)
    expect(dictionaryWords.value.map(word => word.id)).toEqual([1, 2])
    await pagination.loadMore()
    await flushPromises()
    expect(dictionaryWords.value.map(word => word.id)).toEqual([1, 2, 3])
    await pagination.loadMore()
    expect(mocks.page).toHaveBeenCalledTimes(2)
  })

  it('preserves loaded words when the next page fails and retries the same offset', async () => {
    mocks.page.mockResolvedValueOnce(page([1, 2], 2))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(page([3], null))
    const pagination = scope.run(() => usePagedDictionary())!
    await pagination.reload(false)
    await pagination.loadMore()
    expect(pagination.error.value).toBeTruthy()
    expect(dictionaryWords.value.map(word => word.id)).toEqual([1, 2])
    await pagination.retry()
    expect(dictionaryWords.value.map(word => word.id)).toEqual([1, 2, 3])
    expect(mocks.page.mock.calls[1][0].offset).toBe(2)
    expect(mocks.page.mock.calls[2][0].offset).toBe(2)
  })

  it('treats empty multiselects as all values', async () => {
    const filters = useDictionaryFiltersStore()
    filters.selectedDeckId = []
    filters.selectedDifficulty = []
    filters.selectedStatus = []
    mocks.page.mockResolvedValue(page([1, 2, 3], null))
    const pagination = scope.run(() => usePagedDictionary())!
    await pagination.reload(false)
    expect(mocks.page.mock.calls[0][0]).toMatchObject({ decks: 'all', difficulties: 'all', statuses: 'all' })
  })

  it('ignores late responses from the previous filters', async () => {
    let resolveOld!: (result: DictionaryPage) => void
    mocks.page.mockImplementationOnce(() => new Promise<DictionaryPage>((resolve) => {
      resolveOld = resolve
    }))
    mocks.page.mockResolvedValueOnce(page([3], null))
    scope.run(() => usePagedDictionary())!
    await flushPromises()
    useDictionaryFiltersStore().selectedLanguage = 'zh'
    await flushPromises()
    expect(dictionaryWords.value.map(word => word.id)).toEqual([3])
    resolveOld(page([1, 2], 2))
    await flushPromises()
    expect(dictionaryWords.value.map(word => word.id)).toEqual([3])
  })

  it('loads every matching page when selecting all during an in-flight request', async () => {
    let resolveFirst!: (result: DictionaryPage) => void
    mocks.page.mockImplementationOnce(() => new Promise<DictionaryPage>((resolve) => {
      resolveFirst = resolve
    }))
    mocks.page.mockResolvedValueOnce(page([3], null))
    const pagination = scope.run(() => usePagedDictionary())!
    await flushPromises()
    resolveFirst(page([1, 2], 2))
    await flushPromises()
    const loading = pagination.loadMore()
    await pagination.loadAll()
    await loading
    expect(dictionaryWords.value.map(word => word.id)).toEqual([1, 2, 3])
  })
})
