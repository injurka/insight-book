import type { Book, BookStats, GeminiAnalysis, PagePayload, TocItem, UserDictItem } from '../types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../services/api.service'
import { useDictionaryStore } from './dictionary.store'

export interface WordPopoverData {
  word: string
  pos: string
  pinyin: string
  translation: string
  targetRect: DOMRect
  showAi: boolean
  isAiLoading: boolean
  aiTranslation?: string
  aiPinyin?: string
  aiData?: GeminiAnalysis
}

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const currentBook = ref<Book | null>(null)
  const currentBookInfo = ref<Book | null>(null)
  const currentPage = ref<PagePayload | null>(null)

  const isLoading = ref(false)
  const isPageLoading = ref(false)
  const isAnalyzingBook = ref(false)
  const uploadProgress = ref(0)

  const activeTokenId = ref<string | null>(null)
  const wordPopover = ref<WordPopoverData | null>(null)

  const sidebarOpen = ref(false)
  const sidebarAnalysis = ref<GeminiAnalysis | null>(null)
  const sidebarSentence = ref<string | null>(null)
  const isAnalyzing = ref(false)

  const currentToc = ref<TocItem[]>([])
  const tocOpen = ref(false)
  let lastTocBookId = 0

  const addEditWordModalOpen = ref(false)
  const wordToEdit = ref<Partial<UserDictItem> | null>(null)

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
    isLoading.value = true
    try {
      currentBookInfo.value = await api.books.getInfo(id)
    }
    finally {
      isLoading.value = false
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
    if (!wordPopover.value || wordPopover.value.aiTranslation)
      return
    wordPopover.value.isAiLoading = true
    try {
      const res = await api.books.analyze(currentBook.value!.id, wordPopover.value.word)
      if (wordPopover.value) {
        wordPopover.value.aiData = res
        wordPopover.value.aiTranslation = res.translation
        const vocabMatch = res.vocabulary?.find(v => v.word === wordPopover.value?.word)
        wordPopover.value.aiPinyin = vocabMatch?.pinyin || ''
      }
    }
    catch (e) {
      if (wordPopover.value) {
        wordPopover.value.aiTranslation = 'Ошибка при переводе ИИ'
      }
    }
    finally {
      if (wordPopover.value) {
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
    if (!currentPage.value || !currentBook.value)
      return
    activeTokenId.value = `${sentenceId}-${tokenIndex}`
    const targetRect = target.getBoundingClientRect()

    const entry = currentPage.value.pageDictionary[word]
    if (entry) {
      wordPopover.value = { word, pos, pinyin: entry.pinyin, translation: entry.translation, targetRect, showAi: false, isAiLoading: false }
      return
    }

    try {
      const result = await api.books.lookupWord(currentBook.value.id, word)
      wordPopover.value = { word, pos, pinyin: result.pinyin, translation: result.translation, targetRect, showAi: false, isAiLoading: false }
    }
    catch {
      wordPopover.value = { word, pos, pinyin: '', translation: 'Не найдено', targetRect, showAi: true, isAiLoading: false }
      fetchAiTranslation()
    }
  }

  async function handleSentenceAnalysis(sentence: string) {
    if (!currentBook.value)
      return
    sidebarSentence.value = sentence
    sidebarOpen.value = true
    sidebarAnalysis.value = null
    isAnalyzing.value = true
    try {
      sidebarAnalysis.value = await api.books.analyze(currentBook.value.id, sentence)
    }
    finally {
      isAnalyzing.value = false
    }
  }

  function closePopover() {
    wordPopover.value = null
    activeTokenId.value = null
  }

  async function openAddEditWordModal(wordData: WordPopoverData) {
    try {
      const existingWord = await api.dictionary.get(wordData.word)
      wordToEdit.value = existingWord
    }
    catch (e) {
      const pinyin = wordData.showAi ? (wordData.aiPinyin || wordData.pinyin) : wordData.pinyin
      const translation = wordData.showAi ? (wordData.aiTranslation || wordData.translation) : wordData.translation
      wordToEdit.value = { word: wordData.word, pinyin, translation }
    }
    addEditWordModalOpen.value = true
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
    sidebarOpen,
    sidebarAnalysis,
    sidebarSentence,
    isAnalyzing,
    currentToc,
    tocOpen,
    addEditWordModalOpen,
    wordToEdit,
    fetchBookInfo,
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
    openAddEditWordModal,
    saveWordToDict,
    removeFromDict,
  }
})
