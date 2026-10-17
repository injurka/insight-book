import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouteNames } from '~/01.shared/constants/routes'
import ManageDecksDialog from './manage-decks-dialog.vue'

const mocks = vi.hoisted(() => ({ push: vi.fn(), error: vi.fn(), fetchBooks: vi.fn(), fetchDecks: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('~/01.shared/composables/use-toast', () => ({ useToast: () => ({ error: mocks.error }) }))
vi.mock('~/01.shared/store/auth.store', () => ({ useAuthStore: () => ({ user: { id: 1 }, isSingleMode: false }) }))
vi.mock('~/01.shared/store/network.store', () => ({ useNetworkStore: () => ({ effectiveOffline: false }) }))
vi.mock('~/05.modules/dictionary/composables/use-dict-filter-options', () => ({ useDictFilterOptions: () => ({ newDeckLangOptions: [] }) }))
vi.mock('~/05.modules/dictionary/store/dictionary.store', () => ({ useDictionaryStore: () => ({ decks: [], deckCounts: [], fetchDecks: mocks.fetchDecks }) }))
vi.mock('~/05.modules/library/store/library.store', () => ({
  useLibraryStore: () => ({
    books: [{
      id: 12,
      title: 'Book',
      language: 'en',
      type: 'book',
      totalPages: 100,
    }],
    fetchBooks: mocks.fetchBooks,
  }),
}))

async function openBookPicker() {
  const wrapper = shallowMount(ManageDecksDialog, {
    props: { visible: true },
    global: { stubs: { KitDialog: { template: '<div><slot /></div>' } } },
  })
  wrapper.findComponent({ name: 'KitViewSwitcher' }).vm.$emit('update:modelValue', 'books')
  await flushPromises()

  return wrapper
}

beforeEach(() => vi.resetAllMocks())

describe('book deck navigation from deck manager', () => {
  it('keeps the dialog open until navigation completes so history.back cannot race with the new route', async () => {
    let finishNavigation: (() => void) | undefined
    mocks.push.mockReturnValue(new Promise<void>((resolve) => {
      finishNavigation = resolve
    }))
    const wrapper = await openBookPicker()
    await wrapper.find('button.book-choice').trigger('click')
    expect(mocks.push).toHaveBeenCalledWith({ name: AppRouteNames.BookDeck, params: { bookId: 12 } })
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(wrapper.find('button.book-choice').attributes('disabled')).toBeDefined()
    finishNavigation?.()
    await flushPromises()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('keeps the book picker open when a route guard cancels navigation', async () => {
    mocks.push.mockResolvedValue(new Error('Navigation aborted'))
    const wrapper = await openBookPicker()
    await wrapper.find('button.book-choice').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(wrapper.find('button.book-choice').attributes('disabled')).toBeUndefined()
  })

  it('shows an error and allows retry if loading the target page fails', async () => {
    mocks.push.mockRejectedValue(new Error('Chunk loading failed'))
    const wrapper = await openBookPicker()
    await wrapper.find('button.book-choice').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(mocks.error).toHaveBeenCalledWith('dictionary.bookDeckNavigationError')
    expect(wrapper.find('button.book-choice').attributes('disabled')).toBeUndefined()
  })
})
