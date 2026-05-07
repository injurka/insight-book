import type { Book, BookStats, LlmAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'
import { api } from '../services/api.service'
import { useDictionaryStore } from './dictionary.store'

export interface WordPopoverData {
  word: string
  pos: string
  transcription: string
  translation: string
  targetRect: DOMRect
  showAi: boolean
  isAiLoading: boolean
  aiTranslation?: string
  aiTranscription?: string
  aiData?: LlmAnalysis
}

export interface AnalysisHistoryItem {
  sentence: string
  analysis: LlmAnalysis
  timestamp: number
}

export interface SelectionTooltipData {
  text: string
  targetRect: DOMRect
}

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const currentBook = ref<Book | null>(null)
  const currentBookInfo = ref<Book | null>(null)
  const currentPage = ref<PagePayload | null>(null)

  const isLoading = ref(false)
  const isPageLoading = ref(false)
  const isAnalyzingBook = ref(false)
  const isAnalyzingVocab = ref(false)

  const uploadProgress = ref(0)
  const ttsCurrentWordIndex = ref(-1)

  const activeTokenId = ref<string | null>(null)
  const wordPopover = ref<WordPopoverData | null>(null)

  // Состояние тултипа для выделенного текста
  const selectionTooltip = ref<SelectionTooltipData | null>(null)

  const sidebarOpen = ref(false)
  const sidebarAnalysis = ref<LlmAnalysis | null>(null)
  const sidebarSentence = ref<string | null>(null)
  const isAnalyzing = ref(false)

  // История анализа предложений в рамках текущей сессии
  const analysisHistory = ref<AnalysisHistoryItem[]>([])

  const currentToc = ref<TocItem[]>([])
  const tocOpen = ref(false)
  let lastTocBookId = 0

  const addEditWordModalOpen = ref(false)
  const wordToEdit = ref<Partial<UserDictItem> | null>(null)

  // Контроллеры для отмены запросов
  let wordAbortController: AbortController | null = null
  let sentenceAbortController: AbortController | null = null

  async function fetchBooks() {
    isLoading.value = true
    try {
      books.value = await api.books.list()
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchBookInfo(id: number) {
    if (currentBookInfo.value?.id !== id) {
      currentBookInfo.value = null
    }

    isLoading.value = true
    try {
      currentBookInfo.value = await api.books.getInfo(id)
    }
    finally {
      isLoading.value = false
    }
  }

  async function updateBookInfo(id: number, data: Partial<Book>) {
    await api.books.updateInfo(id, data)
    const listBook = books.value.find(b => b.id === id)
    if (listBook) {
      Object.assign(listBook, data)
    }
    if (currentBook.value?.id === id) {
      Object.assign(currentBook.value, data)
    }
    if (currentBookInfo.value?.id === id) {
      Object.assign(currentBookInfo.value, data)
    }
  }

  async function analyzeFullBook(id: number) {
    isAnalyzingBook.value = true
    try {
      const res = await api.books.analyzeBook(id)
      if (currentBookInfo.value && currentBookInfo.value.id === id) {
        currentBookInfo.value.stats = res.stats
      }
    }
    finally {
      isAnalyzingBook.value = false
    }
  }

  async function updateBookCover(id: number, file: File) {
    const res = await api.books.updateCover(id, file)
    if (currentBookInfo.value && currentBookInfo.value.id === id) {
      currentBookInfo.value.coverBase64 = res.coverBase64
    }
    const listBook = books.value.find(b => b.id === id)
    if (listBook)
      listBook.coverBase64 = res.coverBase64
  }

  async function updateBookStats(id: number, data: Partial<BookStats>) {
    const res = await api.books.updateStats(id, data)
    if (currentBookInfo.value && currentBookInfo.value.id === id) {
      currentBookInfo.value.stats = res.stats
    }
  }

  async function uploadBook(file: File) {
    isLoading.value = true
    try {
      const { book } = await api.books.upload(file)
      books.value.unshift(book)
      return book
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteBook(id: number) {
    await api.books.delete(id)
    books.value = books.value.filter(b => b.id !== id)
    if (currentBook.value?.id === id) {
      currentBook.value = null
      currentPage.value = null
    }
  }

  async function fetchToc(bookId: number) {
    try {
      currentToc.value = await api.books.getToc(bookId)
      lastTocBookId = bookId
    }
    catch {
      currentToc.value = []
    }
  }

  async function openBook(book: Book) {
    currentBook.value = book
    const startPage = book.currentPage || 1
    await loadPage(book.id, startPage)
  }

  async function openBookById(id: number, startPage?: number) {
    isLoading.value = true
    try {
      if (books.value.length === 0) {
        await fetchBooks()
      }
      const book = books.value.find(b => b.id === id)
      if (!book)
        throw new Error('Книга не найдена')

      currentBook.value = book
      const pageToLoad = startPage || book.currentPage || 1
      await loadPage(book.id, pageToLoad)
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadPage(bookId: number, pageNum: number) {
    isPageLoading.value = true
    closePopover()
    closeSelectionTooltip()
    sidebarOpen.value = false

    if (currentToc.value.length === 0 || lastTocBookId !== bookId) {
      fetchToc(bookId)
    }

    try {
      currentPage.value = await api.books.getPage(bookId, pageNum)
      if (currentBook.value)
        currentBook.value.currentPage = pageNum
    }
    finally {
      isPageLoading.value = false
    }
  }

  async function fetchAiTranslation() {
    if (!wordPopover.value || wordPopover.value.aiTranslation || !currentBook.value)
      return

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value.isAiLoading = true
    try {
      const res = await api.books.analyze(
        currentBook.value.id,
        wordPopover.value.word,
        currentBook.value.language,
        controller.signal,
      )

      if (wordAbortController !== controller)
        return

      if (wordPopover.value) {
        wordPopover.value.aiData = res
        wordPopover.value.aiTranslation = res.translation

        const targetWord = wordPopover.value.word
        const vocabMatch = res.vocabulary?.find(v => v.word.includes(targetWord) || targetWord.includes(v.word))
        wordPopover.value.aiTranscription = res.transcription || vocabMatch?.transcription || ''
      }
    }
    catch (err: any) {
      if (err.name === 'AbortError')
        return

      if (wordPopover.value && wordAbortController === controller) {
        wordPopover.value.aiTranslation = 'Ошибка при переводе ИИ'
      }
    }
    finally {
      if (wordPopover.value && wordAbortController === controller) {
        wordPopover.value.isAiLoading = false
      }
    }
  }

  function toggleAiTranslation() {
    if (!wordPopover.value)
      return
    wordPopover.value.showAi = !wordPopover.value.showAi
    if (wordPopover.value.showAi) {
      fetchAiTranslation()
    }
  }

  async function handleWordClick(word: string, pos: string, sentenceId: number, tokenIndex: number, target: HTMLElement) {
    if (!currentPage.value || !currentBook.value) return

    closeSelectionTooltip()
    activeTokenId.value = `${sentenceId}-${tokenIndex}`
    const targetRect = target.getBoundingClientRect()

    const entry = currentPage.value.pageDictionary[word]
    if (entry) {
      if (wordAbortController) wordAbortController.abort()
      wordPopover.value = {
        word, pos,
        transcription: entry.transcription,
        translation: entry.translation,
        targetRect, showAi: false, isAiLoading: false
      }
      return
    }

    if (wordAbortController) wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value = {
      word, pos,
      transcription: '', translation: 'Поиск перевода...',
      targetRect, showAi: true, isAiLoading: true
    }

    fetchAiTranslation()
  }

  async function handleSentenceAnalysis(sentence: string) {
    if (!currentBook.value)
      return

    sidebarSentence.value = sentence
    sidebarOpen.value = true

    const existing = analysisHistory.value.find(h => h.sentence === sentence)
    if (existing) {
      sidebarAnalysis.value = existing.analysis
      isAnalyzing.value = false
      return
    }

    sidebarAnalysis.value = null
    isAnalyzing.value = true

    if (sentenceAbortController)
      sentenceAbortController.abort()
    const controller = new AbortController()
    sentenceAbortController = controller

    try {
      const res = await api.books.analyze(currentBook.value.id, sentence, currentBook.value.language, controller.signal)

      if (sentenceAbortController !== controller)
        return

      sidebarAnalysis.value = res
      analysisHistory.value.unshift({
        sentence,
        analysis: res,
        timestamp: Date.now(),
      })
    }
    catch (err: any) {
      if (err.name === 'AbortError')
        return
      console.error(err)
    }
    finally {
      if (sentenceAbortController === controller) {
        isAnalyzing.value = false
      }
    }
  }

  function closePopover() {
    if (wordAbortController) {
      wordAbortController.abort()
      wordAbortController = null
    }
    wordPopover.value = null
    activeTokenId.value = null
  }

  function closeSelectionTooltip() {
    selectionTooltip.value = null
  }

  async function openAddEditWordModal(wordData: WordPopoverData) {
    try {
      const existingWord = await api.dictionary.get(wordData.word)
      wordToEdit.value = existingWord
    }
    catch {
      const transcription = wordData.showAi ? (wordData.aiTranscription || wordData.transcription) : wordData.transcription
      const translation = wordData.showAi ? (wordData.aiTranslation || wordData.translation) : wordData.translation
      wordToEdit.value = {
        word: wordData.word,
        transcription,
        translation,
        language: currentBook.value?.language || 'en',
      }
    }
    addEditWordModalOpen.value = true
  }

  async function analyzeVocabulary(id: number) {
    isAnalyzingVocab.value = true
    try {
      const res = await api.books.analyzeVocabulary(id)
      if (currentBookInfo.value?.id === id) {
        if (!currentBookInfo.value.stats)
          currentBookInfo.value.stats = {} as any
        currentBookInfo.value.stats!.posDistribution = res.lexicalStats.posDistribution
        currentBookInfo.value.stats!.topWords = res.lexicalStats.topWords
        currentBookInfo.value.stats!.lexicalDiversity = res.lexicalStats.lexicalDiversity
      }
    }
    finally {
      isAnalyzingVocab.value = false
    }
  }

  async function lookupStandaloneWord(word: string, pos: string, target: HTMLElement) {
    const bookId = currentBookInfo.value?.id || currentBook.value?.id
    if (!bookId)
      return

    closeSelectionTooltip()
    const targetRect = target.getBoundingClientRect()

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    try {
      const result = await api.books.lookupWord(bookId, word, controller.signal)
      if (wordAbortController !== controller)
        return
      wordPopover.value = { word, pos, transcription: result.transcription, translation: result.translation, targetRect, showAi: false, isAiLoading: false }
    }
    catch (err: any) {
      if (err.name === 'AbortError')
        return
      if (wordAbortController !== controller)
        return

      wordPopover.value = { word, pos, transcription: '', translation: 'Не найдено', targetRect, showAi: true, isAiLoading: false }
      toggleAiTranslation()
    }
  }

  async function saveWordToDict(item: UserDictItem) {
    await api.dictionary.upsert(item)
    addEditWordModalOpen.value = false
    const dictStore = useDictionaryStore()
    dictStore.fetchDictionary()
  }

  async function removeFromDict(word: string) {
    await api.dictionary.remove(word)
    addEditWordModalOpen.value = false
    const dictStore = useDictionaryStore()
    dictStore.fetchDictionary()
  }

  return {
    books,
    currentBook,
    currentBookInfo,
    currentPage,
    isLoading,
    isPageLoading,
    isAnalyzingBook,
    uploadProgress,
    activeTokenId,
    wordPopover,
    selectionTooltip,
    sidebarOpen,
    sidebarAnalysis,
    sidebarSentence,
    isAnalyzing,
    analysisHistory,
    currentToc,
    tocOpen,
    ttsCurrentWordIndex,
    isAnalyzingVocab,
    addEditWordModalOpen,
    wordToEdit,
    fetchBookInfo,
    updateBookInfo,
    analyzeFullBook,
    updateBookCover,
    updateBookStats,
    openBookById,
    fetchBooks,
    uploadBook,
    deleteBook,
    openBook,
    loadPage,
    handleWordClick,
    toggleAiTranslation,
    handleSentenceAnalysis,
    closePopover,
    closeSelectionTooltip,
    openAddEditWordModal,
    analyzeVocabulary,
    lookupStandaloneWord,
    saveWordToDict,
    removeFromDict,
  }
})
