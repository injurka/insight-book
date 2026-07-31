import { useRoute, useRouter } from 'vue-router'
import { useReaderStore } from '../store/reader.store'

export function useReaderNavigation(setScrollIntent: (bookId: number, pageNum: number, position: 'top' | 'bottom') => void) {
  const readerStore = useReaderStore()
  const router = useRouter()
  const route = useRoute()

  async function prevPage() {
    if (!readerStore.currentBook || readerStore.isPageLoading)
      return

    const current = readerStore.currentBook.currentPage || 1
    if (current > 1) {
      const newPage = current - 1
      try {
        setScrollIntent(readerStore.currentBook.id, newPage, 'bottom')
        router.replace({ query: { ...route.query, page: newPage } })
        await readerStore.loadPage(readerStore.currentBook.id, newPage)
      }
      catch { }
    }
  }

  async function nextPage() {
    if (!readerStore.currentBook || readerStore.isPageLoading)
      return

    const current = readerStore.currentBook.currentPage || 1
    if (current < readerStore.currentBook.totalPages) {
      const newPage = current + 1
      try {
        setScrollIntent(readerStore.currentBook.id, newPage, 'top')
        router.replace({ query: { ...route.query, page: newPage } })
        await readerStore.loadPage(readerStore.currentBook.id, newPage)
      }
      catch { }
    }
  }

  async function goToPage(pageNum?: number) {
    if (!pageNum || !readerStore.currentBook || readerStore.isPageLoading)
      return

    readerStore.tocOpen = false

    try {
      setScrollIntent(readerStore.currentBook.id, pageNum, 'top')
      router.replace({ query: { ...route.query, page: pageNum } })
      await readerStore.loadPage(readerStore.currentBook.id, pageNum)
    }
    catch { }
  }

  return { prevPage, nextPage, goToPage }
}
