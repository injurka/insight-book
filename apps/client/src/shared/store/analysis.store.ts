import type { LlmAnalysis, UserDictItem } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useUmami } from '~/shared/composables/use-umami'
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
  target?: HTMLElement
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

export interface AnalysisTask {
  id: string
  type: 'sentence' | 'word' | 'tts_sentence' | 'tts_word'
  text: string
  context?: string
  priority: number
  status: 'pending' | 'checking_cache' | 'pending_llm' | 'processing' | 'done' | 'error'
}

export const useAnalysisStore = defineStore('analysis', () => {
  const { trackEvent } = useUmami()

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

  // Whole Page Analysis (Manual vs Auto)
  const isManualPageAnalysisActive = ref(false)
  const isAutoPageAnalysisActive = ref(false)
  const isPageAnalysisFinished = ref(false)
  const isPageAnalysisModalOpen = ref(false)

  const pageAnalysisSentencesCurrent = ref(0)
  const pageAnalysisSentencesTotal = ref(0)
  const pageAnalysisWordsCurrent = ref(0)
  const pageAnalysisWordsTotal = ref(0)
  const pageAnalysisTtsCurrent = ref(0)
  const pageAnalysisTtsTotal = ref(0)

  // Smart Queue
  const taskQueue = ref<AnalysisTask[]>([])
  const isQueueProcessing = ref(false)
  const queueTotal = ref(0)
  const queueDone = ref(0)

  const isBackgroundActive = computed(() => taskQueue.value.length > 0 || isQueueProcessing.value)

  let wordAbortController: AbortController | null = null
  let pageAnalysisAbortController: AbortController | null = null
  let manualAnalysisAbortController: AbortController | null = null

  // Dictionary Modal
  const addEditWordModalOpen = ref(false)
  const wordToEdit = ref<Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number } | null>(null)

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

  function clearQueue() {
    taskQueue.value = []
    queueTotal.value = 0
    queueDone.value = 0
  }

  function cancelPageAnalysis() {
    if (pageAnalysisAbortController) {
      pageAnalysisAbortController.abort()
      pageAnalysisAbortController = null
    }

    taskQueue.value = taskQueue.value.filter(t => t.priority !== 0)

    isQueueProcessing.value = false
    isManualPageAnalysisActive.value = false
    isAutoPageAnalysisActive.value = false
    isPageAnalysisFinished.value = false
    isPageAnalysisModalOpen.value = false

    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisSentencesTotal.value = 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisWordsTotal.value = 0
    pageAnalysisTtsCurrent.value = 0
    pageAnalysisTtsTotal.value = 0

    if (taskQueue.value.length === 0) {
      clearQueue()
    }
  }

  function closePageAnalysisModal() {
    cancelPageAnalysis()
  }

  function checkPageAnalysisCompletion() {
    if (!isManualPageAnalysisActive.value && !isAutoPageAnalysisActive.value)
      return

    if (
      pageAnalysisSentencesCurrent.value >= pageAnalysisSentencesTotal.value
      && pageAnalysisWordsCurrent.value >= pageAnalysisWordsTotal.value
      && pageAnalysisTtsCurrent.value >= pageAnalysisTtsTotal.value
    ) {
      isPageAnalysisFinished.value = true

      if (isManualPageAnalysisActive.value) {
        useToastStore().success(i18n.global.t('analysis.allElementsAnalyzed'))
      }

      isManualPageAnalysisActive.value = false
      isAutoPageAnalysisActive.value = false
    }
  }

  async function processQueue() {
    if (isQueueProcessing.value)
      return
    isQueueProcessing.value = true

    pageAnalysisAbortController = new AbortController()
    const signal = pageAnalysisAbortController.signal

    const readerStore = useReaderStore()
    const settingsStore = useGlobalSettingsStore()

    while (taskQueue.value.length > 0 && isQueueProcessing.value) {
      const book = readerStore.currentBook || useLibraryStore().currentBookInfo
      if (!book) {
        clearQueue()
        break
      }

      taskQueue.value.sort((a, b) => b.priority - a.priority)

      // --- ФАЗА 1: Кэширование (IndexedDB + API /cache-check) ---
      const pendingCacheTasks = taskQueue.value.filter(t => (t.type === 'sentence' || t.type === 'word') && t.status === 'pending')

      if (pendingCacheTasks.length > 0) {
        // Берем батч до 200 задач за раз
        const currentChunk = pendingCacheTasks.slice(0, 200)
        currentChunk.forEach(t => t.status = 'checking_cache')

        // 1.1 Параллельная проверка IndexedDB (без bookId)
        const cacheChecks = await Promise.all(
          currentChunk.map(async (task) => {
            const cached = await offlineService.getAnalysis(task.text)
            return { task, cached }
          }),
        )

        const missingInLocalCache: AnalysisTask[] = []

        for (const { task, cached } of cacheChecks) {
          if (cached) {
            handleTaskSuccess(task, cached)
            queueDone.value++
            taskQueue.value = taskQueue.value.filter(t => t.id !== task.id)
          }
          else {
            missingInLocalCache.push(task)
          }
        }

        // 1.2 Массовая проверка кэша на сервере (без LLM)
        if (missingInLocalCache.length > 0) {
          try {
            const textsToCheck = missingInLocalCache.map(t => t.text)
            const uniqueTexts = Array.from(new Set(textsToCheck))

            const res = await api.books.checkCache(book.id, uniqueTexts, book.language, signal)
            const serverCacheMap = new Map(res.results.map((r: any) => [r.sentence, r.analysis]))

            for (const task of missingInLocalCache) {
              const serverCached = serverCacheMap.get(task.text)
              if (serverCached) {
                await offlineService.saveAnalysis(task.text, serverCached)
                handleTaskSuccess(task, serverCached)
                queueDone.value++
                taskQueue.value = taskQueue.value.filter(t => t.id !== task.id)
              }
              else {
                task.status = 'pending_llm'
              }
            }
          }
          catch (e) {
            const err = e as Error
            if (err.name === 'AbortError')
              break
            console.warn('Server cache check failed:', e)
            missingInLocalCache.forEach(t => t.status = 'pending_llm')
          }
        }

        if (!signal.aborted)
          checkPageAnalysisCompletion()
        continue
      }

      // --- ФАЗА 2: Обработка нейросетью ---
      const pendingLlmTasks = taskQueue.value.filter(t => (t.type === 'sentence' || t.type === 'word') && t.status === 'pending_llm')

      if (pendingLlmTasks.length > 0) {
        const batchSize = settingsStore.useCustomLlm ? 1 : 5
        const concurrencyLimit = settingsStore.useCustomLlm ? 1 : 5

        const llmChunk = pendingLlmTasks.slice(0, batchSize * concurrencyLimit)
        llmChunk.forEach(t => t.status = 'processing')

        const batches: AnalysisTask[][] = []
        for (let j = 0; j < llmChunk.length; j += batchSize) {
          batches.push(llmChunk.slice(j, j + batchSize))
        }

        await Promise.all(batches.map(async (batch) => {
          const itemsToAnalyze = batch.map(t => ({ id: t.id, sentence: t.text, context: t.context }))
          try {
            const res = await api.books.analyzeBatch(book.id, itemsToAnalyze, book.language, signal)
            for (const result of res.results) {
              const task = batch.find(it => it.id === result.id)
              if (task) {
                await offlineService.saveAnalysis(task.text, result.analysis)
                handleTaskSuccess(task, result.analysis)
                queueDone.value++
                taskQueue.value = taskQueue.value.filter(t => t.id !== task.id)
              }
            }
          }
          catch (e) {
            const err = e as Error
            if (err.name !== 'AbortError') {
              console.error('Analyze batch error:', err)
            }
            taskQueue.value = taskQueue.value.filter(t => !batch.some(it => it.id === t.id))
            queueDone.value += batch.length
          }
        }))

        if (!signal.aborted)
          checkPageAnalysisCompletion()
        continue
      }

      // --- ФАЗА 3: TTS Озвучка ---
      const ttsTask = taskQueue.value.find(t => t.type.startsWith('tts_') && t.status === 'pending')
      if (ttsTask) {
        ttsTask.status = 'processing'
        try {
          const cacheKey = `${book.id}_${ttsTask.text.trim().toLowerCase()}`
          const cached = await offlineService.getTts(cacheKey)
          if (!cached) {
            const res = await api.books.generateTts(book.id, ttsTask.text, signal)
            await offlineService.saveTts(cacheKey, res.audioBase64)
          }
          if (ttsTask.type === 'tts_sentence')
            pageAnalysisTtsCurrent.value++
          if (ttsTask.type === 'tts_word')
            pageAnalysisTtsCurrent.value++
        }
        catch (e: any) {
          if (e.name === 'AbortError')
            break
          console.error('TTS Task Error:', e)
        }
        finally {
          taskQueue.value = taskQueue.value.filter(t => t.id !== ttsTask.id)
          queueDone.value += 1
          if (!signal.aborted)
            checkPageAnalysisCompletion()
        }
      }
    }

    if (!signal.aborted) {
      isQueueProcessing.value = false
      setTimeout(() => {
        if (taskQueue.value.length === 0) {
          queueTotal.value = 0
          queueDone.value = 0
        }
      }, 2000)
    }
  }

  function handleTaskSuccess(task: AnalysisTask, analysis: LlmAnalysis) {
    if (task.priority === 1 && sidebarSentence.value === task.text) {
      sidebarAnalysis.value = analysis
      analysisHistory.value.unshift({ sentence: task.text, analysis, timestamp: Date.now() })
      isAnalyzing.value = false
    }

    if (task.type === 'sentence')
      pageAnalysisSentencesCurrent.value++
    if (task.type === 'word')
      pageAnalysisWordsCurrent.value++
  }

  async function handleSentenceAnalysis(sentence: string, context?: string) {
    const settingsStore = useGlobalSettingsStore()
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()
    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!currentBook)
      return

    if (manualAnalysisAbortController) {
      manualAnalysisAbortController.abort()
      manualAnalysisAbortController = null
    }

    sidebarSentence.value = sentence
    sidebarOpen.value = true
    sidebarAnalysis.value = null
    isAnalyzing.value = true

    const existing = analysisHistory.value.find(h => h.sentence.trim().toLowerCase() === sentence.trim().toLowerCase())
    if (existing) {
      sidebarAnalysis.value = existing.analysis
      isAnalyzing.value = false
      return
    }

    const cached = await offlineService.getAnalysis(sentence)
    if (cached) {
      sidebarAnalysis.value = cached
      analysisHistory.value.unshift({ sentence, analysis: cached, timestamp: Date.now() })
      isAnalyzing.value = false
      return
    }

    manualAnalysisAbortController = new AbortController()
    const signal = manualAnalysisAbortController.signal

    try {
      const res = await api.books.analyze(currentBook.id, sentence, currentBook.language, context, signal)
      if (signal.aborted)
        return

      await offlineService.saveAnalysis(sentence, res)

      trackEvent('ai_analyze', {
        language: currentBook.language,
        customLlm: settingsStore.useCustomLlm ? 'yes' : 'no',
      })

      if (sidebarSentence.value === sentence) {
        sidebarAnalysis.value = res
        analysisHistory.value.unshift({ sentence, analysis: res, timestamp: Date.now() })
      }
    }
    catch (err: unknown) {
      const e = err as Error
      if (e.name !== 'AbortError') {
        console.error('Manual analyze error:', e)
        useToastStore().error('Ошибка анализа предложения')
      }
    }
    finally {
      if (sidebarSentence.value === sentence && !signal.aborted) {
        isAnalyzing.value = false
      }
    }
  }

  async function analyzeWholePage(options: { sentences: boolean, words: boolean, ttsSentences: boolean, ttsWords: boolean }, isBackground: boolean = false) {
    const readerStore = useReaderStore()

    if (!readerStore.currentPage || !readerStore.currentBook)
      return

    trackEvent('page_analysis_started', {
      sentences: options.sentences,
      words: options.words,
      ttsSentences: options.ttsSentences,
      ttsWords: options.ttsWords,
      isBackground,
    })

    if (!isBackground) {
      cancelPageAnalysis()
      isManualPageAnalysisActive.value = true
      isPageAnalysisModalOpen.value = true
    }
    else {
      if (isManualPageAnalysisActive.value)
        return
      cancelPageAnalysis()
      isAutoPageAnalysisActive.value = true
    }

    const { sentences: doSent, words: doWords, ttsSentences: doTtsSent, ttsWords: doTtsWords } = options

    if (!doSent && !doWords && !doTtsSent && !doTtsWords) {
      if (!isBackground)
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
      if (!isBackground)
        useToastStore().info('На странице нет элементов для обработки.')
      isManualPageAnalysisActive.value = false
      isAutoPageAnalysisActive.value = false
      return
    }

    isPageAnalysisFinished.value = false
    pageAnalysisSentencesTotal.value = doSent ? sentences.length : 0
    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisWordsTotal.value = doWords ? words.length : 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisTtsTotal.value = totalTtsItems
    pageAnalysisTtsCurrent.value = 0

    const newTasks: AnalysisTask[] = []

    if (doSent)
      sentences.forEach(s => newTasks.push({ id: uuidv4(), type: 'sentence', text: s, priority: 0, status: 'pending' }))
    if (doWords)
      words.forEach(w => newTasks.push({ id: uuidv4(), type: 'word', text: w, priority: 0, status: 'pending' }))
    if (doTtsSent)
      sentences.forEach(s => newTasks.push({ id: uuidv4(), type: 'tts_sentence', text: s, priority: 0, status: 'pending' }))
    if (doTtsWords)
      words.forEach(w => newTasks.push({ id: uuidv4(), type: 'tts_word', text: w, priority: 0, status: 'pending' }))

    taskQueue.value.push(...newTasks)
    queueTotal.value += newTasks.length

    processQueue()
  }

  async function fetchAiTranslation() {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()

    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!wordPopover.value || wordPopover.value.aiTranslation || !currentBook)
      return

    const cached = await offlineService.getAnalysis(wordPopover.value.word)
    if (cached && wordPopover.value) {
      wordPopover.value.aiData = cached
      wordPopover.value.aiTranslation = cached.translation

      const targetWord = wordPopover.value.word
      const vocabMatch = cached.vocabulary?.find(v => v?.word && (v.word.includes(targetWord) || targetWord.includes(v.word)))
      wordPopover.value.aiTranscription = cached.transcription || vocabMatch?.transcription || ''
      wordPopover.value.isAiLoading = false
      return
    }

    if (wordAbortController)
      wordAbortController.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value.isAiLoading = true
    trackEvent('ai_translation_requested', { word: wordPopover.value.word })

    try {
      const res = await api.books.analyze(
        currentBook.id,
        wordPopover.value.word,
        currentBook.language,
        undefined,
        controller.signal,
      )

      if (wordAbortController !== controller)
        return

      await offlineService.saveAnalysis(wordPopover.value.word, res)

      if (wordPopover.value) {
        wordPopover.value.aiData = res
        wordPopover.value.aiTranslation = res.translation

        const targetWord = wordPopover.value.word
        const vocabMatch = res.vocabulary?.find(v => v?.word && (v.word.includes(targetWord) || targetWord.includes(v.word)))
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
      target,
      contextSentence,
      contextBookId: readerStore.currentBook.id,
      isSaved: !!entry?.isUserDict,
    }

    if (settingsStore.translationPriority === 'dict' && entry?.translation) {
      if (wordAbortController)
        wordAbortController.abort()

      wordPopover.value = { ...basePopoverData, transcription: entry.transcription, translation: entry.translation, showAi: false, isAiLoading: false }
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
      trackEvent('ai_word_lookup', { word })
      const result = await api.books.lookupWord(bookId, word, controller.signal)
      if (wordAbortController !== controller)
        return

      const settingsStore = useGlobalSettingsStore()

      if (settingsStore.translationPriority === 'dict' && result.translation) {
        wordPopover.value = {
          word,
          pos,
          transcription: result.transcription,
          translation: result.translation,
          targetRect,
          target,
          showAi: false,
          isAiLoading: false,
          isSaved: !!result.isUserDict,
        }
      }
      else {
        wordPopover.value = {
          word,
          pos,
          transcription: result.transcription,
          translation: result.translation || i18n.global.t('analysis.wordNotFoundInDict'),
          targetRect,
          target,
          showAi: true,
          isAiLoading: true,
          isSaved: !!result.isUserDict,
        }
        fetchAiTranslation()
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
        translation: i18n.global.t('analysis.wordNotFoundInDict'),
        targetRect,
        target,
        showAi: true,
        isAiLoading: true,
        isSaved: false,
      }
      fetchAiTranslation()
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
          vocabularyNote = wordData.aiData.vocabulary
            .filter(v => v && v.word)
            .map(v => `<b>${v.word}</b> (${v.transcription || ''}) — ${v.meaning || ''}`)
            .join('<br>')
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

    trackEvent('word_saved_to_dict', { language: item.language })

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

    trackEvent('word_removed_from_dict', { word })

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

    isManualPageAnalysisActive,
    isAutoPageAnalysisActive,
    isPageAnalysisFinished,
    isPageAnalysisModalOpen,
    pageAnalysisSentencesCurrent,
    pageAnalysisSentencesTotal,
    pageAnalysisWordsCurrent,
    pageAnalysisWordsTotal,
    pageAnalysisTtsCurrent,
    pageAnalysisTtsTotal,

    taskQueue,
    isQueueProcessing,
    queueTotal,
    queueDone,
    isBackgroundActive,

    addEditWordModalOpen,
    wordToEdit,

    closePopover,
    closeSelectionTooltip,
    clearQueue,
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
