import type { LlmAnalysis, UserDictItem } from '~/shared/types/models'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
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

      // Сохраняем в оффлайн-кэш
      await offlineService.saveAnalysis(readerStore.currentBook.id, wordPopover.value.word, res)

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

      if (readerStore.currentBook && wordPopover.value) {
        const cached = await offlineService.getAnalysis(readerStore.currentBook.id, wordPopover.value.word)

        if (cached && wordAbortController === controller && wordPopover.value) {
          wordPopover.value.aiData = cached
          wordPopover.value.aiTranslation = cached.translation

          const targetWord = wordPopover.value.word
          const vocabMatch = cached.vocabulary?.find(v => v.word.includes(targetWord) || targetWord.includes(v.word))
          wordPopover.value.aiTranscription = cached.transcription || vocabMatch?.transcription || ''
        }
        else if (wordPopover.value && wordAbortController === controller) {
          wordPopover.value.aiTranslation = 'Оффлайн: перевод не найден в кэше'
        }
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
    const settingsStore = useGlobalSettingsStore()

    if (!readerStore.currentPage || !readerStore.currentBook)
      return

    closeSelectionTooltip()
    activeTokenId.value = `${sentenceId}-${tokenIndex}`
    const targetRect = target.getBoundingClientRect()

    const entry = readerStore.currentPage.pageDictionary[word]

    // Если есть перевод в локальном словаре страницы и приоритет "Словарь"
    if (entry && settingsStore.translationPriority === 'dict') {
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

    // Если приоритет LLM, или нет локального перевода
    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value = {
      word,
      pos,
      // В качестве плейсхолдера сразу показываем то, что есть
      transcription: entry ? entry.transcription : '',
      translation: entry ? entry.translation : 'Поиск перевода...',
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

      // Сохраняем в оффлайн-кэш
      await offlineService.saveAnalysis(readerStore.currentBook.id, sentence, res)

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

      if (readerStore.currentBook) {
        const cached = await offlineService.getAnalysis(readerStore.currentBook.id, sentence)

        if (cached && sentenceAbortController === controller) {
          sidebarAnalysis.value = cached
          analysisHistory.value.unshift({
            sentence,
            analysis: cached,
            timestamp: Date.now(),
          })
        }
        else {
          console.error('Ошибка анализа предложения (и нет в кэше):', err)
        }
      }
    }
    finally {
      if (sentenceAbortController === controller) {
        isAnalyzing.value = false
      }
    }
  }

  async function analyzeWholePage(mode: 'sentences' | 'words' | 'all' = 'sentences') {
    const readerStore = useReaderStore()
    if (!readerStore.currentPage || !readerStore.currentBook)
      return
    if (isAnalyzingPage.value)
      return

    const sentencesToAnalyze = new Set<string>()
    const wordsToAnalyze = new Set<string>()

    const extractFromHtml = (html: string) => {
      // Извлекаем предложения
      if (mode === 'sentences' || mode === 'all') {
        const sentRegex = /data-raw-sent="([^"]+)"/g
        let match
        while ((match = sentRegex.exec(html)) !== null) {
          sentencesToAnalyze.add(decodeURIComponent(match[1]))
        }
      }

      // Извлекаем уникальные слова
      if (mode === 'words' || mode === 'all') {
        const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
        let match
        while ((match = wordRegex.exec(html)) !== null) {
          if (match[2] !== 'x') { // Игнорируем пунктуацию
            wordsToAnalyze.add(decodeURIComponent(match[1]))
          }
        }
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

    // Отсеиваем фрагменты, в которых нет букв или цифр
    const sentences = Array.from(sentencesToAnalyze).filter(s => /[\p{L}\p{N}]/u.test(s))
    const words = Array.from(wordsToAnalyze).filter(w => /[\p{L}\p{N}]/u.test(w))

    const totalItems = sentences.length + words.length
    if (totalItems === 0) {
      useToastStore().info('На странице нет элементов для анализа.')
      return
    }

    isAnalyzingPage.value = true
    pageAnalysisTotal.value = totalItems
    pageAnalysisCurrent.value = 0
    pageAnalysisProgress.value = 0

    pageAnalysisAbortController = new AbortController()
    const signal = pageAnalysisAbortController.signal

    try {
      // 1. Анализируем предложения
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

            await offlineService.saveAnalysis(readerStore.currentBook.id, sentence, res)

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

            if (readerStore.currentBook) {
              const cached = await offlineService.getAnalysis(readerStore.currentBook.id, sentence)
              if (cached) {
                analysisHistory.value.unshift({
                  sentence,
                  analysis: cached,
                  timestamp: Date.now(),
                })
              }
              else {
                console.error('Ошибка анализа предложения:', err)
              }
            }
          }
        }

        pageAnalysisCurrent.value++
        pageAnalysisProgress.value = Math.round((pageAnalysisCurrent.value / pageAnalysisTotal.value) * 100)
      }

      // 2. Анализируем слова
      for (let i = 0; i < words.length; i++) {
        if (signal.aborted)
          break
        const word = words[i]

        try {
          // Для слов мы не добавляем их в HistorySidebar, только сохраняем в оффлайн-кэш
          // для мгновенного отображения во всплывающем окне по клику.
          let cached = null
          if (readerStore.currentBook) {
            cached = await offlineService.getAnalysis(readerStore.currentBook.id, word)
          }

          if (!cached && readerStore.currentBook) {
            const res = await api.books.analyze(
              readerStore.currentBook.id,
              word,
              readerStore.currentBook.language,
              signal,
            )
            if (signal.aborted)
              break

            await offlineService.saveAnalysis(readerStore.currentBook.id, word, res)
          }
        }
        catch (err: unknown) {
          if (!(err instanceof Error))
            return

          if (err.name === 'AbortError')
            break
          console.error(`Ошибка анализа слова "${word}":`, err)
        }

        pageAnalysisCurrent.value++
        pageAnalysisProgress.value = Math.round((pageAnalysisCurrent.value / pageAnalysisTotal.value) * 100)
      }

      if (!signal.aborted) {
        useToastStore().success('Анализ завершен!')
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
