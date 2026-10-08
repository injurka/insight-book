import type { WordFormData } from '../../model'
import type { DictDeck } from '~/01.shared/types/models'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AddEditWordDialog from './add-edit-word-dialog.vue'

const mocks = vi.hoisted(() => ({
  analysis: { addEditWordModalOpen: false, wordToEdit: null as WordFormData | null, saveWordToDict: vi.fn() },
  dictionary: { decks: [] as DictDeck[], fetchDecks: vi.fn() },
  settings: { isMobileInterface: false },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('~/00.plugins/di', () => ({ useRepos: () => ({}) }))
vi.mock('~/01.shared/composables/use-toast', () => ({ useToast: () => ({}) }))
vi.mock('~/01.shared/composables/use-tts', () => ({ useTts: () => ({}) }))
vi.mock('~/01.shared/composables/use-haptic', () => ({ useHaptic: () => ({ hapticLight: vi.fn() }) }))
vi.mock('~/01.shared/store/analysis/analysis.store', () => ({ useAnalysisStore: () => reactive(mocks.analysis) }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => reactive(mocks.settings) }))
vi.mock('../../store/dictionary.store', () => ({ useDictionaryStore: () => reactive(mocks.dictionary) }))
vi.mock('~/05.modules/reader/store/reader.store', () => ({ useReaderStore: () => ({ currentBook: { title: ' My Book ' } }) }))
vi.mock('~/05.modules/library/store/library.store', () => ({ useLibraryStore: () => ({ currentBookInfo: null }) }))
vi.mock('@iconify/vue', () => ({ Icon: { template: '<span class="test-icon" />' } }))

function renderDialog() {
  return mount(AddEditWordDialog, {
    global: {
      stubs: {
        KitDialog: { template: '<div><slot /><slot name="footer" /></div>' },
        KitPrompt: true,
        KitTooltip: { template: '<div><slot /></div>' },
        KitSelect: true,
        KitInput: true,
        KitToggle: true,
      },
    },
  })
}

async function openDialog() {
  const analysis = reactive(mocks.analysis)
  analysis.wordToEdit = { word: 'test', language: 'en', deckIds: [7] }
  analysis.addEditWordModalOpen = true
  await flushPromises()
}

function saveDialog(wrapper: ReturnType<typeof renderDialog>) {
  return wrapper.findAll('button').find(button => button.text() === 'library.addBook')!.trigger('click')
}

describe('word dialog book deck defaults', () => {
  beforeEach(() => {
    mocks.analysis.addEditWordModalOpen = false
    mocks.analysis.wordToEdit = null
    mocks.analysis.saveWordToDict.mockReset()
    mocks.dictionary.decks = []
    mocks.dictionary.fetchDecks.mockReset().mockResolvedValue(undefined)
    mocks.settings.isMobileInterface = false
  })

  it('selects the book deck after loading and keeps other decks', async () => {
    mocks.dictionary.fetchDecks.mockImplementation(async () => {
      reactive(mocks.dictionary).decks = [
        { id: 8, name: 'my book', language: 'zh' },
        { id: 9, name: 'MY BOOK', language: 'en' },
      ]
    })
    const wrapper = renderDialog()
    await openDialog()
    await saveDialog(wrapper)
    expect(mocks.analysis.saveWordToDict).toHaveBeenCalledWith(expect.objectContaining({ deckIds: [7, 9] }))

    // A late dictionary lookup replaces the initial form data.
    reactive(mocks.analysis).wordToEdit = { word: 'test', language: 'en', deckIds: [9] }
    await flushPromises()
    await saveDialog(wrapper)
    expect(mocks.analysis.saveWordToDict).toHaveBeenLastCalledWith(expect.objectContaining({ deckIds: [9] }))
    wrapper.unmount()
  })

  it('keeps the selection when the book has no deck', async () => {
    const wrapper = renderDialog()
    await openDialog()
    await saveDialog(wrapper)
    expect(mocks.analysis.saveWordToDict).toHaveBeenCalledWith(expect.objectContaining({ deckIds: [7] }))
    wrapper.unmount()
  })

  it('uses a centered icon-only button on mobile and text on desktop', async () => {
    const wrapper = renderDialog()
    let button = wrapper.get('button[aria-label="dictionary.newDeckName"]')
    expect(button.text()).toBe('dictionary.new')
    expect(button.classes()).not.toContain('kit-btn--icon-only')
    reactive(mocks.settings).isMobileInterface = true
    await flushPromises()
    button = wrapper.get('button[aria-label="dictionary.newDeckName"]')
    expect(button.text()).toBe('')
    expect(button.classes()).toContain('kit-btn--icon-only')
    expect(button.find('.mr-2').exists()).toBe(false)
    await button.trigger('click')
    expect(wrapper.getComponent({ name: 'KitPrompt' }).attributes('visible')).toBe('true')
    wrapper.unmount()
  })
})
