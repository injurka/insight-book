import type { Round, Word } from '../shared/types'
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { bounded, getApi } from '../shared/api'
import { dueWords, exactGuess, normalize } from '../shared/contracts'
import { answerOracle, classifyNouns, createMystery } from '../shared/oracle'
import { loadSession, saveSession, sessionKey } from '../shared/session'
import { MAX_TURNS } from '../shared/types'

export function useGame() {
  const state = reactive({
    language: 'en',
    round: null as Round | null,
    queue: [] as Word[],
    used: [] as number[],
    busy: '',
    error: '',
    notice: '',
    prepared: false,
    initialized: false,
    storage: true,
  })
  let key: string | null = null
  let generation = 0
  let disposed = false
  const nounCache = new Map<string, boolean>()
  const wordKey = (word: Word) => JSON.stringify([word.id, word.language, word.word, word.translation])
  const playing = computed(() => state.round?.outcome === 'playing')
  function persist() {
    state.storage = saveSession(key, { language: state.language, round: state.round, used: state.used })
  }
  async function run(label: string, operation: () => Promise<void>) {
    if (state.busy || disposed)
      return

    const current = ++generation
    state.busy = label
    state.error = ''
    state.notice = ''

    try {
      await operation()
    }
    catch (error: unknown) {
      if (!disposed && current === generation)
        state.error = error instanceof Error ? error.message : 'Не удалось связаться с хранителем. Попробуйте снова.'
    }
    finally {
      if (!disposed && current === generation) {
        state.busy = ''
        persist()
      }
    }
  }
  async function prepare() {
    await run('Ищем существительные в очереди SRS…', async () => {
      state.prepared = false
      state.queue = []
      const values = await bounded(getApi().dictionary.getDueWords(state.language))
      const words = dueWords(values, state.language).filter(word => !state.used.includes(word.id))
      const unchecked = words.filter(word => !nounCache.has(wordKey(word)))
      const nouns = await classifyNouns(unchecked)

      for (const word of unchecked)
        nounCache.set(wordKey(word), nouns.some(noun => noun.id === word.id))

      const queue = words.filter(word => nounCache.get(wordKey(word)))

      if (disposed)
        return

      state.queue = queue
      state.prepared = true
    })
  }
  async function begin() {
    const word = state.queue[0]

    if (!word)
      return

    await run('Хранитель готовит загадку…', async () => {
      const mystery = await createMystery(word)

      if (disposed)
        return

      state.round = {
        word,
        mystery,
        turns: [],
        hintsUsed: 0,
        outcome: 'playing',
        grade: 'idle',
      }
      state.queue.shift()
    })
  }
  async function submit(text: string, kind: 'question' | 'guess'): Promise<boolean> {
    const round = state.round
    const trimmed = text.trim()

    if (!round || !playing.value || state.busy || !trimmed || trimmed.length > 300)
      return false

    const previous = round.turns.find(turn => turn.kind === kind && normalize(turn.text) === normalize(trimmed))

    if (previous) {
      state.notice = 'Такой ход уже есть в журнале. Ответ остаётся прежним; новый ход не потрачен.'

      return true
    }

    let accepted = false
    await run('Хранитель размышляет…', async () => {
      const reply = kind === 'guess' && exactGuess(trimmed, round.word.word)
        ? { verdict: 'solved' as const, direction: 'closer' as const }
        : await answerOracle(round, trimmed, kind)

      if (disposed || state.round !== round)
        return

      round.turns.push({ text: trimmed, kind, ...reply })

      if (reply.verdict === 'solved')
        round.outcome = 'solved'
      else if (round.turns.length >= MAX_TURNS)
        round.outcome = 'exhausted'

      accepted = true
    })

    return accepted
  }
  function hint() {
    if (!state.busy && state.round && playing.value && state.round.hintsUsed < 3) {
      state.round.hintsUsed++
      persist()
    }
  }
  function reveal() {
    if (!state.busy && state.round && playing.value) {
      state.round.outcome = 'revealed'
      persist()
    }
  }
  async function grade(value: number) {
    const round = state.round

    if (!round || playing.value || round.grade !== 'idle' || ![1, 2, 3, 4].includes(value))
      return

    await run('Сохраняем повторение…', async () => {
      round.grade = 'sending'
      // Record intent before sending. An ambiguous network failure must never be retried automatically.
      persist()

      try {
        await bounded(getApi().dictionary.submitGrade(round.word.id, value))

        if (!disposed)
          round.grade = 'saved'
      }
      catch {
        round.grade = 'uncertain'

        if (!disposed)
          state.notice = 'Сервер не подтвердил запись. Проверьте карточку в словаре: оценка могла сохраниться. Повторно её не отправляем.'
      }
    })
  }
  function skipGrade() {
    if (!state.busy && state.round?.grade === 'idle' && !playing.value) {
      state.round.grade = 'skipped'
      persist()
    }
  }
  async function next() {
    if (state.busy || !state.round || playing.value || state.round.grade === 'idle' || state.round.grade === 'sending')
      return

    state.used = [...state.used, state.round.word.id].slice(-500)
    state.round = null
    state.prepared = false
    persist()
    await prepare()
  }
  function changeLanguage(language: string) {
    if (state.busy || state.round || !['en', 'zh', 'ja', 'ru'].includes(language))
      return

    state.language = language
    state.queue = []
    state.prepared = false
    state.error = ''
    persist()
  }
  onMounted(async () => {
    try {
      key = sessionKey(await bounded(Promise.resolve(getApi().user.getProfile()), 5000))
    }
    catch { key = null }

    if (disposed)
      return

    const snapshot = loadSession(key)

    if (snapshot && ['en', 'zh', 'ja', 'ru'].includes(snapshot.language)) {
      state.language = snapshot.language
      state.round = snapshot.round
      state.used = snapshot.used
    }

    state.storage = key !== null
    state.initialized = true
  })
  onUnmounted(() => {
    disposed = true
    generation++
  })

  return {
    state,
    playing,
    prepare,
    begin,
    submit,
    hint,
    reveal,
    grade,
    skipGrade,
    next,
    changeLanguage,
  }
}
