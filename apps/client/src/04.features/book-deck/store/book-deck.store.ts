import type { BookDeckDraft, BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'

export const useBookDeckStore = defineStore('book-deck', () => {
  const repos = useRepos()
  const queryCache = useQueryCache()
  const auth = useAuthStore()
  const settings = useGlobalSettingsStore()
  const draft = ref<BookDeckDraft | null>(null)
  const selected = ref(new Set<string>())
  const state = reactive({
    loading: false,
    running: false,
    saving: false,
    pause: false,
    current: '',
    error: '',
    errors: {} as Record<string, string>,
    done: 0,
    total: 0,
  })
  const busy = computed(() => state.loading || state.running || state.saving)
  let request = 0
  const scope = () => JSON.stringify([auth.user?.id, auth.isSingleMode, settings.appLanguage])
  const selectedWords = computed(() => draft.value?.words.filter(w => selected.value.has(w.word)) || [])
  const pending = computed(() => selectedWords.value.filter(w => !w.content))

  async function open(bookId: number, restart = false) {
    if (busy.value)
      return

    const current = ++request
    const session = scope()
    state.loading = true
    state.error = ''

    try {
      const result = await repos.dictionary.openBookDeck(bookId, restart)

      if (current !== request || session !== scope())
        return

      if (draft.value?.id !== result.id)
        selected.value = new Set(result.words.filter(w => !w.properName).map(w => w.word))

      draft.value = result
      state.errors = {}
    }
    catch (error) {
      if (session === scope())
        state.error = error instanceof Error ? error.message : String(error)
    }
    finally {
      state.loading = false
    }
  }

  function toggle(word: string, checked: boolean) {
    if (checked)
      selected.value.add(word)
    else selected.value.delete(word)
  }

  function isCurrent(id: string, session: string) {
    return session === scope() && draft.value?.id === id
  }

  async function generateOne(id: string, session: string, word: BookDeckWord) {
    state.current = word.word
    delete state.errors[word.word]

    try {
      const result = await repos.dictionary.generateBookDeckWord(id, word.word)

      if (!isCurrent(id, session))
        return false

      Object.assign(word, result)
      state.done++

      return true
    }
    catch (error) {
      if (isCurrent(id, session)) {
        const message = error instanceof Error ? error.message : String(error)
        state.errors[word.word] = message
        state.error = `${word.word}: ${message}`
      }

      return false
    }
  }

  async function generate(words?: BookDeckWord[]) {
    if (!draft.value || busy.value)
      return

    const id = draft.value.id
    const session = scope()
    const queue = words || selectedWords.value.filter(w => !w.content)
    Object.assign(state, {
      running: true,
      pause: false,
      done: 0,
      total: queue.length,
      error: '',
    })

    for (const word of queue) {
      if (state.pause || !isCurrent(id, session))
        break

      if (!await generateOne(id, session, word))
        break
    }

    state.current = ''
    state.running = false
  }

  async function save(name: string, updateExisting: boolean) {
    if (!draft.value || busy.value || pending.value.length)
      return

    const id = draft.value.id
    const session = scope()
    state.saving = true
    state.error = ''

    try {
      const result = await repos.dictionary.saveBookDeck(
        id,
        name,
        [...selected.value],
        updateExisting,
      )

      if (scope() === session && draft.value?.id === id) {
        draft.value.deckId = result.deckId
        await queryCache.invalidateQueries({ key: queryKeys.dictionary.all }, false)
      }
    }
    catch (error) {
      if (session === scope())
        state.error = error instanceof Error ? error.message : String(error)
    }
    finally {
      state.saving = false
    }
  }

  function reset() {
    request++
    state.pause = true
    draft.value = null
    selected.value.clear()
    state.error = ''
  }
  watch(scope, reset)

  return {
    draft,
    selected,
    selectedWords,
    pending,
    state,
    open,
    toggle,
    generate,
    save,
  }
})
