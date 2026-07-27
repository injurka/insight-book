import { useReaderStore } from '../store/reader.store'

export function useReaderNavigation(setScrollIntent: (bookId: number, pageNum: number, position: 'top' | 'bottom') => void) {
  const readerStore = useReaderStore()
  const router = useRouter()
  const route = useRoute()

  async function prevPage() {
    if (readerStore.currentBook && (readerStore.currentBook.currentPage || 1) > 1) {
      const newPage = (readerStore.currentBook.currentPage || 1) - 1
      try {
        setScrollIntent(readerStore.currentBook.id, newPage, 'bottom')
        await readerStore.loadPage(readerStore.currentBook.id, newPage)
        router.replace({ query: { ...route.query, page: newPage } })
      }
      catch { }
    }
  }

  async function nextPage() {
    if (
      readerStore.currentBook
      && (readerStore.currentBook.currentPage || 1) < readerStore.currentBook.totalPages
    ) {
      const newPage = (readerStore.currentBook.currentPage || 1) + 1

      try {
        setScrollIntent(readerStore.currentBook.id, newPage, 'top')
        await readerStore.loadPage(readerStore.currentBook.id, newPage)
        router.replace({ query: { ...route.query, page: newPage } })
      }
      catch { }
    }
  }

  async function goToPage(pageNum?: number) {
    if (!pageNum || !readerStore.currentBook)
      return

    readerStore.tocOpen = false

    try {
      setScrollIntent(readerStore.currentBook.id, pageNum, 'top')
      await readerStore.loadPage(readerStore.currentBook.id, pageNum)
      router.replace({ query: { ...route.query, page: pageNum } })
    }
    catch { }
  }

  return { prevPage, nextPage, goToPage }
}
