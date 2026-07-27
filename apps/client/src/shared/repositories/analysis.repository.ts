import type { LlmAnalysis } from '~/shared/types/models'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'

export interface IAnalysisRepository {
  checkCache: (bookId: number, items: { text: string, type: 'sentence' | 'word' }[], language: string, signal?: AbortSignal) => Promise<any>
  analyzeBatch: (bookId: number, items: { id: string, sentence: string, context?: string, type: 'sentence' | 'word' }[], language: string, signal?: AbortSignal) => Promise<any>
  analyze: (bookId: number, text: string, language: string, context?: string, signal?: AbortSignal, type?: 'sentence' | 'word') => Promise<LlmAnalysis>
  lookupWord: (bookId: number, word: string, signal?: AbortSignal) => Promise<any>
  generateTts: (bookId: number, text: string, voice: string, signal?: AbortSignal) => Promise<{ audioBase64: string }>
  generateGenericTts: (text: string, voice: string, signal?: AbortSignal, forceCacheBypass?: boolean) => Promise<{ audioBase64: string }>

  // Local Cache Methods
  getLocalAnalysis: (text: string) => Promise<LlmAnalysis | null | undefined>
  saveLocalAnalysis: (text: string, analysis: LlmAnalysis) => Promise<void>
  getLocalTts: (cacheKey: string) => Promise<Blob | null | undefined>
  saveLocalTts: (cacheKey: string, audioBase64: string) => Promise<void>
}

export class DefaultAnalysisRepository implements IAnalysisRepository {
  async checkCache(
    bookId: number,
    items: { text: string, type: 'sentence' | 'word' }[],
    language: string,
    signal?: AbortSignal,
  ) {
    return await api.books.checkCache(
      bookId,
      items,
      language,
      signal,
    )
  }

  async analyzeBatch(
    bookId: number,
    items: { id: string, sentence: string, context?: string, type: 'sentence' | 'word' }[],
    language: string,
    signal?: AbortSignal,
  ) {
    return await api.books.analyzeBatch(
      bookId,
      items,
      language,
      signal,
    )
  }

  async analyze(
    bookId: number,
    text: string,
    language: string,
    context?: string,
    signal?: AbortSignal,
    type: 'sentence' | 'word' = 'sentence',
  ): Promise<LlmAnalysis> {
    try {
      const cached = await offlineService.getAnalysis(text)
      if (cached)
        return cached
    }
    catch (e) {
      console.warn('Failed to retrieve from local cache:', e)
    }

    const res = await api.books.analyze(
      bookId,
      text,
      language,
      context,
      signal,
      type,
    )
    if (res) {
      await offlineService.saveAnalysis(text, res).catch(() => {})
    }
    return res
  }

  async lookupWord(bookId: number, word: string, signal?: AbortSignal) {
    return await api.books.lookupWord(bookId, word, signal)
  }

  async generateTts(
    bookId: number,
    text: string,
    voice: string,
    signal?: AbortSignal,
  ) {
    return await api.books.generateTts(
      bookId,
      text,
      voice,
      signal,
    )
  }

  async generateGenericTts(
    text: string,
    voice: string,
    signal?: AbortSignal,
    forceCacheBypass?: boolean,
  ) {
    return await api.tts.generate(
      text,
      voice,
      signal,
      forceCacheBypass,
    )
  }

  async getLocalAnalysis(text: string) {
    return await offlineService.getAnalysis(text)
  }

  async saveLocalAnalysis(text: string, analysis: LlmAnalysis) {
    await offlineService.saveAnalysis(text, analysis)
  }

  async getLocalTts(cacheKey: string) {
    return await offlineService.getTtsBlob(cacheKey)
  }

  async saveLocalTts(cacheKey: string, audioBase64: string) {
    await offlineService.saveTts(cacheKey, audioBase64)
  }
}

export const analysisRepository: IAnalysisRepository = new DefaultAnalysisRepository()
