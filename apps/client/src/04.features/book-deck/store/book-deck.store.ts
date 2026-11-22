import type { BookDeckDraft, BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { isWordContentComplete } from '@injurka/insight-book-language-utils'
import { useQueryCache } from '@pinia/colada'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { i18n } from '~/00.plugins/i18n'
import { queryKeys } from '~/01.shared/lib/query-keys'
import { isNativeSyncProgressNotificationSupported, requestNativeSyncProgressNotificationPermission } from '~/01.shared/services/native-sync-progress-notification.service'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useToastStore } from '~/01.shared/store/toast.store'
import { startBookDeckGenerationNotification } from '../services/book-deck-generation-notification.service'

const LLM_RETRY_BASE_DELAY_MS = 1000
const LLM_RETRY_MAX_DELAY_MS = 5000

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function isRetryableAiError(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false

  return 'code' in error && error.code === 'LLM_ERROR'
}

function getRetryDelayMs(attempt: number): number {
  return Math.min(LLM_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1), LLM_RETRY_MAX_DELAY_MS)
}

function waitForRetry(ms: number, ...signals: AbortSignal[]): Promise<boolean> {
  if (signals.some(signal => signal.aborted))
    return Promise.resolve(false)

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => {
      if (timer !== undefined)
        clearTimeout(timer)

      for (const signal of signals)
        signal.removeEventListener('abort', onAbort)

      resolve(false)
    }

    timer = setTimeout(() => {
      for (const signal of signals)
        signal.removeEventListener('abort', onAbort)

      resolve(true)
    }, ms)

    for (const signal of signals)
      signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function startGenerationNotification(bookName: string, getProgress: () => { done: number, total: number, word: string }, onPermissionDenied: () => void) {
  if (!isNativeSyncProgressNotificationSupported)
    return undefined

  if (!await requestNativeSyncProgressNotificationPermission())
    onPermissionDenied()

  return startBookDeckGenerationNotification(i18n.global.t('bookDeck.backgroundGenerationTitle', { book: bookName }), getProgress, progress => i18n.global.t('bookDeck.backgroundGenerationProgress', {
    done: progress.done,
    total: progress.total,
    word: progress.word || i18n.global.t('bookDeck.backgroundGenerationStarting'),
  }))
}

export const useBookDeckStore = defineStore('book-deck', () => {
  const repos = useRepos()
  const queryCache = useQueryCache()
  const auth = useAuthStore()
  const settings = useGlobalSettingsStore()
  const toast = useToastStore()
  const draft = ref<BookDeckDraft | null>(null)
  const selected = ref(new Set<string>())
  const state = reactive({
    loading: false,
    running: false,
    saving: false,
    pause: false,
    current: '',
    retryAttempt: 0,
    error: '',
    errors: {} as Record<string, string>,
    done: 0,
    total: 0,
  })
  const busy = computed(() => state.loading || state.running || state.saving)
  let request = 0
  let activeController: AbortController | null = null
  let retryWaitController: AbortController | null = null
  let cancelled = false
  const scope = () => JSON.stringify([auth.user?.id, auth.isSingleMode, settings.appLanguage])
  const selectedWords = computed(() => draft.value?.words.filter(w => selected.value.has(w.word)) || [])
  const pending = computed(() => selectedWords.value.filter(w => !isWordContentComplete(w.content)))

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
        selected.value = new Set()

      draft.value = result
      Object.assign(state, {
        errors: {},
        done: 0,
        total: 0,
        current: '',
        retryAttempt: 0,
      })
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

  function setSelected(words: string[], checked: boolean) {
    const next = new Set(selected.value)

    words.forEach((word) => {
      if (checked)
        next.add(word)
      else next.delete(word)
    })

    selected.value = next
  }

  function keepSelected(words: string[]) {
    selected.value = new Set(words)
  }

  function isCurrent(id: string, session: string) {
    return session === scope() && draft.value?.id === id
  }

  function shouldStopGeneration(id: string, session: string, signal: AbortSignal) {
    return signal.aborted || !isCurrent(id, session)
  }

  async function waitBeforeRetry(
    id: string,
    session: string,
    word: BookDeckWord,
    message: string,
    signal: AbortSignal,
  ) {
    state.retryAttempt++
    state.errors[word.word] = message
    const waitController = new AbortController()
    retryWaitController = waitController
    const shouldContinue = await waitForRetry(getRetryDelayMs(state.retryAttempt), signal, waitController.signal)

    if (retryWaitController === waitController)
      retryWaitController = null

    if (shouldStopGeneration(id, session, signal) || state.pause || !shouldContinue) {
      if (isCurrent(id, session) && signal.aborted)
        delete state.errors[word.word]

      return false
    }

    return true
  }

  async function handleGenerateWordError(
    id: string,
    session: string,
    word: BookDeckWord,
    error: unknown,
    signal: AbortSignal,
  ): Promise<'retry' | 'stop'> {
    if (shouldStopGeneration(id, session, signal) || isAbortError(error)) {
      if (isCurrent(id, session))
        delete state.errors[word.word]

      return 'stop'
    }

    const message = error instanceof Error ? error.message : String(error)

    if (isRetryableAiError(error) && !state.pause) {
      const canRetry = await waitBeforeRetry(
        id,
        session,
        word,
        message,
        signal,
      )

      return canRetry ? 'retry' : 'stop'
    }

    state.errors[word.word] = message
    state.error = `${word.word}: ${message}`

    return 'stop'
  }

  async function generateOne(
    id: string,
    session: string,
    word: BookDeckWord,
    signal: AbortSignal,
  ) {
    state.current = word.word
    state.retryAttempt = 0
    delete state.errors[word.word]

    while (!shouldStopGeneration(id, session, signal)) {
      try {
        const result = await repos.dictionary.generateBookDeckWord(
          id,
          word.word,
          isWordContentComplete(word.content),
          signal,
        )

        if (shouldStopGeneration(id, session, signal))
          return false

        if (!isWordContentComplete(result.content))
          throw new Error('Incomplete word metadata')

        Object.assign(word, result)
        delete state.errors[word.word]
        state.error = ''
        state.retryAttempt = 0
        state.done++

        return true
      }
      catch (error) {
        const nextAction = await handleGenerateWordError(
          id,
          session,
          word,
          error,
          signal,
        )

        if (nextAction === 'stop')
          return false
      }
    }

    return false
  }

  function finalizeGeneration(controller: AbortController) {
    if (activeController === controller)
      activeController = null

    retryWaitController = null
    state.current = ''
    state.retryAttempt = 0
    state.running = false

    if (cancelled) {
      state.pause = false
      state.error = ''
      state.done = 0
      state.total = 0
    }
  }

  async function generate(words = pending.value) {
    if (!draft.value || busy.value)
      return

    const id = draft.value.id
    const session = scope()
    const requested = new Set(words.map(word => word.word))
    const queue = selectedWords.value.filter(word => requested.has(word.word))

    if (!queue.length)
      return

    const controller = new AbortController()
    activeController = controller
    cancelled = false

    Object.assign(state, {
      running: true,
      pause: false,
      retryAttempt: 0,
      done: 0,
      total: queue.length,
      error: '',
    })

    const bookName = draft.value.name
    let stopNotification: (() => Promise<void>) | undefined

    try {
      stopNotification = await startGenerationNotification(bookName, () => ({ done: state.done, total: state.total, word: state.current }), () => toast.warn(i18n.global.t('bookDeck.backgroundNotificationPermissionDenied')))

      for (const word of queue) {
        if (state.pause || shouldStopGeneration(id, session, controller.signal))
          break

        if (!await generateOne(
          id,
          session,
          word,
          controller.signal,
        )) {
          break
        }
      }
    }
    finally {
      finalizeGeneration(controller)
      await stopNotification?.()
    }
  }

  function pause() {
    if (!state.running)
      return

    state.pause = true
    retryWaitController?.abort()
  }

  function cancel() {
    if (state.current)
      delete state.errors[state.current]

    if (state.running) {
      cancelled = true
      retryWaitController?.abort()
      activeController?.abort()
    }

    state.pause = false
    state.retryAttempt = 0
    state.current = ''
    state.error = ''
    state.done = 0
    state.total = 0
  }

  const canSave = computed(() => selectedWords.value.length > 0 && !pending.value.length)

  async function save(name: string, updateExisting: boolean) {
    if (!draft.value || busy.value || !canSave.value)
      return

    const id = draft.value.id
    const session = scope()
    state.saving = true
    state.error = ''

    try {
      const result = await repos.dictionary.saveBookDeck(
        id,
        name,
        selectedWords.value.map(word => word.word),
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
    cancelled = true
    retryWaitController?.abort()
    activeController?.abort()
    state.pause = true
    state.retryAttempt = 0
    draft.value = null
    selected.value.clear()
    state.error = ''
  }
  watch(scope, reset)
  watch(() => state.pause, (paused) => {
    if (paused)
      retryWaitController?.abort()
  })

  return {
    draft,
    selected,
    selectedWords,
    pending,
    state,
    open,
    toggle,
    setSelected,
    keepSelected,
    generate,
    pause,
    cancel,
    save,
  }
})
