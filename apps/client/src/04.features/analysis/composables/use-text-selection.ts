import { watch } from 'vue'
import { useTts } from '~/01.shared/composables/use-tts'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'

function isValidWordTarget(
  word: string,
  pos: string | undefined,
  sentenceId: number,
  tokenIndex: number,
): boolean {
  if (!word || !pos || pos === 'x')
    return false
  if (Number.isNaN(sentenceId) || Number.isNaN(tokenIndex))
    return false

  return /[\p{L}\p{N}]/u.test(word)
}

export function useTextSelection() {
  const analysisStore = useAnalysisStore()
  const { speak, isPlaying } = useTts()
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let selectionChangeListener: (() => void) | null = null
  let pressMoveListener: ((e: Event) => void) | null = null
  let pressScrollListener: (() => void) | null = null
  let pressStartX = 0
  let pressStartY = 0

  let currentPlayingBtn: HTMLElement | null = null

  watch(isPlaying, (playing) => {
    if (!playing && currentPlayingBtn) {
      currentPlayingBtn.classList.remove('is-playing')
      currentPlayingBtn = null
    }
  })

  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }

    if (selectionChangeListener) {
      document.removeEventListener('selectionchange', selectionChangeListener)
      selectionChangeListener = null
    }

    if (pressMoveListener) {
      window.removeEventListener('touchmove', pressMoveListener)
      window.removeEventListener('mousemove', pressMoveListener)
      pressMoveListener = null
    }

    if (pressScrollListener) {
      window.removeEventListener('scroll', pressScrollListener, { capture: true })
      pressScrollListener = null
    }
  }

  function capturePressOrigin(event: MouseEvent | TouchEvent) {
    if ('touches' in event && event.touches.length > 0) {
      pressStartX = event.touches[0].clientX
      pressStartY = event.touches[0].clientY
    }
    else {
      pressStartX = (event as MouseEvent).clientX
      pressStartY = (event as MouseEvent).clientY
    }
  }

  function pressMovedBeyondThreshold(e: Event): boolean {
    let currentX = 0
    let currentY = 0

    if (e.type === 'touchmove') {
      const touch = (e as TouchEvent).touches[0]
      if (!touch)
        return false
      currentX = touch.clientX
      currentY = touch.clientY
    }
    else {
      currentX = (e as MouseEvent).clientX
      currentY = (e as MouseEvent).clientY
    }

    return Math.abs(currentX - pressStartX) > 10 || Math.abs(currentY - pressStartY) > 10
  }

  function armPressCancellers() {
    pressMoveListener = (e: Event) => {
      if (pressMovedBeyondThreshold(e))
        clearPressTimer()
    }

    window.addEventListener('touchmove', pressMoveListener, { passive: true })
    window.addEventListener('mousemove', pressMoveListener, { passive: true })

    // Скролл — верный признак того, что жест не является длинным нажатием:
    // срабатывает даже там, где браузер не шлёт touchcancel при захвате жеста.
    pressScrollListener = () => clearPressTimer()
    window.addEventListener('scroll', pressScrollListener, { capture: true, passive: true })
  }

  function onPointerDown(event: MouseEvent | TouchEvent, fallbackText?: string) {
    clearPressTimer()

    const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
    let rawSent = fallbackText || ''

    if (target && target.dataset.rawSent)
      rawSent = decodeURIComponent(target.dataset.rawSent)

    else if (fallbackText)
      rawSent = fallbackText.replace(/\n+/g, '')

    if (!rawSent || !/[\p{L}\p{N}]/u.test(rawSent))
      return

    capturePressOrigin(event)

    selectionChangeListener = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0)
        clearPressTimer()
    }

    document.addEventListener('selectionchange', selectionChangeListener)

    armPressCancellers()

    pressTimer = setTimeout(() => {
      clearPressTimer()

      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0)
        return

      let context = ''
      if (target) {
        const prev = target.previousElementSibling?.textContent || ''
        const next = target.nextElementSibling?.textContent || ''
        context = `${prev} [${rawSent}] ${next}`.trim()
      }

      analysisStore.closePopover()
      analysisStore.closeSelectionTooltip()
      window.getSelection()?.empty()
      analysisStore.handleSentenceAnalysis(rawSent, context)
    }, 500)
  }

  function onPointerUp() {
    clearPressTimer()
  }

  function handleTtsBtnClick(event: MouseEvent, targetEl: HTMLElement): boolean {
    const ttsBtn = targetEl.closest('.sentence-tts-btn') as HTMLElement | null
    if (!ttsBtn)
      return false

    event.stopPropagation()
    event.preventDefault()
    const text = decodeURIComponent(ttsBtn.dataset.ttsText || '')
    if (text) {
      if (currentPlayingBtn)
        currentPlayingBtn.classList.remove('is-playing')
      ttsBtn.classList.add('is-playing')
      currentPlayingBtn = ttsBtn
      speak(text)
    }

    return true
  }

  function handleGrammarBadgeClick(event: MouseEvent, targetEl: HTMLElement): boolean {
    const grammarBadge = targetEl.closest('.grammar-rule-badge') as HTMLElement | null
    if (!grammarBadge)
      return false

    const translationSpan = grammarBadge.closest('.interleaved-translation, .split-translation')
    if (translationSpan && translationSpan.classList.contains('is-blurred')) {
      event.stopPropagation()

      return true
    }

    event.stopPropagation()
    const pattern = decodeURIComponent(grammarBadge.dataset.pattern || '')
    const explanation = decodeURIComponent(grammarBadge.dataset.explanation || '')
    const example = decodeURIComponent(grammarBadge.dataset.example || '')
    analysisStore.openGrammarPopover(
      pattern,
      explanation,
      example,
      grammarBadge,
    )

    return true
  }

  function onWordClick(event: MouseEvent) {
    clearPressTimer()

    const targetEl = event.target as HTMLElement
    if (handleTtsBtnClick(event, targetEl) || handleGrammarBadgeClick(event, targetEl))
      return

    const target = targetEl.closest('.word') as HTMLElement | null
    if (!target)
      return

    const pos = target.dataset.pos
    const word = decodeURIComponent(target.dataset.word || '')
    const sentenceId = Number(target.dataset.sentId)
    const tokenIndex = Number(target.dataset.tokenIdx)

    if (!isValidWordTarget(
      word,
      pos,
      sentenceId,
      tokenIndex,
    )) {
      return
    }

    const sentenceEl = target.closest('.sentence') as HTMLElement | null
    const contextSentence = sentenceEl ? decodeURIComponent(sentenceEl.dataset.rawSent || '') : ''

    window.getSelection()?.empty()
    event.stopPropagation()

    analysisStore.handleWordClick(
      word,
      pos!,
      sentenceId,
      tokenIndex,
      target,
      contextSentence,
    )
  }

  return {
    onPointerDown,
    onPointerUp,
    onWordClick,
  }
}
