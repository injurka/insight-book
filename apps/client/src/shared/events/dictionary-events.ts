import type { UserDictItem } from '~/shared/types/models'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'
import { appEventBus } from '~/shared/events/app-event-bus'
import { useRepos } from '~/shared/plugins/di'
import { useToastStore } from '~/shared/store/toast.store'

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
