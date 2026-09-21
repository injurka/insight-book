import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useBookSyncSections } from './use-book-sync-sections'

const mockedLibraryState = {
  syncProgress: {
    pagesTotal: 484,
    pagesDone: 232,
    sentencesTotal: 171,
    sentencesDone: 171,
    sentencesFromCache: 41,
    wordsTotal: 0,
    wordsDone: 0,
    wordsFromCache: 0,
    ttsTotal: 171,
    ttsDone: 171,
    ttsFromCache: 26,
    totalPreloadedCache: 0,
    currentTask: '',
  },
  syncOptions: {
    cachePages: true,
    analyzeSentences: true,
    analyzeWords: false,
    ttsSentences: true,
    ttsWords: false,
  },
  currentBookInfo: {
    id: 1,
    totalPages: 484,
    stats: {
      totalSentences: 10402,
      totalWords: 9281,
    },
  },
}

vi.mock('~/05.modules/library/store/library.store', () => ({
  useLibraryStore: () => mockedLibraryState,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('useBookSyncSections', () => {
  beforeEach(() => {
    mockedLibraryState.syncProgress.pagesDone = 232
    mockedLibraryState.syncProgress.pagesTotal = 484
    mockedLibraryState.syncProgress.sentencesDone = 171
    mockedLibraryState.syncProgress.sentencesTotal = 171
    mockedLibraryState.syncProgress.ttsDone = 171
    mockedLibraryState.syncProgress.ttsTotal = 171
  })

  it('calculates real percentage for sentences using estimatedTotal instead of pagePercent', () => {
    const isFinished = ref(false)
    const { sections } = useBookSyncSections(isFinished)

    const pagesSection = sections.value.find(s => s.key === 'pages')
    const sentencesSection = sections.value.find(s => s.key === 'sentences')
    const ttsSection = sections.value.find(s => s.key === 'tts')

    expect(pagesSection).toBeDefined()
    expect(pagesSection?.percent).toBe(48) // 232 / 484 = ~48%

    expect(sentencesSection).toBeDefined()
    // 171 out of 10 402 is ~1.64% -> 2%, NOT 48%!
    expect(sentencesSection?.percent).toBe(2)
    expect(sentencesSection?.estimatedTotal).toBe(10402)

    expect(ttsSection).toBeDefined()
    // 171 out of 10 402 is ~1.64% -> 2%, NOT 48%!
    expect(ttsSection?.percent).toBe(2)
    expect(ttsSection?.estimatedTotal).toBe(10402)
  })

  it('returns 100% for all sections when isFinished is true', () => {
    const isFinished = ref(true)
    const { sections } = useBookSyncSections(isFinished)

    for (const section of sections.value) {
      expect(section.percent).toBe(100)
      expect(section.status).toBe('done')
    }
  })
})
