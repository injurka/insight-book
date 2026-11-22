import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import BookDeckFilterPanel from './book-deck-filter-panel.vue'
import BookDeckGenerationProgress from './book-deck-generation-progress.vue'
import BookDeckWordList from './book-deck-word-list.vue'
import BookDeckWorkspace from './book-deck-workspace.vue'

const mocks = vi.hoisted(() => ({ store: {} }))
vi.mock('../store/book-deck.store', () => ({ useBookDeckStore: () => mocks.store }))
vi.mock('~/01.shared/store/network.store', () => ({ useNetworkStore: () => ({ effectiveOffline: false }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({}), onBeforeRouteLeave: vi.fn() }))

function word(text: string): BookDeckWord {
  return {
    word: text,
    count: 1,
    forms: [],
    properName: false,
    contexts: [],
    source: 'cache',
    content: {
      translation: 'перевод',
      transcription: '/test/',
      tags: 'test',
      difficulty: 'A1',
      grammarNote: 'Grammar',
      vocabularyNote: 'Vocabulary',
    },
  }
}

describe('book deck workflow selection', () => {
  it('limits composition to the previous selection and preserves candidates when toggling or returning from save', async () => {
    const words = [word('cat'), word('bird'), word('dog')]
    const store = reactive({
      draft: {
        id: 'draft',
        bookId: 1,
        name: 'Book',
        language: 'en',
        targetLanguage: 'ru',
        deckId: null,
        words,
      },
      selected: new Set(['cat', 'bird']),
      get selectedWords() { return words.filter(entry => this.selected.has(entry.word)) },
      pending: [],
      state: {
        loading: false,
        running: false,
        saving: false,
        errors: {},
        pause: false,
        done: 0,
        total: 0,
        current: '',
        retryAttempt: 0,
      },
      open: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
    })
    mocks.store = store
    const wrapper = shallowMount(BookDeckWorkspace, {
      props: { bookId: 1 },
      global: { renderStubDefaultSlot: true, stubs: { BookDeckSummary: { template: '<div><slot /><slot name="secondary" /></div>' } } },
    })
    async function click(label: string) {
      const button = wrapper.findAllComponents({ name: 'KitBtn' }).find(entry => entry.text() === `bookDeck.${label}`)
      expect(button).toBeDefined()
      button!.vm.$emit('click')
      await wrapper.vm.$nextTick()
    }
    await click('nextToContent')
    expect(wrapper.getComponent(BookDeckWordList).props('words').map(entry => entry.word)).toEqual(['cat', 'bird'])
    await click('nextToFilters')
    const candidates = () => wrapper.findComponent(BookDeckFilterPanel).props('words').map((entry: BookDeckWord) => entry.word)
    expect(candidates()).toEqual(['cat', 'bird'])
    store.selected.delete('cat')
    await wrapper.vm.$nextTick()
    expect(candidates()).toEqual(['cat', 'bird'])
    await click('nextToSave')
    await click('backToFilters')
    expect(candidates()).toEqual(['cat', 'bird'])
    await click('backToContent')
    await click('nextToFilters')
    expect(candidates()).toEqual(['bird'])
  })

  it('navigates between reachable steps via the top stepper and forwards cancel from generation progress', async () => {
    const missingWord: BookDeckWord = { ...word('cat'), content: null, source: 'missing' }
    const words = [missingWord, word('bird')]
    const store = reactive({
      draft: {
        id: 'draft',
        bookId: 1,
        name: 'Book',
        language: 'en',
        targetLanguage: 'ru',
        deckId: null,
        words,
      },
      selected: new Set(['cat', 'bird']),
      get selectedWords() { return words.filter(entry => this.selected.has(entry.word)) },
      get pending() { return this.selectedWords.filter(entry => !entry.content) },
      state: {
        loading: false,
        running: false,
        saving: false,
        errors: {},
        pause: false,
        done: 1,
        total: 2,
        current: 'cat',
        retryAttempt: 1,
      },
      open: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
    })
    mocks.store = store
    const wrapper = shallowMount(BookDeckWorkspace, {
      props: { bookId: 1 },
      global: { renderStubDefaultSlot: true, stubs: { BookDeckSummary: { template: '<div><slot /><slot name="secondary" /></div>' } } },
    })

    const stepButtons = () => wrapper.findAll('.workflow-steps .step-button')
    expect(stepButtons()).toHaveLength(4)

    await stepButtons()[1]!.trigger('click')
    expect(stepButtons()[1]!.attributes('aria-current')).toBe('step')
    expect(stepButtons()[2]!.attributes('disabled')).toBeDefined()

    const progress = wrapper.getComponent(BookDeckGenerationProgress)
    progress.vm.$emit('cancel')
    expect(store.cancel).toHaveBeenCalledOnce()

    await stepButtons()[0]!.trigger('click')
    expect(stepButtons()[0]!.attributes('aria-current')).toBe('step')
  })
})
