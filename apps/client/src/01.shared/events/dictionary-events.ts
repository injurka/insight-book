import type { UserDictItem } from '~/01.shared/types/models'
import { useRepos } from '~/00.plugins/di'
import { appEventBus } from '~/01.shared/events/app-event-bus'
import { useToastStore } from '~/01.shared/store/toast.store'
import { useDictionaryStore } from '~/05.modules/dictionary/store/dictionary.store'

const repos = useRepos()

export function setupDictionaryEvents() {
  appEventBus.on('DICTIONARY:REQUEST_SAVE_WORD', async (item: Partial<UserDictItem> & { contextSentence?: string, contextBookId?: number }) => {
    await repos.dictionary.upsert(item)
    const dictStore = useDictionaryStore()
    await dictStore.fetchDictionary()
    useToastStore().success(`Слово "${item.word}" сохранено`)
    appEventBus.emit('DICTIONARY:WORD_SAVED', item)
  })

  appEventBus.on('DICTIONARY:REQUEST_REMOVE_WORD', async (word: string) => {
    await repos.dictionary.remove(word)
    const dictStore = useDictionaryStore()
    await dictStore.fetchDictionary()
    useToastStore().success(`Слово "${word}" удалено`)
    appEventBus.emit('DICTIONARY:WORD_REMOVED', word)
  })
}
