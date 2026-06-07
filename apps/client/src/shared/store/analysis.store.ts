import type { LlmAnalysis, UserDictItem } from '~/shared/types/models'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { i18n } from '~/shared/plugins/i18n'
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
  contextSentence?: string
  contextBookId?: number
  isSaved: boolean
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

  // Whole Page Analysis & TTS
  const isAnalyzingPage = ref(false)
  const isPageAnalysisFinished = ref(false)

  const pageAnalysisSentencesCurrent = ref(0)
  const pageAnalysisSentencesTotal = ref(0)
  const pageAnalysisWordsCurrent = ref(0)
  const pageAnalysisWordsTotal = ref(0)
  const pageAnalysisTtsCurrent = ref(0)
  const pageAnalysisTtsTotal = ref(0)

  // Dictionary Modal
  const addEditWordModalOpen = ref(false)
  const wordToEdit = ref<Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number } | null>(null)

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
    isPageAnalysisFinished.value = false
    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisSentencesTotal.value = 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisWordsTotal.value = 0
    pageAnalysisTtsCurrent.value = 0
    pageAnalysisTtsTotal.value = 0
  }

  function closePageAnalysisModal() {
    cancelPageAnalysis()
  }

  async function fetchAiTranslation() {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()

    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!wordPopover.value || wordPopover.value.aiTranslation || !currentBook)
      return

    const cached = await offlineService.getAnalysis(currentBook.id, wordPopover.value.word)
    if (cached && wordPopover.value) {
      wordPopover.value.aiData = cached
      wordPopover.value.aiTranslation = cached.translation

      const targetWord = wordPopover.value.word
      const vocabMatch = cached.vocabulary?.find(v => v.word.includes(targetWord) || targetWord.includes(v.word))
      wordPopover.value.aiTranscription = cached.transcription || vocabMatch?.transcription || ''
      wordPopover.value.isAiLoading = false
      return
    }

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value.isAiLoading = true
    try {
      const res = await api.books.analyze(
        currentBook.id,
        wordPopover.value.word,
        currentBook.language,
        controller.signal,
      )

      if (wordAbortController !== controller)
        return

      // Сохраняем в оффлайн-кэш
      await offlineService.saveAnalysis(currentBook.id, wordPopover.value.word, res)

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

      if (currentBook && wordPopover.value && wordAbortController === controller) {
        wordPopover.value.aiTranslation = i18n.global.t('analysis.offlineTranslationNotFound')
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

  async function handleWordClick(word: string, pos: string, sentenceId: number, tokenIndex: number, target: HTMLElement, contextSentence?: string) {
    const readerStore = useReaderStore()
    const settingsStore = useGlobalSettingsStore()

    if (!readerStore.currentPage || !readerStore.currentBook)
      return

    closeSelectionTooltip()
    activeTokenId.value = `${sentenceId}-${tokenIndex}`
    const targetRect = target.getBoundingClientRect()

    const entry = readerStore.currentPageDictionary[word] || readerStore.currentPageDictionary[word.toLowerCase()]

    const basePopoverData = {
      word,
      pos,
      targetRect,
      contextSentence,
      contextBookId: readerStore.currentBook.id,
      isSaved: !!entry?.isUserDict,
    }

    if (settingsStore.translationPriority === 'dict') {
      if (wordAbortController)
        wordAbortController.abort()

      if (entry) {
        wordPopover.value = { ...basePopoverData, transcription: entry.transcription, translation: entry.translation, showAi: false, isAiLoading: false }
      }
      else {
        wordPopover.value = { ...basePopoverData, transcription: '', translation: i18n.global.t('analysis.wordNotFoundInDict'), showAi: false, isAiLoading: false }
      }
      return
    }

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value = {
      ...basePopoverData,
      transcription: entry ? entry.transcription : '',
      translation: entry ? entry.translation : i18n.global.t('analysis.wordNotFoundInDict'),
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
        isSaved: !!result.isUserDict,
      }
    }
    catch (err: unknown) {
      if (!(err instanceof Error))
        return

      if (err.name === 'AbortError')
        return
      if (wordAbortController !== controller)
        return

      const settingsStore = useGlobalSettingsStore()
      if (settingsStore.translationPriority === 'dict') {
        wordPopover.value = {
          word,
          pos,
          transcription: '',
          translation: i18n.global.t('analysis.wordNotFoundInDict'),
          targetRect,
          showAi: false,
          isAiLoading: false,
          isSaved: false,
        }
      }
      else {
        wordPopover.value = {
          word,
          pos,
          transcription: '',
          translation: i18n.global.t('analysis.wordNotFoundInDict'),
          targetRect,
          showAi: true,
          isAiLoading: true,
          isSaved: false,
        }
        fetchAiTranslation()
      }
    }
  }

  async function handleSentenceAnalysis(sentence: string) {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()
    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!currentBook)
      return

    sidebarSentence.value = sentence
    sidebarOpen.value = true

    const existing = analysisHistory.value.find(h => h.sentence.trim().toLowerCase() === sentence.trim().toLowerCase())
    if (existing) {
      sidebarAnalysis.value = existing.analysis
      isAnalyzing.value = false
      return
    }

    const cached = await offlineService.getAnalysis(currentBook.id, sentence)
    if (cached) {
      sidebarAnalysis.value = cached
      analysisHistory.value.unshift({
        sentence,
        analysis: cached,
        timestamp: Date.now(),
      })
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
        currentBook.id,
        sentence,
        currentBook.language,
        controller.signal,
      )

      if (sentenceAbortController !== controller)
        return

      await offlineService.saveAnalysis(currentBook.id, sentence, res)

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

      console.error('Ошибка анализа предложения (и нет в кэше):', err)
    }
    finally {
      if (sentenceAbortController === controller) {
        isAnalyzing.value = false
      }
    }
  }

  // Обновленная функция обработки страницы (поддерживает и анализ, и TTS)
  async function analyzeWholePage(options: { sentences: boolean, words: boolean, ttsSentences: boolean, ttsWords: boolean }) {
    const readerStore = useReaderStore()
    if (!readerStore.currentPage || !readerStore.currentBook)
      return
    if (isAnalyzingPage.value)
      return

    const { sentences: doSent, words: doWords, ttsSentences: doTtsSent, ttsWords: doTtsWords } = options

    if (!doSent && !doWords && !doTtsSent && !doTtsWords) {
      useToastStore().info('Выберите хотя бы одно действие.')
      return
    }

    const sentencesToProcess = new Set<string>()
    const wordsToProcess = new Set<string>()

    const extractFromHtml = (html: string) => {
      if (doSent || doTtsSent) {
        const sentRegex = /data-raw-sent="([^"]+)"/g
        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = sentRegex.exec(html)) !== null) {
          sentencesToProcess.add(decodeURIComponent(match[1]))
        }
      }

      if (doWords || doTtsWords) {
        const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = wordRegex.exec(html)) !== null) {
          if (match[2] !== 'x') {
            wordsToProcess.add(decodeURIComponent(match[1]))
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

    const sentences = Array.from(sentencesToProcess).filter(s => /[\p{L}\p{N}]/u.test(s))
    const words = Array.from(wordsToProcess).filter(w => /[\p{L}\p{N}]/u.test(w))

    const totalAnalysisItems = (doSent ? sentences.length : 0) + (doWords ? words.length : 0)
    const totalTtsItems = (doTtsSent ? sentences.length : 0) + (doTtsWords ? words.length : 0)

    if (totalAnalysisItems === 0 && totalTtsItems === 0) {
      useToastStore().info('На странице нет элементов для обработки.')
      return
    }

    isAnalyzingPage.value = true
    isPageAnalysisFinished.value = false

    pageAnalysisSentencesTotal.value = doSent ? sentences.length : 0
    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisWordsTotal.value = doWords ? words.length : 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisTtsTotal.value = totalTtsItems
    pageAnalysisTtsCurrent.value = 0

    pageAnalysisAbortController = new AbortController()
    const signal = pageAnalysisAbortController.signal
    const bookLanguage = readerStore.currentBook.language

    try {
      // 1. Анализ LLM
      if (doSent) {
        for (let i = 0; i < sentences.length; i++) {
          if (signal.aborted)
            break
          const sentence = sentences[i]

          try {
            const cached = await offlineService.getAnalysis(readerStore.currentBook.id, sentence)
            if (!cached) {
              const res = await api.books.analyze(readerStore.currentBook.id, sentence, bookLanguage, signal)
              if (signal.aborted)
                break
              await offlineService.saveAnalysis(readerStore.currentBook.id, sentence, res)
            }
          }
          catch (err: any) {
            if (err.name === 'AbortError')
              break
            console.error('Ошибка анализа предложения:', err)
          }
          pageAnalysisSentencesCurrent.value++
        }
      }

      if (doWords) {
        for (let i = 0; i < words.length; i++) {
          if (signal.aborted)
            break
          const word = words[i]
          try {
            const cached = await offlineService.getAnalysis(readerStore.currentBook.id, word)
            if (!cached) {
              const res = await api.books.analyze(readerStore.currentBook.id, word, bookLanguage, signal)
              if (signal.aborted)
                break
              await offlineService.saveAnalysis(readerStore.currentBook.id, word, res)
            }
          }
          catch (err: any) {
            if (err.name === 'AbortError')
              break
            console.error(`Ошибка анализа слова "${word}":`, err)
          }
          pageAnalysisWordsCurrent.value++
        }
      }

      // 2. Генерация TTS
      if (doTtsSent || doTtsWords) {
        const ttsQueue: string[] = []
        if (doTtsSent)
          ttsQueue.push(...sentences)
        if (doTtsWords)
          ttsQueue.push(...words)

        // Для ускорения делаем небольшую конкурентность, но TTS API часто имеет жесткие лимиты
        const concurrency = 2
        for (let j = 0; j < ttsQueue.length; j += concurrency) {
          if (signal.aborted)
            break
          const batch = ttsQueue.slice(j, j + concurrency)

          await Promise.all(batch.map(async (text) => {
            if (signal.aborted)
              return

            const normalizedText = text.trim().toLowerCase()
            const cacheKey = `${readerStore.currentBook!.id}_${normalizedText}`

            try {
              const cached = await offlineService.getTts(cacheKey)
              if (!cached) {
                const res = await api.books.generateTts(readerStore.currentBook!.id, text, signal)
                await offlineService.saveTts(cacheKey, res.audioBase64)
              }
            }
            catch (err: any) {
              if (err.name !== 'AbortError')
                console.error(`TTS Error for "${text}":`, err)
            }
            pageAnalysisTtsCurrent.value++
          }))
        }
      }

      if (!signal.aborted) {
        useToastStore().success(i18n.global.t('analysis.allElementsAnalyzed'))
        isPageAnalysisFinished.value = true
      }
    }
    finally {
      pageAnalysisAbortController = null
    }
  }

  async function openAddEditWordModal(wordData: WordPopoverData) {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()
    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    try {
      const existingWord = await api.dictionary.get(wordData.word)
      wordToEdit.value = {
        ...existingWord,
        contextSentence: wordData.contextSentence,
        contextBookId: wordData.contextBookId,
      }
    }
    catch {
      const transcription = wordData.showAi ? (wordData.aiTranscription || wordData.transcription) : wordData.transcription
      const translation = wordData.showAi ? (wordData.aiTranslation || wordData.translation) : wordData.translation

      let grammarNote = null
      let vocabularyNote = null
      if (wordData.showAi && wordData.aiData) {
        if (wordData.aiData.grammarRules?.length) {
          grammarNote = wordData.aiData.grammarRules.map(r => `<b>${r.pattern}</b> — ${r.explanation}`).join('<br>')
        }
        if (wordData.aiData.vocabulary?.length) {
          vocabularyNote = wordData.aiData.vocabulary.map(v => `<b>${v.word}</b> (${v.transcription}) — ${v.meaning}`).join('<br>')
        }
      }

      wordToEdit.value = {
        word: wordData.word,
        transcription,
        translation,
        grammarNote,
        vocabularyNote,
        language: currentBook?.language || 'en',
        contextSentence: wordData.contextSentence,
        contextBookId: wordData.contextBookId,
      }
    }
    addEditWordModalOpen.value = true
  }

  async function saveWordToDict(item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }) {
    await api.dictionary.upsert(item)
    addEditWordModalOpen.value = false

    const dictStore = useDictionaryStore()
    await dictStore.fetchDictionary()

    const readerStore = useReaderStore()
    if (item.word) {
      readerStore.currentPageDictionary[item.word] = {
        ...(readerStore.currentPageDictionary[item.word] || {}),
        transcription: item.transcription || '',
        translation: item.translation || '',
        isUserDict: true,
      }
      if (readerStore.currentBook && readerStore.currentPage) {
        await offlineService.savePageDictionary(readerStore.currentBook.id, readerStore.currentPage.pageNum, readerStore.currentPageDictionary)
      }
    }

    if (wordPopover.value && wordPopover.value.word === item.word) {
      wordPopover.value.isSaved = true
    }

    useToastStore().success(`Слово "${item.word}" сохранено`)
  }

  async function removeFromDict(word: string) {
    await api.dictionary.remove(word)
    addEditWordModalOpen.value = false

    const dictStore = useDictionaryStore()
    await dictStore.fetchDictionary()

    const readerStore = useReaderStore()
    if (readerStore.currentPageDictionary[word]) {
      readerStore.currentPageDictionary[word].isUserDict = false
      if (readerStore.currentBook && readerStore.currentPage) {
        await offlineService.savePageDictionary(readerStore.currentBook.id, readerStore.currentPage.pageNum, readerStore.currentPageDictionary)
      }
    }

    if (wordPopover.value && wordPopover.value.word === word) {
      wordPopover.value.isSaved = false
    }

    useToastStore().success(`Слово "${word}" удалено`)
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
    isPageAnalysisFinished,
    pageAnalysisSentencesCurrent,
    pageAnalysisSentencesTotal,
    pageAnalysisWordsCurrent,
    pageAnalysisWordsTotal,
    pageAnalysisTtsCurrent,
    pageAnalysisTtsTotal,

    addEditWordModalOpen,
    wordToEdit,

    closePopover,
    closeSelectionTooltip,
    cancelPageAnalysis,
    closePageAnalysisModal,
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
