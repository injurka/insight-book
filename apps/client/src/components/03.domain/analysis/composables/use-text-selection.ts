import { useAnalysisStore } from '~/shared/store/analysis.store'

export function useTextSelection() {
  const analysisStore = useAnalysisStore()
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let selectionChangeListener: (() => void) | null = null

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

    if (target && target.dataset.rawSent) {
      rawSent = decodeURIComponent(target.dataset.rawSent)
    }
    else if (fallbackText) {
      rawSent = fallbackText.replace(/\n+/g, '')
    }

    if (!rawSent || !/[\p{L}\p{N}]/u.test(rawSent))
      return

    selectionChangeListener = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        clearPressTimer()
      }
    }
    document.addEventListener('selectionchange', selectionChangeListener)

    pressTimer = setTimeout(() => {
      clearPressTimer()

      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        return
      }

      analysisStore.closePopover()
      analysisStore.closeSelectionTooltip()
      window.getSelection()?.empty()
      analysisStore.handleSentenceAnalysis(rawSent)
    }, 500)
  }

  function onPointerUp() {
    clearPressTimer()
  }

  function onWordClick(event: MouseEvent) {
    clearPressTimer()

    const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
    if (!target)
      return

    const pos = target.dataset.pos
    if (pos === 'x')
      return

    const word = decodeURIComponent(target.dataset.word || '')
    const sentenceId = Number(target.dataset.sentId)
    const tokenIndex = Number(target.dataset.tokenIdx)

    const sentenceEl = target.closest('.sentence') as HTMLElement | null
    const contextSentence = sentenceEl ? decodeURIComponent(sentenceEl.dataset.rawSent || '') : ''

    if (!word || Number.isNaN(sentenceId) || Number.isNaN(tokenIndex) || !pos)
      return

    window.getSelection()?.empty()
    event.stopPropagation()

    analysisStore.handleWordClick(word, pos, sentenceId, tokenIndex, target, contextSentence)
  }

  return {
    onPointerDown,
    onPointerUp,
    onWordClick,
  }
}
