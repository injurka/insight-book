import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnalysisStore } from './analysis.store'

const mocks = vi.hoisted(() => ({
  analysisRepo: {
    getLocalAnalysis: vi.fn(),
    checkCache: vi.fn(),
    analyzeBatch: vi.fn(),
    lookupWord: vi.fn(),
  },
  readerStore: {
    currentBook: {
      id: 1,
      language: 'en',
    },
    currentPage: {
      bookId: 1,
      pageNum: 1,
      type: 'text',
      content: '<span data-raw-sent="First%20sentence."></span><span data-raw-sent="Second%20sentence."></span>',
    },
  },
}))

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({ analysis: mocks.analysisRepo }),
}))

vi.mock('~/05.modules/reader/store/reader.store', () => ({
  useReaderStore: () => mocks.readerStore,
}))

vi.mock('~/05.modules/library/store/library.store', () => ({
  useLibraryStore: () => ({ currentBookInfo: mocks.readerStore.currentBook }),
}))

vi.mock('~/01.shared/composables/use-tracking', () => ({
  useTracking: () => ({ trackEvent: vi.fn() }),
}))

vi.mock('~/00.plugins/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

describe('analysisStore page queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('global-app-language', 'ru')
    mocks.analysisRepo.getLocalAnalysis.mockResolvedValue(null)
    mocks.analysisRepo.checkCache.mockResolvedValue({ results: [] })
  })

  it('finishes page analysis when an LLM batch fails', async () => {
    mocks.analysisRepo.analyzeBatch.mockRejectedValue(new Error('LLM unavailable'))
    const store = useAnalysisStore()

    await store.analyzeWholePage({
      sentences: true,
      words: false,
      ttsSentences: false,
      ttsWords: false,
    }, true)

    await vi.waitFor(() => {
      expect(store.isQueueProcessing).toBe(false)
    })

    expect(store.pageAnalysisSentencesCurrent).toBe(2)
    expect(store.pageAnalysisSentencesTotal).toBe(2)
    expect(store.isAutoPageAnalysisActive).toBe(false)
    expect(store.taskQueue).toHaveLength(0)
  })

  it('opens a standalone word popover before the dictionary request finishes and keeps it closed after dismissal', async () => {
    let resolveLookup!: (result: { transcription: string, translation: string }) => void
    mocks.analysisRepo.lookupWord.mockImplementation(() => new Promise((resolve) => {
      resolveLookup = resolve
    }))
    const store = useAnalysisStore()
    const target = document.createElement('div')

    const lookup = store.lookupStandaloneWord('Her', 'r', target)

    expect(store.wordPopover).toMatchObject({ word: 'Her', isLoading: true, contextBookId: 1 })
    expect(store.wordPopover?.target).toBe(target)
    expect(mocks.analysisRepo.lookupWord).toHaveBeenCalledWith(1, 'Her', expect.any(AbortSignal))

    store.closePopover()
    resolveLookup({ transcription: '', translation: 'её' })
    await lookup

    expect(store.wordPopover).toBeNull()
  })
})
