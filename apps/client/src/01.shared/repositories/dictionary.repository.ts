import type {
  CatalogDeck,
  CatalogWord,
  DictDeck,
  GeneratedWordExamples,
  PromptItem,
  UserDictItem,
  WordAutoFillResponse,
} from '~/01.shared/types/models'
import type { DictionaryPage, DictionaryPageOptions } from '~/01.shared/types/schemas/dictionary.schema'
import { z } from 'zod'
import { applyAcl } from '~/01.shared/lib/acl'
import { filterDictionary } from '~/01.shared/lib/filter-dictionary'
import { canUseOfflineFallback } from '~/01.shared/lib/offline-fallback'
import { api } from '~/01.shared/services/api.service'
import { offlineService } from '~/01.shared/services/offline.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { CatalogDeckSchema, CatalogWordSchema, DictDeckSchema, DictionaryPageSchema, PromptItemSchema, UserDictItemSchema } from '~/01.shared/types/schemas/dictionary.schema'

export interface IDictionaryRepository {
  page: (options: DictionaryPageOptions) => Promise<DictionaryPage>
  list: () => Promise<UserDictItem[]>
  remove: (word: string) => Promise<{ success: boolean }>
  saveLocalDictionary: (words: UserDictItem[]) => Promise<void>

  getDecks: () => Promise<DictDeck[]>
  createDeck: (data: { name: string, language: string }) => Promise<DictDeck>
  updateDeck: (id: number, data: { name: string }) => Promise<{ success: boolean }>
  deleteDeck: (id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive') => Promise<{ success: boolean }>
  saveLocalDecks: (decks: DictDeck[]) => Promise<void>

  bulkDelete: (ids: number[]) => Promise<{ success: boolean }>
  bulkMove: (ids: number[], deckIds: number[]) => Promise<{ success: boolean }>
  getReviewQueue: (opts: { lang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' | 'match', deckId?: (number | 'all' | 'none')[] | number | 'all' | 'none', difficulty?: string }) => Promise<UserDictItem[]>
  get: (word: string) => Promise<UserDictItem>
  upsert: (item: Partial<UserDictItem>) => Promise<{ success: boolean }>
  autoFillWord: (word: string, lang: string) => Promise<WordAutoFillResponse>
  generateExamples: (word: string, lang: string) => Promise<GeneratedWordExamples>
  generateDeepDive: (word: string, lang: string, mode: 'collocations' | 'radicals') => Promise<unknown>
  submitReview: (id: number, grade: number) => Promise<{ success: boolean }>
  importCsv: (data: unknown) => Promise<{ success: boolean }>
  catalog: () => Promise<CatalogDeck[]>
  catalogWords: (deckId: number) => Promise<CatalogWord[]>
  cloneCatalog: (id: number) => Promise<{ success: boolean, deckId: number }>
  chat: (payload: { word: string, language: string, customPromptId?: number, userPromptText?: string }) => Promise<{ response: string }>
  promptsList: () => Promise<PromptItem[]>
  promptsCreate: (payload: { name: string, prompt: string }) => Promise<PromptItem>
  promptsUpdate: (id: number, payload: { name?: string, prompt?: string }) => Promise<PromptItem>
  promptsDelete: (id: number) => Promise<{ success: boolean }>
  checkPronunciation: (word: string, lang: string, audioBlob: Blob) => Promise<{ score: number, heardText: string, heardPhonetic?: string, mistakeAnalysis?: string }>
}

function dictionaryCacheScope() {
  const auth = useAuthStore()
  const settings = useGlobalSettingsStore()

  return JSON.stringify([auth.user?.id, auth.isSingleMode, settings.appLanguage])
}

function paginateOfflineDictionary(words: UserDictItem[], options: DictionaryPageOptions): DictionaryPage {
  const filtered = filterDictionary(words, options)
  const offset = options.offset || 0
  const items = filtered.slice(offset, offset + (options.limit || 50))
  const counts = new Map<number, number>()

  for (const word of words) {
    for (const deckId of word.deckIds)
      counts.set(deckId, (counts.get(deckId) || 0) + 1)
  }

  return {
    items,
    total: filtered.length,
    totalWords: words.length,
    nextOffset: offset + items.length < filtered.length ? offset + items.length : null,
    languages: [...new Set(words.map(word => word.language))],
    deckCounts: [...counts].map(([deckId, count]) => ({ deckId, count })),
  }
}

export class DefaultDictionaryRepository implements IDictionaryRepository {
  private async mutateDictionary<T>(mutation: () => Promise<T>): Promise<T> {
    const scope = dictionaryCacheScope()
    const result = await mutation()

    if (scope === dictionaryCacheScope())
      await offlineService.invalidateDictionaryCache().catch(() => {})

    return result
  }

  async page(options: DictionaryPageOptions): Promise<DictionaryPage> {
    const scope = dictionaryCacheScope()
    const authStore = useAuthStore()

    if (!authStore.user && !authStore.isSingleMode) {
      return {
        items: [],
        total: 0,
        totalWords: 0,
        nextOffset: null,
        languages: [],
        deckCounts: [],
      }
    }

    try {
      const raw = await api.dictionary.page(options)
      const data = applyAcl(DictionaryPageSchema, raw, 'dictionary.page()')

      if (scope !== dictionaryCacheScope())
        throw new Error('Dictionary session changed')

      await offlineService.saveDictionaryPage(options, data).catch(() => {})

      return data
    }
    catch (error) {
      if (scope !== dictionaryCacheScope() || !canUseOfflineFallback(error))
        throw error

      const cached = await offlineService.getDictionaryPage(options)

      if (cached)
        return applyAcl(DictionaryPageSchema, cached, 'dictionary.page() [offline]')

      const dictionary = await offlineService.getDictionary()

      if (dictionary) {
        const words = applyAcl(z.array(UserDictItemSchema), dictionary, 'dictionary.page() [legacy offline]')

        return paginateOfflineDictionary(words, options)
      }

      throw error
    }
  }

  async list(): Promise<UserDictItem[]> {
    const authStore = useAuthStore()

    if (!authStore.user && !authStore.isSingleMode)
      return []

    try {
      const raw = await api.dictionary.list()
      const data = applyAcl(z.array(UserDictItemSchema), raw, 'dictionary.list()')
      await offlineService.saveDictionary(data).catch(() => {})

      return data
    }
    catch (error) {
      if (!canUseOfflineFallback(error))
        throw error

      const offlineData = await offlineService.getDictionary()

      if (offlineData)
        return applyAcl(z.array(UserDictItemSchema), offlineData, 'dictionary.list() [offline]')

      throw error
    }
  }

  async remove(word: string) {
    return this.mutateDictionary(() => api.dictionary.remove(word))
  }

  async saveLocalDictionary(words: UserDictItem[]) {
    await offlineService.saveDictionary(words)
  }

  async getDecks(): Promise<DictDeck[]> {
    const authStore = useAuthStore()

    if (!authStore.user && !authStore.isSingleMode)
      return []

    try {
      const raw = await api.dictionary.decks()
      const data = applyAcl(z.array(DictDeckSchema), raw, 'dictionary.getDecks()')
      await offlineService.saveDecks(data).catch(() => {})

      return data
    }
    catch (error) {
      if (!canUseOfflineFallback(error))
        throw error

      const offlineData = await offlineService.getDecks()

      if (offlineData)
        return applyAcl(z.array(DictDeckSchema), offlineData, 'dictionary.getDecks() [offline]')

      throw error
    }
  }

  async createDeck(data: { name: string, language: string }) {
    return this.mutateDictionary(() => api.dictionary.createDeck(data))
  }

  async updateDeck(id: number, data: { name: string }) {
    return this.mutateDictionary(() => api.dictionary.updateDeck(id, data))
  }

  async deleteDeck(id: number, mode: 'keep' | 'delete_all' | 'delete_exclusive') {
    return this.mutateDictionary(() => api.dictionary.deleteDeck(id, mode))
  }

  async saveLocalDecks(decks: DictDeck[]) {
    await offlineService.saveDecks(decks)
  }

  async bulkDelete(ids: number[]) {
    return this.mutateDictionary(() => api.dictionary.bulkDelete(ids))
  }

  async bulkMove(ids: number[], deckIds: number[]) {
    return this.mutateDictionary(() => api.dictionary.bulkMove(ids, deckIds))
  }

  async getReviewQueue(opts: { lang: string, mode: 'srs' | 'random' | 'deep_dive' | 'cram' | 'match', deckId?: (number | 'all' | 'none')[] | number | 'all' | 'none', difficulty?: string }) {
    const raw = await api.dictionary.getReviewQueue(opts)

    return applyAcl(z.array(UserDictItemSchema), raw, 'dictionary.getReviewQueue()')
  }

  async get(word: string) {
    const scope = dictionaryCacheScope()

    try {
      const raw = await api.dictionary.get(word)
      const item = applyAcl(UserDictItemSchema, raw, `dictionary.get(${word})`)

      if (scope !== dictionaryCacheScope())
        throw new Error('Dictionary session changed')

      await offlineService.saveDictionaryWord(item).catch(() => {})

      return item
    }
    catch (error) {
      if (scope !== dictionaryCacheScope() || !canUseOfflineFallback(error))
        throw error

      const cached = await offlineService.getDictionaryWord(word)
        || (await offlineService.getDictionary())?.find(item => item.word === word)

      if (cached)
        return applyAcl(UserDictItemSchema, cached, `dictionary.get(${word}) [offline]`)

      throw error
    }
  }

  async upsert(item: Partial<UserDictItem>) {
    return this.mutateDictionary(() => api.dictionary.upsert(item))
  }

  async autoFillWord(word: string, lang: string) { return api.dictionary.autoFillWord(word, lang) }
  async generateExamples(word: string, lang: string) { return api.dictionary.generateExamples(word, lang) }
  async generateDeepDive(word: string, lang: string, mode: 'collocations' | 'radicals') { return api.dictionary.generateDeepDive(word, lang, mode) }
  async submitReview(id: number, grade: number) { return this.mutateDictionary(() => api.dictionary.submitReview(id, grade)) }
  async importCsv(data: unknown) { return this.mutateDictionary(() => api.dictionary.importCsv(data)) }
  async catalog() {
    const raw = await api.dictionary.catalog()

    return applyAcl(z.array(CatalogDeckSchema), raw, 'dictionary.catalog()')
  }

  async catalogWords(deckId: number) {
    const raw = await api.dictionary.catalogWords(deckId)

    return applyAcl(z.array(CatalogWordSchema), raw, `dictionary.catalogWords(${deckId})`)
  }

  async cloneCatalog(id: number) { return this.mutateDictionary(() => api.dictionary.cloneCatalog(id)) }
  async chat(payload: { word: string, language: string, customPromptId?: number, userPromptText?: string }) { return api.dictionary.chat(payload) }
  async promptsList() {
    const raw = await api.dictionary.promptsList()

    return applyAcl(z.array(PromptItemSchema), raw, 'dictionary.promptsList()')
  }

  async promptsCreate(payload: { name: string, prompt: string }) { return api.dictionary.promptsCreate(payload) }
  async promptsUpdate(id: number, payload: { name?: string, prompt?: string }) { return api.dictionary.promptsUpdate(id, payload) }
  async promptsDelete(id: number) { return api.dictionary.promptsDelete(id) }
  async checkPronunciation(word: string, lang: string, audioBlob: Blob) { return api.dictionary.checkPronunciation(word, lang, audioBlob) }
}

export const dictionaryRepository: IDictionaryRepository = new DefaultDictionaryRepository()
