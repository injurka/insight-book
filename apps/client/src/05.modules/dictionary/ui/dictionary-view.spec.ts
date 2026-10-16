import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import DictionaryView from './dictionary-view.vue'

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  dictionary: { searchTerm: '', getWord: vi.fn(), fetchDictionary: vi.fn() },
  replace: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('./partials/dictionary-header.vue', () => ({ default: { name: 'DictionaryHeader', template: '<div />' } }))
vi.mock('./partials/dictionary-list.vue', () => ({ default: { name: 'DictionaryList', template: '<div />' } }))
vi.mock('./dialog/manage-decks-dialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./dialog/bulk-move-dialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./dialog/dictionary-stats-dialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./dialog/dictionary-quiz-dialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./dialog/dictionary-discover-dialog.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../store/dictionary.store', () => ({ useDictionaryStore: () => reactive(mocks.dictionary) }))
vi.mock('~/01.shared/lib/lazy-component', () => ({ lazyComponent: () => ({ template: '<div />' }) }))

function renderView() {
  return shallowMount(DictionaryView, {
    global: {
      stubs: {
        KitHoverRevealBg: true,
        DictionaryHeader: true,
        DictionaryList: true,
        ManageDecksDialog: true,
        BulkMoveDialog: true,
        DictionaryStatsDialog: true,
        DictionaryQuizDialog: true,
        DictionaryDiscoverDialog: true,
      },
    },
  })
}

describe('dictionary notification navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query = { word: 'gift' }
    mocks.dictionary.searchTerm = ''
    mocks.dictionary.fetchDictionary.mockResolvedValue(undefined)
  })

  it('shows matching cards for an ambiguous legacy notification', async () => {
    mocks.dictionary.getWord.mockRejectedValue(Object.assign(new Error('Ambiguous word'), { status: 409 }))
    const wrapper = renderView()
    await flushPromises()
    expect(mocks.dictionary.getWord).toHaveBeenCalledWith('gift', undefined)
    expect(mocks.dictionary.searchTerm).toBe('gift')
    wrapper.unmount()
  })

  it('uses the push language and lets the user select a different matching card', async () => {
    mocks.query = { word: 'gift', language: 'de' }
    mocks.dictionary.getWord.mockResolvedValue({ word: 'gift', language: 'de' })
    const wrapper = renderView()
    await flushPromises()
    expect(mocks.dictionary.getWord).toHaveBeenCalledWith('gift', 'de')
    wrapper.findComponent({ name: 'DictionaryList' }).vm.$emit('openDetails', { word: 'gift', language: 'en' })
    await flushPromises()
    expect(mocks.dictionary.getWord).toHaveBeenLastCalledWith('gift', 'en')
    wrapper.unmount()
  })
})
