import type { LlmAnalysis } from '~/01.shared/types/models'
import { applyAcl } from '~/01.shared/lib/acl'
import { api } from '~/01.shared/services/api.service'
import { offlineService } from '~/01.shared/services/offline.service'
import { LlmAnalysisSchema } from '~/01.shared/types/schemas/analysis.schema'

export interface IAnalysisRepository {
  checkCache: (bookId: number, items: { text: string, type: 'sentence' | 'word' }[], language: string, signal?: AbortSignal) => Promise<any>
  analyzeBatch: (bookId: number, items: { id: string, sentence: string, context?: string, type: 'sentence' | 'word' }[], language: string, signal?: AbortSignal) => Promise<any>
  analyze: (bookId: number, text: string, language: string, context?: string, signal?: AbortSignal, type?: 'sentence' | 'word') => Promise<LlmAnalysis>
  lookupWord: (bookId: number, word: string, signal?: AbortSignal) => Promise<any>
  generateTts: (bookId: number, text: string, voice: string, signal?: AbortSignal) => Promise<{ audioBase64: string }>
  generateGenericTts: (text: string, voice: string, signal?: AbortSignal, forceCacheBypass?: boolean) => Promise<{ audioBase64: string }>

  // Local Cache Methods
  getLocalAnalysis: (text: string, lang?: string) => Promise<LlmAnalysis | null | undefined>
  saveLocalAnalysis: (text: string, analysis: LlmAnalysis, lang?: string) => Promise<void>
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
    return api.books.checkCache(
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
    return api.books.analyzeBatch(
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
      const cached = await offlineService.getAnalysis(text, language)
      if (cached)
        return applyAcl(LlmAnalysisSchema, cached, 'analysis.analyze() [offline]')
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
    const data = applyAcl(LlmAnalysisSchema, res, 'analysis.analyze()')
    await offlineService.saveAnalysis(text, data, language).catch(() => { })

    return data
  }

  async lookupWord(bookId: number, word: string, signal?: AbortSignal) {
    return api.books.lookupWord(bookId, word, signal)
  }

  async generateTts(
    bookId: number,
    text: string,
    voice: string,
    signal?: AbortSignal,
  ) {
    return api.books.generateTts(
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
    return api.tts.generate(
      text,
      voice,
      signal,
      forceCacheBypass,
    )
  }

  async getLocalAnalysis(text: string, lang?: string) {
    const cached = await offlineService.getAnalysis(text, lang)
    if (!cached)
      return cached

    return applyAcl(LlmAnalysisSchema, cached, 'analysis.getLocalAnalysis()')
  }

  async saveLocalAnalysis(text: string, analysis: LlmAnalysis, lang?: string) {
    await offlineService.saveAnalysis(text, analysis, lang)
  }

  async getLocalTts(cacheKey: string) {
    return offlineService.getTtsBlob(cacheKey)
  }

  async saveLocalTts(cacheKey: string, audioBase64: string) {
    await offlineService.saveTts(cacheKey, audioBase64)
  }
}

export const analysisRepository: IAnalysisRepository = new DefaultAnalysisRepository()
