import type { UserDictItem } from '~/01.shared/types/models'
import { useRepos } from '~/00.plugins/di'
import { appEventBus } from '~/01.shared/events/app-event-bus'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

const repos = useRepos()

export function setupReaderEvents() {
  appEventBus.on('DICTIONARY:WORD_SAVED', async (item: Partial<UserDictItem>) => {
    const readerStore = useReaderStore()

    if (item.word && readerStore.currentPageDictionary[item.word]) {
      readerStore.currentPageDictionary[item.word] = {
        ...(readerStore.currentPageDictionary[item.word] || {}),
        transcription: item.transcription || '',
        translation: item.translation || '',
        isUserDict: true,
      }
      if (readerStore.currentBook && readerStore.currentPage)
        await repos.book.saveLocalPageDictionary(readerStore.currentBook.id, readerStore.currentPage.pageNum, readerStore.currentPageDictionary)
    }
  })

  appEventBus.on('DICTIONARY:WORD_REMOVED', async (word: string) => {
    const readerStore = useReaderStore()
    if (readerStore.currentPageDictionary[word]) {
      readerStore.currentPageDictionary[word].isUserDict = false
      if (readerStore.currentBook && readerStore.currentPage)
        await repos.book.saveLocalPageDictionary(readerStore.currentBook.id, readerStore.currentPage.pageNum, readerStore.currentPageDictionary)
    }
  })
}
