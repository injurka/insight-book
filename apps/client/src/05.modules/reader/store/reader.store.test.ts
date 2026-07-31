import type { PagePayload } from '~/01.shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useReaderStore } from './reader.store'

const mocks = vi.hoisted(() => {
  const bookRepo = {
    getPage: vi.fn(),
    getPageDict: vi.fn(),
    getToc: vi.fn(),
    getLocalImage: vi.fn(),
  }

  const libraryStore = {
    currentBookInfo: null as { id: number, currentPage: number } | null,
    books: [] as Array<{ id: number }>,
    updateBookInfo: vi.fn(),
    fetchBooks: vi.fn(),
  }

  const analysisStore = {
    cancelPageAnalysis: vi.fn(),
    closePopover: vi.fn(),
    closeSelectionTooltip: vi.fn(),
    analyzeWholePage: vi.fn(),
    isManualPageAnalysisActive: false,
    isAutoPageAnalysisActive: false,
    sidebarOpen: true,
    analysisHistory: [] as unknown[],
  }

  const toastStore = {
    error: vi.fn(),
  }

  const highlightsStore = {
    clear: vi.fn(),
    fetchHighlights: vi.fn().mockResolvedValue(undefined),
  }

  const trackEvent = vi.fn()

  return {
    bookRepo,
    libraryStore,
    analysisStore,
    toastStore,
    highlightsStore,
    trackEvent,
  }
})

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => ({
    book: mocks.bookRepo,
  }),
}))

vi.mock('~/05.modules/library/store/library.store', () => ({
  useLibraryStore: () => mocks.libraryStore,
}))

vi.mock('~/01.shared/store/analysis/analysis.store', () => ({
  useAnalysisStore: () => mocks.analysisStore,
}))

vi.mock('~/01.shared/store/toast.store', () => ({
  useToastStore: () => mocks.toastStore,
}))

vi.mock('./highlights.store', () => ({
  useHighlightsStore: () => mocks.highlightsStore,
}))

vi.mock('~/01.shared/composables/use-umami', () => ({
  useUmami: () => ({
    trackEvent: mocks.trackEvent,
    identifyUser: vi.fn(),
    trackPageview: vi.fn(),
  }),
}))

vi.mock('~/00.plugins/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('@pinia/colada', () => ({
  useQuery: () => ({
    data: ref([]),
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}))

function makePage(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    bookId: 1,
    pageNum: 3,
    type: 'text',
    content: 'Page content',
    ...overrides,
  } as PagePayload
}

describe('readerStore - loadPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()

    mocks.libraryStore.currentBookInfo = { id: 1, currentPage: 1 }
    mocks.libraryStore.books = []
    mocks.analysisStore.isManualPageAnalysisActive = false
    mocks.analysisStore.isAutoPageAnalysisActive = false
    mocks.analysisStore.sidebarOpen = true
    mocks.analysisStore.analysisHistory = []
    mocks.highlightsStore.fetchHighlights.mockResolvedValue(undefined)

    mocks.bookRepo.getPage.mockResolvedValue(makePage())
    mocks.bookRepo.getPageDict.mockResolvedValue({ word: { translation: 'слово' } })
    mocks.bookRepo.getToc.mockResolvedValue([])
    mocks.bookRepo.getLocalImage.mockResolvedValue(null)
  })

  it('sets isPageLoading to true while loading and false after completion', async () => {
    let resolvePage!: (page: PagePayload) => void
    mocks.bookRepo.getPage.mockReturnValue(new Promise<PagePayload>((resolve) => {
      resolvePage = resolve
    }))

    const store = useReaderStore()
    const loadPromise = store.loadPage(1, 3)

    expect(store.isPageLoading).toBe(true)

    resolvePage(makePage())
    await loadPromise

    expect(store.isPageLoading).toBe(false)
  })

  it('stores the loaded page and page dictionary in state', async () => {
    const store = useReaderStore()
    await store.loadPage(1, 3)

    expect(mocks.bookRepo.getPage).toHaveBeenCalledWith(1, 3)
    expect(mocks.bookRepo.getPageDict).toHaveBeenCalledWith(1, 3)
    expect(store.currentPage).toMatchObject({ bookId: 1, pageNum: 3, content: 'Page content' })
    expect(store.currentPageDictionary).toEqual({ word: { translation: 'слово' } })
  })

  it('updates reading progress and tracks the page_loaded event', async () => {
    const store = useReaderStore()
    await store.loadPage(1, 3)

    expect(mocks.libraryStore.currentBookInfo?.currentPage).toBe(3)
    expect(mocks.trackEvent).toHaveBeenCalledWith('page_loaded', { bookId: 1, pageNum: 3, type: 'text' })
  })

  it('resets previous analysis state before loading', async () => {
    const store = useReaderStore()
    await store.loadPage(1, 3)

    expect(mocks.analysisStore.cancelPageAnalysis).toHaveBeenCalled()
    expect(mocks.analysisStore.closePopover).toHaveBeenCalled()
    expect(mocks.analysisStore.closeSelectionTooltip).toHaveBeenCalled()
    expect(mocks.analysisStore.sidebarOpen).toBe(false)
  })

  it('survives getPageDict failures by falling back to an empty dictionary', async () => {
    mocks.bookRepo.getPageDict.mockRejectedValue(new Error('dict offline'))

    const store = useReaderStore()
    await store.loadPage(1, 3)

    expect(store.currentPage).not.toBeNull()
    expect(store.currentPageDictionary).toEqual({})
    expect(mocks.toastStore.error).not.toHaveBeenCalled()
  })

  it('starts background auto analysis after 1s when autoAnalyzePage is enabled', async () => {
    vi.useFakeTimers()
    try {
      const settingsStore = useGlobalSettingsStore()
      settingsStore.autoAnalyzePage = true
      settingsStore.autoAnalyzeSentences = true
      settingsStore.autoAnalyzeWords = false
      settingsStore.autoAnalyzeTtsSentences = true
      settingsStore.autoAnalyzeTtsWords = false

      const store = useReaderStore()
      await store.loadPage(1, 3)

      // Enabling autoAnalyzePage also triggers the store watcher
      // (in previous stores too, since useLocalStorage syncs the refs),
      // so we isolate the loadPage-driven setTimeout window here.
      mocks.analysisStore.analyzeWholePage.mockClear()

      await vi.advanceTimersByTimeAsync(1000)

      expect(mocks.analysisStore.analyzeWholePage).toHaveBeenCalledTimes(1)
      expect(mocks.analysisStore.analyzeWholePage).toHaveBeenCalledWith({
        sentences: true,
        words: false,
        ttsSentences: true,
        ttsWords: false,
      }, true)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('does not start auto analysis when autoAnalyzePage is disabled', async () => {
    vi.useFakeTimers()
    try {
      const settingsStore = useGlobalSettingsStore()
      settingsStore.autoAnalyzePage = false

      const store = useReaderStore()
      await store.loadPage(1, 3)

      mocks.analysisStore.analyzeWholePage.mockClear()

      await vi.advanceTimersByTimeAsync(2000)

      expect(mocks.analysisStore.analyzeWholePage).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('does not start auto analysis while a manual page analysis is active', async () => {
    vi.useFakeTimers()
    try {
      const settingsStore = useGlobalSettingsStore()
      settingsStore.autoAnalyzePage = true
      mocks.analysisStore.isManualPageAnalysisActive = true

      const store = useReaderStore()
      await store.loadPage(1, 3)

      mocks.analysisStore.analyzeWholePage.mockClear()

      await vi.advanceTimersByTimeAsync(2000)

      expect(mocks.analysisStore.analyzeWholePage).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('shows a toast, restores previous progress and rethrows when the page is missing', async () => {
    mocks.bookRepo.getPage.mockResolvedValue(null)

    const store = useReaderStore()

    await expect(store.loadPage(1, 5)).rejects.toThrow('Page not found')

    expect(store.isPageLoading).toBe(false)
    expect(store.currentPage).toBeNull()
    expect(mocks.toastStore.error).toHaveBeenCalledWith('dictionary.pageOfflineError')
    expect(mocks.libraryStore.currentBookInfo?.currentPage).toBe(1)
    expect(mocks.analysisStore.analyzeWholePage).not.toHaveBeenCalled()
  })
})
