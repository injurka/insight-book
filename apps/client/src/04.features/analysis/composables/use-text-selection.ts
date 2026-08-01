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

    selectionChangeListener = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0)
        clearPressTimer()
    }
    document.addEventListener('selectionchange', selectionChangeListener)

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
