import type { Book, LlmAnalysis, PagePayload, UserDictItem } from '~/01.shared/types/models'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { useUmami } from '~/01.shared/composables/use-umami'
import { appEventBus } from '~/01.shared/events/app-event-bus'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useToastStore } from '~/01.shared/store/toast.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

export interface WordPopoverData {
  word: string
  pos: string
  transcription: string
  translation: string
  targetRect: DOMRect
  target?: HTMLElement
  isLoading: boolean
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

export interface GrammarPopoverData {
  pattern: string
  explanation: string
  example: string
  target: HTMLElement
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
  const repos = useRepos()
  const { trackEvent } = useUmami()

  // Popovers & Tooltips
  const activeTokenId = ref<string | null>(null)
  const wordPopover = ref<WordPopoverData | null>(null)
  const selectionTooltip = ref<SelectionTooltipData | null>(null)
  const grammarPopover = ref<GrammarPopoverData | null>(null)

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
  const isPageAnalysisSetupModalOpen = ref(false)
  const pageActionOpts = ref({
    sentences: true,
    words: false,
    ttsSentences: false,
    ttsWords: false,
  })

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
    grammarPopover.value = null
  }

  function closeSelectionTooltip() {
    selectionTooltip.value = null
  }

  function openGrammarPopover(
    pattern: string,
    explanation: string,
    example: string,
    target: HTMLElement,
  ) {
    closePopover()
    closeSelectionTooltip()
    grammarPopover.value = {
      pattern,
      explanation,
      example,
      target,
    }
  }

  function closeGrammarPopover() {
    grammarPopover.value = null
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
    isPageAnalysisSetupModalOpen.value = false

    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisSentencesTotal.value = 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisWordsTotal.value = 0
    pageAnalysisTtsCurrent.value = 0
    pageAnalysisTtsTotal.value = 0

    if (taskQueue.value.length === 0)
      clearQueue()
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

      if (isManualPageAnalysisActive.value)
        useToastStore().success(i18n.global.t('analysis.allElementsAnalyzed'))

      isManualPageAnalysisActive.value = false
      isAutoPageAnalysisActive.value = false
    }
  }

  async function processPhase1(book: Book, signal: AbortSignal) {
    const pendingCacheTasks = taskQueue.value.filter(taskItem => (taskItem.type === 'sentence' || taskItem.type === 'word') && taskItem.status === 'pending')
    if (pendingCacheTasks.length === 0)
      return false

    const currentChunk = pendingCacheTasks.slice(0, 200)
    currentChunk.forEach(taskItem => taskItem.status = 'checking_cache')

    const cacheChecks = await Promise.all(currentChunk.map(async (task) => {
      const cached = await repos.analysis.getLocalAnalysis(task.text)

      return { task, cached }
    }))

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

    if (missingInLocalCache.length > 0) {
      try {
        const uniqueMap = new Map<string, 'sentence' | 'word'>()
        missingInLocalCache.forEach(t => uniqueMap.set(t.text, t.type === 'sentence' ? 'sentence' : 'word'))
        const itemsToCheck = Array.from(uniqueMap.entries()).map(([text, type]) => ({ text, type }))

        const res = await repos.analysis.checkCache(
          book.id,
          itemsToCheck,
          book.language,
          signal,
        )
        const serverCacheMap = new Map(res.results.map(result => [result.sentence, result.analysis]))

        for (const task of missingInLocalCache) {
          const serverCached = serverCacheMap.get(task.text) as LlmAnalysis
          if (serverCached) {
            await repos.analysis.saveLocalAnalysis(task.text, serverCached)
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
        if (err.name !== 'AbortError')
          console.warn('Server cache check failed:', e)
        missingInLocalCache.forEach(t => t.status = 'pending_llm')
      }
    }

    if (!signal.aborted)
      checkPageAnalysisCompletion()

    return true
  }

  async function processPhase2(book: Book, signal: AbortSignal) {
    const settingsStore = useGlobalSettingsStore()
    const pendingLlmTasks = taskQueue.value.filter(taskItem => (taskItem.type === 'sentence' || taskItem.type === 'word') && taskItem.status === 'pending_llm')
    if (pendingLlmTasks.length === 0)
      return false

    const batchSize = settingsStore.useCustomLlm ? 1 : 5
    const concurrencyLimit = settingsStore.useCustomLlm ? 1 : 5

    const llmChunk = pendingLlmTasks.slice(0, batchSize * concurrencyLimit)
    llmChunk.forEach(taskItem => taskItem.status = 'processing')

    const batches: AnalysisTask[][] = []
    for (let j = 0; j < llmChunk.length; j += batchSize)
      batches.push(llmChunk.slice(j, j + batchSize))

    await Promise.all(batches.map(async (batch) => {
      const itemsToAnalyze = batch.map(t => ({
        id: t.id,
        sentence: t.text,
        context: t.context,
        type: (t.type === 'sentence' ? 'sentence' : 'word') as 'sentence' | 'word',
      }))

      try {
        const res = await repos.analysis.analyzeBatch(
          book.id,
          itemsToAnalyze,
          book.language,
          signal,
        )
        for (const result of res.results) {
          const task = batch.find(it => it.id === result.id)
          if (task) {
            await repos.analysis.saveLocalAnalysis(task.text, result.analysis)
            handleTaskSuccess(task, result.analysis)
            queueDone.value++
            taskQueue.value = taskQueue.value.filter(t => t.id !== task.id)
          }
        }
      }
      catch (e) {
        const err = e as Error
        if (err.name !== 'AbortError')
          console.error('Analyze batch error:', err)
        taskQueue.value = taskQueue.value.filter(t => !batch.some(it => it.id === t.id))
        queueDone.value += batch.length
      }
    }))

    if (!signal.aborted)
      checkPageAnalysisCompletion()

    return true
  }

  async function processPhase3(book: Book, signal: AbortSignal) {
    const settingsStore = useGlobalSettingsStore()
    const ttsTask = taskQueue.value.find(taskItem => taskItem.type.startsWith('tts_') && taskItem.status === 'pending')
    if (!ttsTask)
      return false

    ttsTask.status = 'processing'
    try {
      const voice = settingsStore.ttsVoice || 'Kore'
      const cacheKey = `${book.id}_${voice}_${ttsTask.text.trim().toLowerCase()}`
      const cached = await repos.analysis.getLocalTts(cacheKey)
      if (!cached) {
        const res = await repos.analysis.generateTts(
          book.id,
          ttsTask.text,
          voice,
          signal,
        )
        await repos.analysis.saveLocalTts(cacheKey, res.audioBase64)
      }

      if (ttsTask.type === 'tts_sentence')
        pageAnalysisTtsCurrent.value++
      if (ttsTask.type === 'tts_word')
        pageAnalysisTtsCurrent.value++
    }
    catch (e: unknown) {
      if ((e as Error).name !== 'AbortError')
        console.error('TTS Task Error:', e)
    }
    finally {
      taskQueue.value = taskQueue.value.filter(t => t.id !== ttsTask.id)
      queueDone.value += 1
      if (!signal.aborted)
        checkPageAnalysisCompletion()
    }

    return true
  }

  async function processQueueStep(book: Book, signal: AbortSignal): Promise<boolean> {
    taskQueue.value.sort((a, b) => b.priority - a.priority)

    let processed = false
    if (await processPhase1(book, signal) || await processPhase2(book, signal) || await processPhase3(book, signal)) {
      processed = true
    }

    return processed
  }

  async function processQueue() {
    if (isQueueProcessing.value)
      return
    isQueueProcessing.value = true

    pageAnalysisAbortController = new AbortController()
    const signal = pageAnalysisAbortController.signal

    const readerStore = useReaderStore()

    while (taskQueue.value.length > 0 && isQueueProcessing.value) {
      const book = readerStore.currentBook || useLibraryStore().currentBookInfo
      if (!book) {
        clearQueue()
        break
      }

      const processed = await processQueueStep(book, signal)

      if (signal.aborted)
        break
      if (processed)
        continue
      break
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
      isAnalyzing.value = false
    }

    if (task.type === 'sentence') {
      const exists = analysisHistory.value.find(historyItem => historyItem.sentence === task.text)
      if (!exists)
        analysisHistory.value.unshift({ sentence: task.text, analysis, timestamp: Date.now() })

      pageAnalysisSentencesCurrent.value++
    }

    if (task.type === 'word')
      pageAnalysisWordsCurrent.value++
  }

  function getSentenceCachedAnalysis(sentence: string) {
    const existing = analysisHistory.value.find(historyItem => historyItem.sentence.trim().toLowerCase() === sentence.trim().toLowerCase())

    return existing ? existing.analysis : null
  }

  async function checkAndApplyCachedSentence(sentence: string): Promise<boolean> {
    const historyCached = getSentenceCachedAnalysis(sentence)
    if (historyCached) {
      sidebarAnalysis.value = historyCached
      isAnalyzing.value = false

      return true
    }

    const cached = await repos.analysis.getLocalAnalysis(sentence)
    if (cached) {
      sidebarAnalysis.value = cached
      analysisHistory.value.unshift({ sentence, analysis: cached, timestamp: Date.now() })
      isAnalyzing.value = false

      return true
    }

    return false
  }

  async function performSentenceAnalysis(
    currentBook: Book,
    sentence: string,
    context: string | undefined,
    signal: AbortSignal,
    settingsStore: ReturnType<typeof useGlobalSettingsStore>,
  ) {
    try {
      const res = await repos.analysis.analyze(
        currentBook.id,
        sentence,
        currentBook.language,
        context,
        signal,
        'sentence',
      )
      if (signal.aborted)
        return

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
  }

  async function handleSentenceAnalysis(sentence: string, context?: string) {
    const settingsStore = useGlobalSettingsStore()
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()
    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!currentBook || currentBook.language === settingsStore.appLanguage)
      return

    manualAnalysisAbortController?.abort()
    manualAnalysisAbortController = null

    sidebarSentence.value = sentence
    sidebarOpen.value = true
    sidebarAnalysis.value = null
    isAnalyzing.value = true

    if (await checkAndApplyCachedSentence(sentence))
      return

    manualAnalysisAbortController = new AbortController()
    const signal = manualAnalysisAbortController.signal

    await performSentenceAnalysis(
      currentBook,
      sentence,
      context,
      signal,
      settingsStore,
    )

    if (sidebarSentence.value === sentence && !signal.aborted)
      isAnalyzing.value = false
  }

  function createAnalysisTasks(sentences: string[], words: string[], options: { doSent: boolean, doWords: boolean, doTtsSent: boolean, doTtsWords: boolean }): AnalysisTask[] {
    const tasks: AnalysisTask[] = []
    if (options.doSent) {
      sentences.forEach(text => tasks.push({
        id: uuidv4(),
        type: 'sentence',
        text,
        priority: 0,
        status: 'pending',
      }))
    }

    if (options.doWords) {
      words.forEach(text => tasks.push({
        id: uuidv4(),
        type: 'word',
        text,
        priority: 0,
        status: 'pending',
      }))
    }

    if (options.doTtsSent) {
      sentences.forEach(text => tasks.push({
        id: uuidv4(),
        type: 'tts_sentence',
        text,
        priority: 0,
        status: 'pending',
      }))
    }

    if (options.doTtsWords) {
      words.forEach(text => tasks.push({
        id: uuidv4(),
        type: 'tts_word',
        text,
        priority: 0,
        status: 'pending',
      }))
    }

    return tasks
  }

  function extractPageTexts(currentPage: PagePayload, options: { sentences: boolean, words: boolean, ttsSentences: boolean, ttsWords: boolean }) {
    const sentencesToProcess = new Set<string>()
    const wordsToProcess = new Set<string>()
    const { sentences: doSent, words: doWords, ttsSentences: doTtsSent, ttsWords: doTtsWords } = options

    const extractFromHtml = (html: string) => {
      if (doSent || doTtsSent) {
        const sentRegex = /data-raw-sent="([^"]+)"/g
        let match = sentRegex.exec(html)
        while (match !== null) {
          sentencesToProcess.add(decodeURIComponent(match[1]))
          match = sentRegex.exec(html)
        }
      }

      if (doWords || doTtsWords) {
        const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
        let match = wordRegex.exec(html)
        while (match !== null) {
          if (match[2] !== 'x')
            wordsToProcess.add(decodeURIComponent(match[1]))
          match = wordRegex.exec(html)
        }
      }
    }

    if (currentPage.type === 'manga' && currentPage.ocrBlocks) {
      currentPage.ocrBlocks.forEach((b) => {
        if (b.html)
          extractFromHtml(b.html)
      })
    }
    else if (currentPage.content) {
      extractFromHtml(currentPage.content)
    }

    const sentences = Array.from(sentencesToProcess).filter(sentence => /[\p{L}\p{N}]/u.test(sentence))
    const words = Array.from(wordsToProcess).filter(word => /[\p{L}\p{N}]/u.test(word))

    return { sentences, words }
  }

  function setupPageAnalysisState(isBackground: boolean): boolean {
    if (isBackground && isManualPageAnalysisActive.value)
      return false

    cancelPageAnalysis()
    if (!isBackground) {
      isManualPageAnalysisActive.value = true
      isPageAnalysisModalOpen.value = true
    }
    else {
      isAutoPageAnalysisActive.value = true
    }

    return true
  }

  function initPageAnalysisProgress(
    sentences: string[],
    words: string[],
    doSent: boolean,
    doWords: boolean,
    totalTtsItems: number,
  ) {
    isPageAnalysisFinished.value = false
    pageAnalysisSentencesTotal.value = doSent ? sentences.length : 0
    pageAnalysisSentencesCurrent.value = 0
    pageAnalysisWordsTotal.value = doWords ? words.length : 0
    pageAnalysisWordsCurrent.value = 0
    pageAnalysisTtsTotal.value = totalTtsItems
    pageAnalysisTtsCurrent.value = 0
  }

  function checkOptionsSelected(options: { sentences: boolean, words: boolean, ttsSentences: boolean, ttsWords: boolean }, isBackground: boolean): boolean {
    const { sentences: doSent, words: doWords, ttsSentences: doTtsSent, ttsWords: doTtsWords } = options
    if (!doSent && !doWords && !doTtsSent && !doTtsWords) {
      if (!isBackground)
        useToastStore().info('Выберите хотя бы одно действие.')

      return false
    }

    return true
  }

  function calculateTotalItems(
    doActive: boolean,
    activeLen: number,
    doOther: boolean,
    otherLen: number,
  ): number {
    return (doActive ? activeLen : 0) + (doOther ? otherLen : 0)
  }

  async function analyzeWholePage(options: { sentences: boolean, words: boolean, ttsSentences: boolean, ttsWords: boolean }, isBackground: boolean = false) {
    const readerStore = useReaderStore()
    const settingsStore = useGlobalSettingsStore()

    if (!readerStore.currentPage || !readerStore.currentBook)
      return

    if (readerStore.currentBook.language === settingsStore.appLanguage)
      return

    trackEvent('page_analysis_started', {
      sentences: options.sentences,
      words: options.words,
      ttsSentences: options.ttsSentences,
      ttsWords: options.ttsWords,
      isBackground,
    })

    if (!setupPageAnalysisState(isBackground))
      return

    if (!checkOptionsSelected(options, isBackground))
      return

    const { sentences: doSent, words: doWords, ttsSentences: doTtsSent, ttsWords: doTtsWords } = options
    const { sentences, words } = extractPageTexts(readerStore.currentPage, options)

    const totalAnalysisItems = calculateTotalItems(
      doSent,
      sentences.length,
      doWords,
      words.length,
    )
    const totalTtsItems = calculateTotalItems(
      doTtsSent,
      sentences.length,
      doTtsWords,
      words.length,
    )

    if (totalAnalysisItems === 0 && totalTtsItems === 0) {
      if (!isBackground)
        useToastStore().info('На странице нет элементов для обработки.')
      isManualPageAnalysisActive.value = false
      isAutoPageAnalysisActive.value = false

      return
    }

    initPageAnalysisProgress(
      sentences,
      words,
      doSent,
      doWords,
      totalTtsItems,
    )

    const newTasks: AnalysisTask[] = createAnalysisTasks(sentences, words, {
      doSent,
      doWords,
      doTtsSent,
      doTtsWords,
    })

    taskQueue.value.push(...newTasks)
    queueTotal.value += newTasks.length

    processQueue()
  }

  function applyAiAnalysisData(analysisData: LlmAnalysis) {
    if (!wordPopover.value)
      return
    wordPopover.value.aiData = analysisData
    if (!wordPopover.value.translation || wordPopover.value.translation === i18n.global.t('analysis.wordNotFoundInDict')) {
      wordPopover.value.translation = analysisData.translation
    }

    const targetWord = wordPopover.value.word
    const vocabMatch = analysisData.vocabulary?.find(vocabItem => vocabItem?.word && (vocabItem.word.includes(targetWord) || targetWord.includes(vocabItem.word)))
    if (!wordPopover.value.transcription) {
      wordPopover.value.transcription = analysisData.transcription || vocabMatch?.transcription || ''
    }
  }

  async function checkAndApplyCachedTranslation(word: string): Promise<boolean> {
    const cached = await repos.analysis.getLocalAnalysis(word)
    if (cached && wordPopover.value) {
      applyAiAnalysisData(cached)
      wordPopover.value.isLoading = false

      return true
    }

    return false
  }

  async function performAiTranslation(currentBook: Book, word: string, controller: AbortController) {
    try {
      const res = await repos.analysis.analyze(
        currentBook.id,
        word,
        currentBook.language,
        undefined,
        controller.signal,
        'word',
      )

      if (wordAbortController === controller)
        applyAiAnalysisData(res)
    }
    catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError' && wordPopover.value && wordAbortController === controller) {
        if (!wordPopover.value.translation) {
          wordPopover.value.translation = i18n.global.t('analysis.offlineTranslationNotFound')
        }
      }
    }
    finally {
      if (wordPopover.value && wordAbortController === controller)
        wordPopover.value.isLoading = false
    }
  }

  async function fetchAiTranslation() {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()

    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    if (!wordPopover.value || wordPopover.value.aiData || !currentBook)
      return

    const word = wordPopover.value.word
    if (await checkAndApplyCachedTranslation(word))
      return

    wordAbortController?.abort()
    const controller = new AbortController()
    wordAbortController = controller

    wordPopover.value.isLoading = true
    trackEvent('ai_translation_requested', { word })

    await performAiTranslation(currentBook, word, controller)
  }

  function prepareWordPopover(
    word: string,
    pos: string,
    targetRect: DOMRect,
    target: HTMLElement,
    contextSentence: string | undefined,
    bookId: number,
    entry: { isUserDict?: boolean, transcription?: string, translation?: string } | undefined,
  ) {
    wordPopover.value = {
      word,
      pos,
      targetRect,
      target,
      contextSentence,
      contextBookId: bookId,
      isSaved: !!entry?.isUserDict,
      transcription: entry?.transcription || '',
      translation: entry?.translation || '',
      isLoading: true,
    }
  }

  async function handleWordClick(
    word: string,
    pos: string,
    sentenceId: number,
    tokenIndex: number,
    target: HTMLElement,
    contextSentence?: string,
  ) {
    const readerStore = useReaderStore()
    const settingsStore = useGlobalSettingsStore()
    const { currentPage, currentBook, currentPageDictionary } = readerStore

    if (!currentPage || !currentBook || currentBook.language === settingsStore.appLanguage)
      return

    closeSelectionTooltip()
    activeTokenId.value = `${sentenceId}-${tokenIndex}`

    const entry = currentPageDictionary[word] || currentPageDictionary[word.toLowerCase()]

    wordAbortController?.abort()
    const controller = new AbortController()
    wordAbortController = controller

    prepareWordPopover(
      word,
      pos,
      target.getBoundingClientRect(),
      target,
      contextSentence,
      currentBook.id,
      entry,
    )

    fetchAiTranslation()
  }

  function applyStandaloneWordResult(
    result: { transcription: string, translation: string, isUserDict?: boolean },
    word: string,
    pos: string,
    targetRect: DOMRect,
    target: HTMLElement,
  ) {
    wordPopover.value = {
      word,
      pos,
      transcription: result.transcription || '',
      translation: result.translation || '',
      targetRect,
      target,
      isLoading: true,
      isSaved: !!result.isUserDict,
    }
    fetchAiTranslation()
  }

  async function performStandaloneWordLookup(
    bookId: number,
    word: string,
    pos: string,
    targetRect: DOMRect,
    target: HTMLElement,
    controller: AbortController,
  ) {
    try {
      trackEvent('ai_word_lookup', { word })
      const result = await repos.analysis.lookupWord(bookId, word, controller.signal)
      if (wordAbortController !== controller)
        return

      applyStandaloneWordResult(
        result,
        word,
        pos,
        targetRect,
        target,
      )
    }
    catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError' && wordAbortController === controller) {
        wordPopover.value = {
          word,
          pos,
          transcription: '',
          translation: '',
          targetRect,
          target,
          isLoading: true,
          isSaved: false,
        }
        fetchAiTranslation()
      }
    }
  }

  async function lookupStandaloneWord(word: string, pos: string, target: HTMLElement) {
    const libraryStore = useLibraryStore()
    const readerStore = useReaderStore()

    const bookLanguage = libraryStore.currentBookInfo?.language || readerStore.currentBook?.language
    const bookId = libraryStore.currentBookInfo?.id || readerStore.currentBook?.id
    if (!bookId)
      return

    const settingsStore = useGlobalSettingsStore()
    if (bookLanguage === settingsStore.appLanguage)
      return

    closeSelectionTooltip()
    const targetRect = target.getBoundingClientRect()

    wordAbortController?.abort()
    const controller = new AbortController()
    wordAbortController = controller

    await performStandaloneWordLookup(
      bookId,
      word,
      pos,
      targetRect,
      target,
      controller,
    )
  }

  function buildAiNotes(aiData?: LlmAnalysis) {
    if (!aiData)
      return { grammarNote: null, vocabularyNote: null }

    const grammarNote = aiData.grammarRules?.length
      ? aiData.grammarRules.map(rule => `<b>${rule.pattern}</b> — ${rule.explanation}`).join('<br>')
      : null

    const vocabularyNote = aiData.vocabulary?.length
      ? aiData.vocabulary
          .filter(vocabItem => vocabItem && vocabItem.word)
          .map(vocabItem => `<b>${vocabItem.word}</b> (${vocabItem.transcription || ''}) — ${vocabItem.meaning || ''}`)
          .join('<br>')
      : null

    return { grammarNote, vocabularyNote }
  }

  async function openAddEditWordModal(wordData: WordPopoverData) {
    const readerStore = useReaderStore()
    const libraryStore = useLibraryStore()
    const currentBook = readerStore.currentBook || libraryStore.currentBookInfo

    try {
      const existingWord = await repos.dictionary.get(wordData.word)
      wordToEdit.value = {
        ...existingWord,
        contextSentence: wordData.contextSentence,
        contextBookId: wordData.contextBookId,
      }
    }
    catch {
      const { grammarNote, vocabularyNote } = buildAiNotes(wordData.aiData)

      wordToEdit.value = {
        word: wordData.word,
        transcription: wordData.transcription,
        translation: wordData.translation,
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
    const settingsStore = useGlobalSettingsStore()
    if (item.language === settingsStore.appLanguage) {
      useToastStore().info(i18n.global.t('dictionary.cannotSaveSameLanguage'))

      return
    }

    addEditWordModalOpen.value = false

    trackEvent('word_saved_to_dict', { language: item.language })

    appEventBus.emit('DICTIONARY:REQUEST_SAVE_WORD', item)

    if (wordPopover.value && wordPopover.value.word === item.word)
      wordPopover.value.isSaved = true
  }

  async function removeFromDict(word: string) {
    addEditWordModalOpen.value = false

    trackEvent('word_removed_from_dict', { word })

    appEventBus.emit('DICTIONARY:REQUEST_REMOVE_WORD', word)

    if (wordPopover.value && wordPopover.value.word === word)
      wordPopover.value.isSaved = false
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
    isPageAnalysisSetupModalOpen,
    pageActionOpts,
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

    grammarPopover,
    openGrammarPopover,
    closeGrammarPopover,
    closePopover,
    closeSelectionTooltip,
    clearQueue,
    cancelPageAnalysis,
    closePageAnalysisModal,
    fetchAiTranslation,
    handleWordClick,
    lookupStandaloneWord,
    handleSentenceAnalysis,
    analyzeWholePage,
    openAddEditWordModal,
    saveWordToDict,
    removeFromDict,
  }
})
