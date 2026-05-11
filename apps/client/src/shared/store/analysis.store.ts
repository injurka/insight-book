import type { LlmAnalysis, UserDictItem } from '~/shared/types/models'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { api } from '~/shared/services/api.service'
import { useToastStore } from '~/shared/store/toast.store'

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

export const useAnalysisStore = defineStore('analysis', () => {
  // Popovers & Tooltips
  const activeTokenId = ref<string | null>(null)
  const wordPopover = ref<WordPopoverData | null>(null)
  const selectionTooltip = ref<SelectionTooltipData | null>(null)

  // Sidebar Analysis
  const sidebarOpen = ref(false)
  const sidebarAnalysis = ref<LlmAnalysis | null>(null)
  const sidebarSentence = ref<string | null>(null)
  const isAnalyzing = ref(false)
  const analysisHistory = ref<AnalysisHistoryItem[]>([])

  // Whole Page Analysis
  const isAnalyzingPage = ref(false)
  const pageAnalysisProgress = ref(0)
  const pageAnalysisCurrent = ref(0)
  const pageAnalysisTotal = ref(0)

  // Dictionary Modal
  const addEditWordModalOpen = ref(false)
  const wordToEdit = ref<Partial<UserDictItem> | null>(null)

  // Abort Controllers
  let wordAbortController: AbortController | null = null
  let sentenceAbortController: AbortController | null = null
  let pageAnalysisAbortController: AbortController | null = null

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

  function cancelPageAnalysis() {
    if (pageAnalysisAbortController) {
      pageAnalysisAbortController.abort()
      pageAnalysisAbortController = null
    }
    isAnalyzingPage.value = false
  }

  async function fetchAiTranslation() {
    const readerStore = useReaderStore()
    if (!wordPopover.value || wordPopover.value.aiTranslation || !readerStore.currentBook)
      return

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value.isAiLoading = true
    try {
      const res = await api.books.analyze(
        readerStore.currentBook.id,
        wordPopover.value.word,
        readerStore.currentBook.language,
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
    catch (err: unknown) {
      if (!(err instanceof Error))
        return

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
    const readerStore = useReaderStore()
    if (!readerStore.currentPage || !readerStore.currentBook)
      return

    closeSelectionTooltip()
    activeTokenId.value = `${sentenceId}-${tokenIndex}`
    const targetRect = target.getBoundingClientRect()

    const entry = readerStore.currentPage.pageDictionary[word]
    if (entry) {
      if (wordAbortController)
        wordAbortController.abort()
      wordPopover.value = {
        word,
        pos,
        transcription: entry.transcription,
        translation: entry.translation,
        targetRect,
        showAi: false,
        isAiLoading: false,
      }
      return
    }

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value = {
      word,
      pos,
      transcription: '',
      translation: 'Поиск перевода...',
      targetRect,
      showAi: true,
      isAiLoading: true,
    }

    fetchAiTranslation()
  }

  async function lookupStandaloneWord(word: string, pos: string, target: HTMLElement) {
    const libraryStore = useLibraryStore()
    const readerStore = useReaderStore()

    const bookId = libraryStore.currentBookInfo?.id || readerStore.currentBook?.id
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

      wordPopover.value = {
        word,
        pos,
        transcription: result.transcription,
        translation: result.translation,
        targetRect,
        showAi: false,
        isAiLoading: false,
      }
    }
    catch (err: unknown) {
      if (!(err instanceof Error))
        return

      if (err.name === 'AbortError')
        return
      if (wordAbortController !== controller)
        return

      wordPopover.value = {
        word,
        pos,
        transcription: '',
        translation: 'Не найдено',
        targetRect,
        showAi: true,
        isAiLoading: false,
      }
      toggleAiTranslation()
    }
  }

  async function handleSentenceAnalysis(sentence: string) {
    const readerStore = useReaderStore()
    if (!readerStore.currentBook)
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
      const res = await api.books.analyze(
        readerStore.currentBook.id,
        sentence,
        readerStore.currentBook.language,
        controller.signal,
      )

      if (sentenceAbortController !== controller)
        return

      sidebarAnalysis.value = res
      analysisHistory.value.unshift({
        sentence,
        analysis: res,
        timestamp: Date.now(),
      })
    }
    catch (err: unknown) {
      if (!(err instanceof Error))
        return

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

  async function analyzeWholePage() {
    const readerStore = useReaderStore()
    if (!readerStore.currentPage || !readerStore.currentBook)
      return
    if (isAnalyzingPage.value)
      return

    const sentencesToAnalyze = new Set<string>()

    const extractFromHtml = (html: string) => {
      const regex = /data-raw-sent="([^"]+)"/g
      let match

      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(html)) !== null) {
        sentencesToAnalyze.add(decodeURIComponent(match[1]))
      }
    }

    if (readerStore.currentPage.type === 'manga' && readerStore.currentPage.ocrBlocks) {
      readerStore.currentPage.ocrBlocks.forEach((b) => {
        if (b.html)
          extractFromHtml(b.html)
      })
    }
    else if (readerStore.currentPage.content) {
      extractFromHtml(readerStore.currentPage.content)
    }

    const sentences = Array.from(sentencesToAnalyze).filter(s => s.trim().length > 0)
    if (sentences.length === 0) {
      useToastStore().info('На странице нет предложений для анализа.')
      return
    }

    isAnalyzingPage.value = true
    pageAnalysisTotal.value = sentences.length
    pageAnalysisCurrent.value = 0
    pageAnalysisProgress.value = 0

    pageAnalysisAbortController = new AbortController()
    const signal = pageAnalysisAbortController.signal

    try {
      for (let i = 0; i < sentences.length; i++) {
        if (signal.aborted)
          break
        const sentence = sentences[i]

        const existing = analysisHistory.value.find(h => h.sentence === sentence)
        if (!existing) {
          try {
            const res = await api.books.analyze(
              readerStore.currentBook.id,
              sentence,
              readerStore.currentBook.language,
              signal,
            )
            if (signal.aborted)
              break

            analysisHistory.value.unshift({
              sentence,
              analysis: res,
              timestamp: Date.now(),
            })
          }
          catch (err: unknown) {
            if (!(err instanceof Error))
              return

            if (err.name === 'AbortError')
              break
            console.error('Ошибка анализа предложения:', err)
          }
        }

        pageAnalysisCurrent.value = i + 1
        pageAnalysisProgress.value = Math.round((pageAnalysisCurrent.value / pageAnalysisTotal.value) * 100)
      }

      if (!signal.aborted) {
        useToastStore().success('Анализ страницы завершен!')
      }
    }
    finally {
      isAnalyzingPage.value = false
      pageAnalysisAbortController = null
    }
  }

  // Интеграция со словарем (Модалка и сохранение)
  async function openAddEditWordModal(wordData: WordPopoverData) {
    const readerStore = useReaderStore()

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
        language: readerStore.currentBook?.language || 'en',
      }
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
    activeTokenId,
    wordPopover,
    selectionTooltip,
    sidebarOpen,
    sidebarAnalysis,
    sidebarSentence,
    isAnalyzing,
    analysisHistory,
    isAnalyzingPage,
    pageAnalysisProgress,
    pageAnalysisCurrent,
    pageAnalysisTotal,
    addEditWordModalOpen,
    wordToEdit,

    closePopover,
    closeSelectionTooltip,
    cancelPageAnalysis,
    fetchAiTranslation,
    toggleAiTranslation,
    handleWordClick,
    lookupStandaloneWord,
    handleSentenceAnalysis,
    analyzeWholePage,
    openAddEditWordModal,
    saveWordToDict,
    removeFromDict,
  }
})
