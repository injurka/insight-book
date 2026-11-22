import type { LlmAnalysis } from '~/01.shared/types/models'
import type { TtsCacheMetadata } from '~/01.shared/types/schemas/tts.schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DefaultAnalysisRepository } from './analysis.repository'

const apiMocks = vi.hoisted(() => ({
  books: {
    getAllCacheAll: vi.fn(),
    checkCache: vi.fn(),
    analyzeBatch: vi.fn(),
    analyze: vi.fn(),
    lookupWord: vi.fn(),
    generateTts: vi.fn(),
  },
  tts: {
    generate: vi.fn(),
  },
}))

const offlineMocks = vi.hoisted(() => ({
  getAnalysis: vi.fn(),
  saveAnalysis: vi.fn(),
  getTtsBlob: vi.fn(),
  getTtsMetadata: vi.fn(),
  saveTts: vi.fn(),
}))

vi.mock('~/01.shared/services/api.service', () => ({ api: apiMocks }))
vi.mock('~/01.shared/services/offline.service', () => ({ offlineService: offlineMocks }))

const validAnalysis: LlmAnalysis = {
  transcription: 'həˈloʊ',
  translation: 'привет',
  grammarRules: [{ pattern: 'greeting', explanation: 'basic greeting', example: 'Hello!' }],
  vocabulary: [{ word: 'hello', transcription: 'həˈloʊ', meaning: 'привет', usageInContext: 'Hello!' }],
}

const ttsMetadata: TtsCacheMetadata = {
  id: 'tts-1',
  model: 'tts-1',
  provider: 'openai',
  requestedVoice: 'Kore',
  voice: 'alloy',
  createdAt: '2026-11-20T00:00:00Z',
}

describe('analysis repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    offlineMocks.saveAnalysis.mockResolvedValue(undefined)
    offlineMocks.saveTts.mockResolvedValue(undefined)
  })

  it('delegates cache-all, checkCache, analyzeBatch and lookupWord to api.books', async () => {
    const controller = new AbortController()
    const repo = new DefaultAnalysisRepository()

    apiMocks.books.getAllCacheAll.mockResolvedValue({ results: [{ sentence: 'Hi', analysis: validAnalysis }] })
    apiMocks.books.checkCache.mockResolvedValue({ results: [] })
    apiMocks.books.analyzeBatch.mockResolvedValue({ results: [{ id: '1', analysis: validAnalysis }] })
    apiMocks.books.lookupWord.mockResolvedValue({ transcription: 'haɪ', translation: 'привет', isUserDict: true })

    await expect(repo.getAllCacheAll(1, 'ru')).resolves.toEqual({ results: [{ sentence: 'Hi', analysis: validAnalysis }] })
    expect(apiMocks.books.getAllCacheAll).toHaveBeenCalledWith(1, 'ru')

    await expect(repo.checkCache(
      1,
      [{ text: 'Hi', type: 'sentence' }],
      'en',
      controller.signal,
    )).resolves.toEqual({ results: [] })
    expect(apiMocks.books.checkCache).toHaveBeenCalledWith(
      1,
      [{ text: 'Hi', type: 'sentence' }],
      'en',
      controller.signal,
    )

    await expect(repo.analyzeBatch(
      1,
      [{ id: '1', sentence: 'Hi', context: 'ctx', type: 'sentence' }],
      'en',
      controller.signal,
    ))
      .resolves
      .toEqual({ results: [{ id: '1', analysis: validAnalysis }] })
    expect(apiMocks.books.analyzeBatch).toHaveBeenCalledWith(
      1,
      [{ id: '1', sentence: 'Hi', context: 'ctx', type: 'sentence' }],
      'en',
      controller.signal,
    )

    await expect(repo.lookupWord(
      1,
      'Hi',
      controller.signal,
      'en',
    ))
      .resolves
      .toEqual({ transcription: 'haɪ', translation: 'привет', isUserDict: true })
    expect(apiMocks.books.lookupWord).toHaveBeenCalledWith(
      1,
      'Hi',
      controller.signal,
      'en',
    )
  })

  it('returns cached offline analysis without calling the API when available', async () => {
    offlineMocks.getAnalysis.mockResolvedValue({ translation: 'привет' })
    const repo = new DefaultAnalysisRepository()

    const result = await repo.analyze(1, 'Hello', 'en')

    expect(offlineMocks.getAnalysis).toHaveBeenCalledWith('Hello', 'en')
    expect(apiMocks.books.analyze).not.toHaveBeenCalled()
    expect(result).toEqual({
      transcription: '',
      translation: 'привет',
      grammarRules: [],
      vocabulary: [],
    })
  })

  it('falls back to API when offline cache lookup fails or misses and saves validated result', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    offlineMocks.getAnalysis.mockRejectedValueOnce(new Error('idb failed'))
    offlineMocks.saveAnalysis.mockRejectedValueOnce(new Error('quota exceeded'))
    apiMocks.books.analyze.mockResolvedValue(validAnalysis)

    const controller = new AbortController()
    const repo = new DefaultAnalysisRepository()
    const result = await repo.analyze(
      2,
      'Hello',
      'en',
      'Context',
      controller.signal,
      'word',
    )

    expect(warnSpy).toHaveBeenCalled()
    expect(apiMocks.books.analyze).toHaveBeenCalledWith(
      2,
      'Hello',
      'en',
      'Context',
      controller.signal,
      'word',
    )
    expect(offlineMocks.saveAnalysis).toHaveBeenCalledWith('Hello', validAnalysis, 'en')
    expect(result).toEqual(validAnalysis)
    warnSpy.mockRestore()
  })

  it('validates book and generic TTS responses via ACL', async () => {
    const controller = new AbortController()
    const payload = { audioBase64: 'QUJD', mimeType: 'audio/mpeg', cache: ttsMetadata }
    apiMocks.books.generateTts.mockResolvedValue(payload)
    apiMocks.tts.generate.mockResolvedValue({ audioBase64: 'REVG' })

    const repo = new DefaultAnalysisRepository()

    await expect(repo.generateTts(
      3,
      'Hello',
      'Kore',
      controller.signal,
      true,
    )).resolves.toEqual(payload)
    expect(apiMocks.books.generateTts).toHaveBeenCalledWith(
      3,
      'Hello',
      'Kore',
      controller.signal,
      true,
    )

    await expect(repo.generateGenericTts(
      'World',
      'Kore',
      controller.signal,
      false,
    )).resolves.toEqual({ audioBase64: 'REVG' })
    expect(apiMocks.tts.generate).toHaveBeenCalledWith(
      'World',
      'Kore',
      controller.signal,
      false,
    )
  })

  it('handles local analysis and TTS cache helper methods', async () => {
    const repo = new DefaultAnalysisRepository()
    const blob = new Blob(['audio'], { type: 'audio/mpeg' })

    offlineMocks.getAnalysis.mockResolvedValueOnce(null)
    await expect(repo.getLocalAnalysis('Missing', 'en')).resolves.toBeNull()

    offlineMocks.getAnalysis.mockResolvedValueOnce({ translation: 'мир' })
    await expect(repo.getLocalAnalysis('World', 'en')).resolves.toEqual({
      transcription: '',
      translation: 'мир',
      grammarRules: [],
      vocabulary: [],
    })

    await repo.saveLocalAnalysis('World', validAnalysis, 'en')
    expect(offlineMocks.saveAnalysis).toHaveBeenCalledWith('World', validAnalysis, 'en')

    offlineMocks.getTtsBlob.mockResolvedValue(blob)
    await expect(repo.getLocalTts('tts-key')).resolves.toBe(blob)
    expect(offlineMocks.getTtsBlob).toHaveBeenCalledWith('tts-key')

    offlineMocks.getTtsMetadata.mockResolvedValue(ttsMetadata)
    await expect(repo.getLocalTtsMetadata('tts-key')).resolves.toEqual(ttsMetadata)
    expect(offlineMocks.getTtsMetadata).toHaveBeenCalledWith('tts-key')

    await repo.saveLocalTts('tts-key', 'QUJD', ttsMetadata)
    expect(offlineMocks.saveTts).toHaveBeenCalledWith('tts-key', 'QUJD', ttsMetadata)
  })
})
