import type { Book, PagePayload } from '~/01.shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'

import { cancelSync, startWholeBookSync, syncProgress, syncState } from './book-sync.service'

const hoisted = vi.hoisted(() => {
  const bookRepo = {
    getToc: vi.fn(),
    saveLocalToc: vi.fn(),
    getLocalCover: vi.fn(),
    fetchImageBlob: vi.fn(),
    saveLocalCover: vi.fn(),
    getPage: vi.fn(),
    getLocalImage: vi.fn(),
    saveLocalImage: vi.fn(),
    getPageDict: vi.fn(),
  }
  const analysisRepo = {
    getLocalAnalysis: vi.fn(),
    checkCache: vi.fn(),
    analyzeBatch: vi.fn(),
    saveLocalAnalysis: vi.fn(),
    getLocalTts: vi.fn(),
    generateTts: vi.fn(),
    saveLocalTts: vi.fn(),
  }

  return {
    bookRepo,
    analysisRepo,
    repos: { book: bookRepo, analysis: analysisRepo },
    trackEvent: vi.fn(),
    libraryState: {
      books: [] as Book[],
      currentBookInfo: null as Book | null,
    },
  }
})

vi.mock('~/00.plugins/di', () => ({
  useRepos: () => hoisted.repos,
}))

vi.mock('~/01.shared/composables/use-umami', () => ({
  useUmami: () => ({
    trackEvent: hoisted.trackEvent,
    identifyUser: vi.fn(),
    trackPageview: vi.fn(),
  }),
}))

vi.mock('../store/library.store', () => ({
  useLibraryStore: () => hoisted.libraryState,
}))

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: 'Test Book',
    author: null,
    coverUrl: 'https://cdn.example.com/cover.jpg',
    filePath: '/books/test.epub',
    language: 'en',
    totalPages: 10,
    currentPage: null,
    createdAt: '2024-01-01',
    ...overrides,
  }
}

function makeTextPage(pageNum: number, sentences: string[] = [], words: string[] = []): PagePayload {
  const sentHtml = sentences
    .map(s => `<span data-raw-sent="${encodeURIComponent(s)}">${s}</span>`)
    .join('')
  const wordHtml = words
    .map(w => `<span data-word="${encodeURIComponent(w)}" data-pos="noun">${w}</span>`)
    .join('')

  return {
    bookId: 1,
    pageNum,
    totalPages: 10,
    content: `<p>${sentHtml}${wordHtml}</p>`,
    type: 'epub',
  }
}

function makeMangaPage(pageNum: number): PagePayload {
  return {
    bookId: 1,
    pageNum,
    totalPages: 10,
    content: '',
    type: 'manga',
    imageUrl: `https://cdn.example.com/page-${pageNum}.jpg`,
  }
}

const baseOptions = {
  cachePages: true,
  analyzeSentences: false,
  analyzeWords: false,
  ttsSentences: false,
  ttsWords: false,
}

describe('startWholeBookSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    syncState.value = 'idle'
    hoisted.libraryState.books = [makeBook()]
    hoisted.libraryState.currentBookInfo = null

    const settings = useGlobalSettingsStore()
    settings.ttsVoice = 'Kore'
    settings.useCustomLlm = false

    hoisted.bookRepo.getToc.mockResolvedValue([])
    hoisted.bookRepo.saveLocalToc.mockResolvedValue(undefined)
    hoisted.bookRepo.getLocalCover.mockResolvedValue(null)
    hoisted.bookRepo.fetchImageBlob.mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }))
    hoisted.bookRepo.saveLocalCover.mockResolvedValue(undefined)
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) => makeTextPage(num))
    hoisted.bookRepo.getLocalImage.mockResolvedValue(null)
    hoisted.bookRepo.saveLocalImage.mockResolvedValue(undefined)
    hoisted.bookRepo.getPageDict.mockResolvedValue({})

    hoisted.analysisRepo.getLocalAnalysis.mockResolvedValue(null)
    hoisted.analysisRepo.checkCache.mockResolvedValue({ results: [] })
    hoisted.analysisRepo.analyzeBatch.mockResolvedValue({ results: [] })
    hoisted.analysisRepo.saveLocalAnalysis.mockResolvedValue(undefined)
    hoisted.analysisRepo.getLocalTts.mockResolvedValue(null)
    hoisted.analysisRepo.generateTts.mockResolvedValue({ audioBase64: 'QUJD' })
    hoisted.analysisRepo.saveLocalTts.mockResolvedValue(undefined)
  })

  it('does nothing when the book is not found', async () => {
    hoisted.libraryState.books = []

    await startWholeBookSync(999, baseOptions)

    expect(hoisted.bookRepo.getPage).not.toHaveBeenCalled()
    expect(syncState.value).toBe('idle')
  })

  it('caches toc, cover, every page and its dictionary for a 10-page book', async () => {
    await startWholeBookSync(1, baseOptions)

    expect(hoisted.trackEvent).toHaveBeenCalledWith('book_sync_started', expect.objectContaining({ cachePages: true }))

    expect(hoisted.bookRepo.getToc).toHaveBeenCalledWith(1)
    expect(hoisted.bookRepo.saveLocalToc).toHaveBeenCalledWith(1, [])

    expect(hoisted.bookRepo.getLocalCover).toHaveBeenCalledWith(1)
    expect(hoisted.bookRepo.fetchImageBlob).toHaveBeenCalledWith('https://cdn.example.com/cover.jpg')
    expect(hoisted.bookRepo.saveLocalCover).toHaveBeenCalledTimes(1)

    expect(hoisted.bookRepo.getPage).toHaveBeenCalledTimes(10)
    for (let i = 1; i <= 10; i++) {
      expect(hoisted.bookRepo.getPage).toHaveBeenNthCalledWith(
        i,
        1,
        i,
        true,
      )
      expect(hoisted.bookRepo.getPageDict).toHaveBeenCalledWith(1, i)
    }

    expect(hoisted.bookRepo.getPageDict).toHaveBeenCalledTimes(10)

    expect(syncProgress.value.pagesTotal).toBe(10)
    expect(syncProgress.value.pagesDone).toBe(10)
    expect(syncState.value).toBe('finished')
    expect(syncProgress.value.currentTask).toBe('Успешно завершено!')
  })

  it('skips cover download when a local cover already exists', async () => {
    hoisted.bookRepo.getLocalCover.mockResolvedValue(new Blob(['cached']))

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.fetchImageBlob).not.toHaveBeenCalled()
    expect(hoisted.bookRepo.saveLocalCover).not.toHaveBeenCalled()
    expect(syncState.value).toBe('finished')
  })

  it('skips cover download when the book already has localCoverUrl', async () => {
    hoisted.libraryState.books = [makeBook({ localCoverUrl: 'blob:existing' })]

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.fetchImageBlob).not.toHaveBeenCalled()
    expect(syncState.value).toBe('finished')
  })

  it('continues the sync when cover caching fails', async () => {
    hoisted.bookRepo.fetchImageBlob.mockRejectedValue(new Error('network down'))

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.getPage).toHaveBeenCalledTimes(10)
    expect(syncState.value).toBe('finished')
  })

  it('continues the sync when a page dictionary fetch fails', async () => {
    hoisted.bookRepo.getPageDict.mockImplementation(async (_id: number, num: number) => {
      if (num === 3)
        throw new Error('dict fetch failed')

      return {}
    })

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.getPage).toHaveBeenCalledTimes(10)
    expect(syncProgress.value.pagesDone).toBe(10)
    expect(syncState.value).toBe('finished')
  })

  it('downloads missing images for manga pages only', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) => makeMangaPage(num))
    hoisted.bookRepo.getLocalImage.mockImplementation(async (_id: number, num: number) => {
      // pages 2 and 5 are already cached
      return num === 2 || num === 5 ? new Blob(['cached']) : null
    })

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.getLocalImage).toHaveBeenCalledTimes(10)
    expect(hoisted.bookRepo.saveLocalImage).toHaveBeenCalledTimes(8)
    for (let i = 1; i <= 10; i++) {
      if (i === 2 || i === 5)
        continue
      expect(hoisted.bookRepo.fetchImageBlob).toHaveBeenCalledWith(`https://cdn.example.com/page-${i}.jpg`)
    }

    expect(syncState.value).toBe('finished')
  })

  it('does not download images for text pages', async () => {
    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.getLocalImage).not.toHaveBeenCalled()
    expect(hoisted.bookRepo.saveLocalImage).not.toHaveBeenCalled()
  })

  it('continues the sync when an image download fails', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) => makeMangaPage(num))
    hoisted.bookRepo.fetchImageBlob.mockImplementation(async (url: string) => {
      if (url.includes('page-4'))
        throw new Error('image fetch failed')

      return new Blob(['img'])
    })

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.saveLocalImage).toHaveBeenCalledTimes(9)
    expect(syncProgress.value.pagesDone).toBe(10)
    expect(syncState.value).toBe('finished')
  })

  it('generates TTS for extracted sentences and tracks tts progress', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) =>
      makeTextPage(num, [`Sentence A${num}.`, `Sentence B${num}.`]))

    await startWholeBookSync(1, { ...baseOptions, ttsSentences: true })

    expect(hoisted.analysisRepo.generateTts).toHaveBeenCalledTimes(20)
    expect(hoisted.analysisRepo.generateTts).toHaveBeenCalledWith(
      1,
      'Sentence A1.',
      'Kore',
      expect.any(AbortSignal),
    )
    expect(hoisted.analysisRepo.saveLocalTts).toHaveBeenCalledWith('1_Kore_sentence a1.', 'QUJD')
    expect(syncProgress.value.ttsTotal).toBe(20)
    expect(syncProgress.value.ttsDone).toBe(20)
    expect(syncState.value).toBe('finished')
  })

  it('skips TTS generation for items already cached locally', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) =>
      makeTextPage(num, [`Sentence A${num}.`]))
    hoisted.analysisRepo.getLocalTts.mockImplementation(async (key: string) =>
      key.endsWith('sentence a1.') ? new Blob(['audio']) : null)

    await startWholeBookSync(1, { ...baseOptions, ttsSentences: true })

    expect(hoisted.analysisRepo.generateTts).toHaveBeenCalledTimes(9)
    expect(syncProgress.value.ttsTotal).toBe(10)
    expect(syncProgress.value.ttsDone).toBe(10)
  })

  it('continues TTS sync when generation fails for an item', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) =>
      makeTextPage(num, [`Sentence A${num}.`]))
    hoisted.analysisRepo.generateTts.mockImplementation(async (_id: number, text: string) => {
      if (text === 'Sentence A5.')
        throw new Error('tts failed')

      return { audioBase64: 'QUJD' }
    })

    await startWholeBookSync(1, { ...baseOptions, ttsSentences: true })

    expect(syncProgress.value.ttsDone).toBe(10)
    expect(syncState.value).toBe('finished')
  })

  it('analyzes missing sentences via server cache check and batch analysis', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async () =>
      makeTextPage(1, ['Cached on server.', 'Needs analysis.']))
    hoisted.libraryState.books = [makeBook({ totalPages: 1 })]
    hoisted.bookRepo.getPageDict.mockResolvedValue({})
    const serverAnalysis = { meanings: [] }
    hoisted.analysisRepo.checkCache.mockResolvedValue({
      results: [{ sentence: 'Cached on server.', analysis: serverAnalysis }],
    })
    hoisted.analysisRepo.analyzeBatch.mockImplementation(async (_id: number, items: any[]) => ({
      results: items.map((it: any) => ({ id: it.id, analysis: { meanings: ['llm'] } })),
    }))

    await startWholeBookSync(1, { ...baseOptions, analyzeSentences: true })

    expect(hoisted.analysisRepo.checkCache).toHaveBeenCalledWith(
      1,
      [
        { text: 'Cached on server.', type: 'sentence' },
        { text: 'Needs analysis.', type: 'sentence' },
      ],
      'en',
      expect.any(AbortSignal),
    )
    // Server-cached sentence is stored locally without LLM analysis
    expect(hoisted.analysisRepo.saveLocalAnalysis).toHaveBeenCalledWith('Cached on server.', serverAnalysis)
    // Only the missing sentence goes to analyzeBatch
    expect(hoisted.analysisRepo.analyzeBatch).toHaveBeenCalledTimes(1)
    const batchItems = hoisted.analysisRepo.analyzeBatch.mock.calls[0][1]
    expect(batchItems).toHaveLength(1)
    expect(batchItems[0].sentence).toBe('Needs analysis.')
    expect(hoisted.analysisRepo.saveLocalAnalysis).toHaveBeenCalledWith('Needs analysis.', { meanings: ['llm'] })

    expect(syncProgress.value.sentencesTotal).toBe(2)
    expect(syncProgress.value.sentencesDone).toBe(2)
    expect(syncState.value).toBe('finished')
  })

  it('skips analysis for sentences already in local cache', async () => {
    hoisted.libraryState.books = [makeBook({ totalPages: 1 })]
    hoisted.bookRepo.getPage.mockImplementation(async () => makeTextPage(1, ['Already known.']))
    hoisted.analysisRepo.getLocalAnalysis.mockResolvedValue({ meanings: ['cached'] })

    await startWholeBookSync(1, { ...baseOptions, analyzeSentences: true })

    expect(hoisted.analysisRepo.checkCache).not.toHaveBeenCalled()
    expect(hoisted.analysisRepo.analyzeBatch).not.toHaveBeenCalled()
    expect(syncProgress.value.sentencesDone).toBe(1)
    expect(syncState.value).toBe('finished')
  })

  it('analyzes missing words and ignores particles with pos "x"', async () => {
    hoisted.libraryState.books = [makeBook({ totalPages: 1 })]
    hoisted.bookRepo.getPage.mockImplementation(async () => ({
      ...makeTextPage(1),
      content: '<span data-word="hello" data-pos="noun">hello</span>'
        + '<span data-word="the" data-pos="x">the</span>',
    }))
    hoisted.analysisRepo.analyzeBatch.mockImplementation(async (_id: number, items: any[]) => ({
      results: items.map((it: any) => ({ id: it.id, analysis: { meanings: ['llm'] } })),
    }))

    await startWholeBookSync(1, { ...baseOptions, analyzeWords: true })

    expect(syncProgress.value.wordsTotal).toBe(1)
    expect(hoisted.analysisRepo.checkCache).toHaveBeenCalledWith(
      1,
      [{ text: 'hello', type: 'word' }],
      'en',
      expect.any(AbortSignal),
    )
    const batchItems = hoisted.analysisRepo.analyzeBatch.mock.calls[0][1]
    expect(batchItems[0].type).toBe('word')
    expect(syncProgress.value.wordsDone).toBe(1)
  })

  it('skips a failed page and continues the sync', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) => {
      if (num === 5)
        throw new Error('page fetch exploded')

      return makeTextPage(num)
    })

    await startWholeBookSync(1, baseOptions)

    // Все 10 страниц запрошены, пятая пропущена, синк завершился успешно
    expect(hoisted.bookRepo.getPage).toHaveBeenCalledTimes(10)
    expect(syncProgress.value.pagesDone).toBe(10)
    expect(syncState.value).toBe('finished')
  })

  it('returns to idle state when the sync is cancelled', async () => {
    hoisted.bookRepo.getPage.mockImplementation(async (_id: number, num: number) => {
      if (num === 2)
        cancelSync()

      return makeTextPage(num)
    })

    await startWholeBookSync(1, baseOptions)

    expect(hoisted.bookRepo.getPage).toHaveBeenCalledTimes(2)
    expect(syncState.value).toBe('idle')
  })
})
