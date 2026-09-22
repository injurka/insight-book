import type { Ref } from 'vue'
import type { PagePayload } from '~/01.shared/types/models'
import { nextTick, onUnmounted, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useReaderStore } from '../store/reader.store'

export function useReaderContinuous(containerRef: Ref<HTMLElement | null>, topSentinelRef: Ref<HTMLElement | null>, bottomSentinelRef: Ref<HTMLElement | null>) {
  const readerStore = useReaderStore()
  const analysisStore = useAnalysisStore()
  const settingsStore = useGlobalSettingsStore()
  const router = useRouter()
  const route = useRoute()

  const continuousPages = shallowRef<PagePayload[]>([])
  const isLoadingNext = ref(false)
  const isLoadingPrev = ref(false)
  const activePageNum = ref(1)

  let topObserver: IntersectionObserver | null = null
  let bottomObserver: IntersectionObserver | null = null
  let pageObserver: IntersectionObserver | null = null
  let autoAnalysisTimer: ReturnType<typeof setTimeout> | null = null
  let bufferGeneration = 0

  function isCurrentBufferRequest(bookId: number, generation: number) {
    return generation === bufferGeneration && readerStore.currentBook?.id === bookId
  }

  function triggerPageAutoAnalysis(page: PagePayload) {
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer)
      autoAnalysisTimer = null
    }

    if (!settingsStore.autoAnalyzePage || analysisStore.isManualPageAnalysisActive)
      return

    const book = readerStore.currentBook
    if (!book || book.language === settingsStore.appLanguage)
      return

    autoAnalysisTimer = setTimeout(() => {
      autoAnalysisTimer = null
      if (
        !settingsStore.autoAnalyzePage
        || analysisStore.isManualPageAnalysisActive
        || readerStore.currentBook?.id !== book.id
        || activePageNum.value !== page.pageNum
      ) {
        return
      }

      analysisStore.analyzeWholePage({
        sentences: settingsStore.autoAnalyzeSentences,
        words: settingsStore.autoAnalyzeWords,
        ttsSentences: settingsStore.autoAnalyzeTtsSentences,
        ttsWords: settingsStore.autoAnalyzeTtsWords,
      }, true)
    }, 1200)
  }

  function onActivePageChange(pageNum: number) {
    if (activePageNum.value === pageNum)
      return

    activePageNum.value = pageNum
    readerStore.targetPageNum = pageNum

    const page = continuousPages.value.find(p => p.pageNum === pageNum)
    if (page) {
      readerStore.currentPage = page
      triggerPageAutoAnalysis(page)
    }

    if (readerStore.currentBook) {
      readerStore.updateReadingProgress(readerStore.currentBook.id, pageNum)
    }

    const currentQueryPage = Number(route.query.page)
    if (currentQueryPage !== pageNum) {
      void router.replace({ query: { ...route.query, page: pageNum } })
    }
  }

  function getNextPageNum(): number | null {
    if (isLoadingNext.value || !readerStore.currentBook)
      return null

    const pages = continuousPages.value
    if (pages.length === 0)
      return null

    const lastPage = pages[pages.length - 1]
    if (!lastPage || lastPage.pageNum >= readerStore.currentBook.totalPages)
      return null

    return lastPage.pageNum + 1
  }

  async function loadNext() {
    const nextNum = getNextPageNum()
    if (nextNum === null || !readerStore.currentBook)
      return

    const bookId = readerStore.currentBook.id
    const generation = bufferGeneration
    isLoadingNext.value = true

    try {
      const page = await readerStore.fetchPage(bookId, nextNum)
      if (!isCurrentBufferRequest(bookId, generation))
        return

      continuousPages.value = [...continuousPages.value, page]
    }
    catch (e) {
      console.warn('[ContinuousReader] Failed to load next page:', e)
    }
    finally {
      isLoadingNext.value = false
    }
  }

  function getPrevPageNum(): number | null {
    if (isLoadingPrev.value || !readerStore.currentBook)
      return null

    const pages = continuousPages.value
    if (pages.length === 0)
      return null

    const firstPage = pages[0]
    if (!firstPage || firstPage.pageNum <= 1)
      return null

    return firstPage.pageNum - 1
  }

  function compensateScroll(container: HTMLElement | null, oldScrollHeight: number, oldScrollTop: number) {
    if (!container)
      return

    const delta = container.scrollHeight - oldScrollHeight
    container.scrollTop = oldScrollTop + delta
  }

  async function loadPrev() {
    const prevNum = getPrevPageNum()
    if (prevNum === null || !readerStore.currentBook)
      return

    const bookId = readerStore.currentBook.id
    const generation = bufferGeneration
    isLoadingPrev.value = true

    const container = containerRef.value
    const oldScrollHeight = container?.scrollHeight ?? 0
    const oldScrollTop = container?.scrollTop ?? 0

    try {
      const page = await readerStore.fetchPage(bookId, prevNum)
      if (!isCurrentBufferRequest(bookId, generation))
        return

      continuousPages.value = [page, ...continuousPages.value]

      await nextTick()
      compensateScroll(container, oldScrollHeight, oldScrollTop)
    }
    catch (e) {
      console.warn('[ContinuousReader] Failed to load previous page:', e)
    }
    finally {
      isLoadingPrev.value = false
    }
  }

  async function jumpToPage(bookId: number, pageNum: number) {
    const existing = continuousPages.value.find(p => p.pageNum === pageNum)
    if (existing && containerRef.value) {
      const el = containerRef.value.querySelector<HTMLElement>(`.reader-page-block[data-page-num="${pageNum}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        onActivePageChange(pageNum)

        return
      }
    }

    const generation = ++bufferGeneration

    try {
      const page = await readerStore.fetchPage(bookId, pageNum)
      if (!isCurrentBufferRequest(bookId, generation))
        return

      continuousPages.value = [page]
      activePageNum.value = pageNum
      readerStore.currentPage = page
      readerStore.targetPageNum = pageNum

      if (containerRef.value) {
        containerRef.value.scrollTop = 0
      }

      onActivePageChange(pageNum)
    }
    catch (e) {
      console.error('[ContinuousReader] Failed to jump to page:', e)
    }
  }

  function setupObservers() {
    cleanupObservers()

    const container = containerRef.value
    if (!container)
      return

    // 1. Top Sentinel Observer (loads previous pages when scrolling up)
    if (topSentinelRef.value) {
      topObserver = new IntersectionObserver((entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          void loadPrev()
        }
      }, {
        root: container,
        rootMargin: '300px 0px 0px 0px',
      })
      topObserver.observe(topSentinelRef.value)
    }

    // 2. Bottom Sentinel Observer (loads next pages when scrolling down)
    if (bottomSentinelRef.value) {
      bottomObserver = new IntersectionObserver((entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          void loadNext()
        }
      }, {
        root: container,
        rootMargin: '600px 0px 600px 0px',
      })
      bottomObserver.observe(bottomSentinelRef.value)
    }

    // 3. Page Spy Observer (detects which page is in viewport)
    pageObserver = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting))
        updateActivePageFromViewport(container)
    }, {
      root: container,
      rootMargin: '-15% 0px -70% 0px',
    })

    observePageBlocks()
  }

  function updateActivePageFromViewport(container: HTMLElement) {
    const activationY = container.getBoundingClientRect().top + container.clientHeight * 0.2
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.reader-page-block'))
    const activeBlock = blocks.find((block) => {
      const rect = block.getBoundingClientRect()

      return rect.top <= activationY && rect.bottom > activationY
    }) ?? blocks.reduce<HTMLElement | null>((closest, block) => {
      if (!closest)
        return block

      const distance = Math.abs(block.getBoundingClientRect().top - activationY)
      const closestDistance = Math.abs(closest.getBoundingClientRect().top - activationY)

      return distance < closestDistance ? block : closest
    }, null)

    const pageNum = Number(activeBlock?.dataset.pageNum)
    if (Number.isInteger(pageNum) && pageNum > 0)
      onActivePageChange(pageNum)
  }

  function observePageBlocks() {
    if (!pageObserver || !containerRef.value)
      return

    const blocks = containerRef.value.querySelectorAll<HTMLElement>('.reader-page-block')
    blocks.forEach((el) => {
      pageObserver?.observe(el)
    })
  }

  function cleanupObservers() {
    if (topObserver) {
      topObserver.disconnect()
      topObserver = null
    }

    if (bottomObserver) {
      bottomObserver.disconnect()
      bottomObserver = null
    }

    if (pageObserver) {
      pageObserver.disconnect()
      pageObserver = null
    }

    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer)
      autoAnalysisTimer = null
    }
  }

  watch(continuousPages, async () => {
    await nextTick()
    observePageBlocks()
  })

  watch([containerRef, topSentinelRef, bottomSentinelRef], async () => {
    await nextTick()
    setupObservers()
  })

  onUnmounted(() => {
    bufferGeneration++
    cleanupObservers()
  })

  return {
    continuousPages,
    isLoadingNext,
    isLoadingPrev,
    activePageNum,
    loadNext,
    loadPrev,
    jumpToPage,
    setupObservers,
  }
}
