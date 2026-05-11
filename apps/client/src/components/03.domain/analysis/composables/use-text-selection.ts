import { useAnalysisStore } from '~/shared/store/analysis.store'

export function useTextSelection() {
  const analysisStore = useAnalysisStore()
  let pressTimer: ReturnType<typeof setTimeout> | null = null

  function onPointerDown(event: MouseEvent | TouchEvent, fallbackText?: string) {
    const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
    let rawSent = fallbackText || ''

    if (target && target.dataset.rawSent) {
      rawSent = decodeURIComponent(target.dataset.rawSent)
    }
    else if (fallbackText) {
      rawSent = fallbackText.replace(/\n+/g, '')
    }

    if (!rawSent)
      return

    pressTimer = setTimeout(() => {
      analysisStore.closePopover()
      analysisStore.closeSelectionTooltip()
      window.getSelection()?.empty()
      analysisStore.handleSentenceAnalysis(rawSent)
      pressTimer = null
    }, 500)
  }

  function onPointerUp() {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function onWordClick(event: MouseEvent) {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }

    const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
    if (!target)
      return

    const pos = target.dataset.pos
    if (pos === 'x')
      return

    const word = decodeURIComponent(target.dataset.word || '')
    const sentenceId = Number(target.dataset.sentId)
    const tokenIndex = Number(target.dataset.tokenIdx)

    if (!word || Number.isNaN(sentenceId) || Number.isNaN(tokenIndex) || !pos)
      return

    window.getSelection()?.empty()
    event.stopPropagation()

    analysisStore.handleWordClick(word, pos, sentenceId, tokenIndex, target)
  }

  return {
    onPointerDown,
    onPointerUp,
    onWordClick,
  }
}
