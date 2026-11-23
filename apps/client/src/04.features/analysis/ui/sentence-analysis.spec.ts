import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SentenceAnalysis from './sentence-analysis.vue'

const sentence = 'As far as I could tell, anyone who was indoors when it happened died instantly.'
const mocks = vi.hoisted(() => ({
  analysis: {
    sidebarSentence: '',
    sidebarOpen: true,
    sidebarAnalysis: { translation: 'Перевод' },
    isAnalyzing: false,
  },
  highlights: [] as { id: number, bookId: number, text: string }[],
  deleteHighlight: vi.fn(),
  getWidgets: vi.fn(),
  book: { id: 1, language: 'en' },
  locale: { value: 'ru' },
}))

vi.mock('~/00.plugins/plugin-manager', () => ({ pluginManager: { getWidgets: mocks.getWidgets } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale: mocks.locale, t: (key: string) => key }) }))
vi.mock('~/01.shared/store/analysis/analysis.store', () => ({ useAnalysisStore: () => mocks.analysis }))
vi.mock('~/01.shared/store/network.store', () => ({ useNetworkStore: () => ({ effectiveOffline: false }) }))
vi.mock('~/01.shared/composables/use-toast', () => ({ useToast: () => ({ warn: vi.fn() }) }))
vi.mock('~/01.shared/composables/use-tts', () => ({
  useTts: () => ({ speak: vi.fn(), stop: vi.fn(), isPlaying: false, isLoading: false }),
}))
vi.mock('~/05.modules/reader', () => ({
  useReaderStore: () => ({ currentBook: mocks.book }),
  useHighlightsStore: () => ({ highlights: mocks.highlights, deleteHighlight: mocks.deleteHighlight }),
}))
vi.mock('~/05.modules/library', () => ({ useLibraryStore: () => ({ currentBookInfo: null }) }))
vi.mock('@iconify/vue', () => ({ Icon: { template: '<span />' } }))
vi.mock('~/04.features/quote-modal', () => ({ QuoteModal: { name: 'QuoteModal', template: '<div />', props: ['visible'] } }))

function renderAnalysis(props: Record<string, unknown> = {}) {
  return mount(SentenceAnalysis, {
    props,
    global: {
      stubs: {
        Icon: true,
        KitDialog: { template: '<div><slot /></div>' },
        KitTooltip: { template: '<div><slot /></div>' },
        KitSkeleton: true,
      },
    },
  })
}

describe('sentence analysis saved quote', () => {
  beforeEach(() => {
    mocks.analysis.sidebarSentence = sentence
    mocks.highlights.length = 0
    mocks.deleteHighlight.mockReset()
    mocks.getWidgets.mockReturnValue([])
    mocks.book.language = 'en'
  })

  it.each(['As far as', `${sentence} Another sentence.`])('does not match a different quote: %s', async (text) => {
    mocks.highlights.push({ id: 10, bookId: 1, text })
    const wrapper = renderAnalysis()
    const bookmark = wrapper.findAll('.sentence-actions button')[1]!

    expect(bookmark.classes()).not.toContain('is-saved')
    await bookmark.trigger('click')
    expect(mocks.deleteHighlight).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'QuoteModal' }).props('visible')).toBe(true)
    wrapper.unmount()
  })

  it('matches the whole sentence even when a fragment appears first', async () => {
    mocks.highlights.push({ id: 10, bookId: 1, text: 'As far as' }, { id: 11, bookId: 1, text: ` ${sentence} ` })
    const wrapper = renderAnalysis()
    const bookmark = wrapper.findAll('.sentence-actions button')[1]!

    expect(bookmark.classes()).toContain('is-saved')
    await bookmark.trigger('click')
    expect(mocks.deleteHighlight).toHaveBeenCalledExactlyOnceWith(11)
    wrapper.unmount()
  })

  it('does not match the same sentence from another book', () => {
    mocks.highlights.push({ id: 12, bookId: 2, text: sentence })
    const wrapper = renderAnalysis()

    expect(wrapper.findAll('.sentence-actions button')[1]!.classes()).not.toContain('is-saved')
    wrapper.unmount()
  })

  it('hides quote action button when hideQuoteActions is true', () => {
    const wrapper = renderAnalysis({ hideQuoteActions: true })

    expect(wrapper.findAll('.sentence-actions button')).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'QuoteModal' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides quote action button when hideDictionaryActions is true in props or store', () => {
    mocks.analysis.hideDictionaryActions = true
    const wrapper = renderAnalysis()

    expect(wrapper.findAll('.sentence-actions button')).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'QuoteModal' }).exists()).toBe(false)
    wrapper.unmount()
    mocks.analysis.hideDictionaryActions = false
  })
})

describe('reader analysis plugins', () => {
  it.each([
    ['zh-CN', 'ru', true, true],
    ['zh-CN', 'ru', false, false],
    ['en', 'ru', true, false],
    ['ru', 'en', true, true],
    ['ru', 'zh', true, true],
    ['ru', 'ru', true, false],
    ['ru', 'en', false, false],
  ])('matches book language %s, interface %s and plugin state %s', (
    language,
    locale,
    enabled,
    shown,
  ) => {
    mocks.book.language = language
    mocks.locale.value = locale
    mocks.analysis.sidebarSentence = language === 'ru' ? 'Все иногда ошибаются.' : '没关系，谁都有犯错的时候。'
    mocks.getWidgets.mockReturnValue(enabled
      ? [{
          id: 'analyzer-action',
          props: language === 'ru' ? { bookLanguage: 'ru', interfaceLanguages: ['en', 'zh'] } : { bookLanguage: 'zh' },
          component: { props: ['sentence'], template: '<button data-test="lab-action">{{ sentence }}</button>' },
        }]
      : [])
    const wrapper = renderAnalysis()
    const action = wrapper.find('[data-test="lab-action"]')

    expect(action.exists()).toBe(shown)

    if (shown)
      expect(action.text()).toBe(mocks.analysis.sidebarSentence)

    wrapper.unmount()
  })
})
