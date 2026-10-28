import type { UserDictItem } from '~/01.shared/types/models'
import { normalizeLanguageCode } from '@injurka/insight-book-language-utils'
import { useRepos } from '~/00.plugins/di'
import { appEventBus } from '~/01.shared/events/app-event-bus'
import { useReaderStore } from '~/05.modules/reader'

const repos = useRepos()

export function setupReaderEvents() {
  appEventBus.on('DICTIONARY:WORD_SAVED', async (item: Partial<UserDictItem>) => {
    const readerStore = useReaderStore()

    if (item.language === normalizeLanguageCode(readerStore.currentBook?.language) && item.word && readerStore.currentPageDictionary[item.word]) {
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

  appEventBus.on('DICTIONARY:WORD_REMOVED', async ({ word, language }) => {
    const readerStore = useReaderStore()

    if (language === normalizeLanguageCode(readerStore.currentBook?.language) && readerStore.currentPageDictionary[word]) {
      readerStore.currentPageDictionary[word].isUserDict = false

      if (readerStore.currentBook && readerStore.currentPage)
        await repos.book.saveLocalPageDictionary(readerStore.currentBook.id, readerStore.currentPage.pageNum, readerStore.currentPageDictionary)
    }
  })
}
