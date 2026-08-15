import { watch } from 'vue'
import { useTts } from '~/01.shared/composables/use-tts'
import { safeDecodeURIComponent } from '~/01.shared/lib/helpers'
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

function clearSelectionRanges() {
  const sel = window.getSelection()
  if (sel) {
    if (sel.removeAllRanges)
      sel.removeAllRanges()
    else if ('empty' in sel)
      (sel as unknown as { empty: () => void }).empty()
  }
}

export function useTextSelection() {
  const analysisStore = useAnalysisStore()
  const { speak, stop, isPlaying, isLoading } = useTts()
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let selectionChangeListener: (() => void) | null = null
  let pressMoveListener: ((e: Event) => void) | null = null
  let pressScrollListener: (() => void) | null = null
  let pressOriginX = 0
  let pressOriginY = 0
  let currentPlayingBtn: HTMLElement | null = null

  watch([isPlaying, isLoading], ([playing, loading]) => {
    if (!playing && !loading && currentPlayingBtn) {
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
      window.removeEventListener('pointermove', pressMoveListener, { capture: true })
      window.removeEventListener('touchmove', pressMoveListener, { capture: true })
      pressMoveListener = null
    }

    if (pressScrollListener) {
      window.removeEventListener('scroll', pressScrollListener, { capture: true })
      pressScrollListener = null
    }
  }

  function getClientCoords(event: MouseEvent | TouchEvent): { x: number, y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }

    if ('clientX' in event) {
      return { x: event.clientX, y: event.clientY }
    }

    return { x: 0, y: 0 }
  }

  function capturePressOrigin(event: MouseEvent | TouchEvent) {
    const coords = getClientCoords(event)
    pressOriginX = coords.x
    pressOriginY = coords.y

    pressMoveListener = (e: Event) => {
      const moveCoords = getClientCoords(e as MouseEvent | TouchEvent)
      const dx = Math.abs(moveCoords.x - pressOriginX)
      const dy = Math.abs(moveCoords.y - pressOriginY)
      if (dx > 10 || dy > 10)
        clearPressTimer()
    }

    window.addEventListener('pointermove', pressMoveListener, { capture: true, passive: true })
    window.addEventListener('touchmove', pressMoveListener, { capture: true, passive: true })

    pressScrollListener = () => clearPressTimer()
    window.addEventListener('scroll', pressScrollListener, { capture: true, passive: true })
  }

  function onPointerDown(event: MouseEvent | TouchEvent, fallbackText?: string) {
    clearPressTimer()

    const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
    let rawSent = fallbackText || ''

    if (target && target.dataset.rawSent)
      rawSent = safeDecodeURIComponent(target.dataset.rawSent)

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

    pressTimer = setTimeout(() => {
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

      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(50)
        }
        catch { }
      }

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
    const text = safeDecodeURIComponent(ttsBtn.dataset.ttsText || '')
    if (!text)
      return true

    const prevBtn = currentPlayingBtn

    if (ttsBtn === prevBtn) {
      stop()
      ttsBtn.classList.remove('is-playing')
      currentPlayingBtn = null

      return true
    }

    if (prevBtn)
      prevBtn.classList.remove('is-playing')

    ttsBtn.classList.add('is-playing')
    currentPlayingBtn = ttsBtn

    void speak(text).then((started: boolean) => {
      if (started || currentPlayingBtn !== ttsBtn)
        return

      ttsBtn.classList.remove('is-playing')
      if (prevBtn && prevBtn.isConnected && isPlaying.value) {
        prevBtn.classList.add('is-playing')
        currentPlayingBtn = prevBtn
      }
      else {
        currentPlayingBtn = null
      }
    })

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
    const pattern = safeDecodeURIComponent(grammarBadge.dataset.pattern || '')
    const explanation = safeDecodeURIComponent(grammarBadge.dataset.explanation || '')
    const example = safeDecodeURIComponent(grammarBadge.dataset.example || '')
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
    const word = safeDecodeURIComponent(target.dataset.word || '')
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
    const contextSentence = sentenceEl ? safeDecodeURIComponent(sentenceEl.dataset.rawSent || '') : ''

    clearSelectionRanges()
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
