import { watch } from 'vue'
import { useTts } from '~/shared/composables/use-tts'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'

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

  function onWordClick(event: MouseEvent) {
    clearPressTimer()

    const targetEl = event.target as HTMLElement
    const ttsBtn = targetEl.closest('.sentence-tts-btn') as HTMLElement | null
    if (ttsBtn) {
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
      return
    }

    const grammarBadge = targetEl.closest('.grammar-rule-badge') as HTMLElement | null
    if (grammarBadge) {
      const translationSpan = grammarBadge.closest('.interleaved-translation') as HTMLElement | null
      if (translationSpan && translationSpan.classList.contains('is-blurred')) {
        event.stopPropagation()
        return
      }
      event.stopPropagation()
      const pattern = decodeURIComponent(grammarBadge.dataset.pattern || '')
      const explanation = decodeURIComponent(grammarBadge.dataset.explanation || '')
      const example = decodeURIComponent(grammarBadge.dataset.example || '')
      analysisStore.openGrammarPopover(pattern, explanation, example, grammarBadge)
      return
    }

    const target = targetEl.closest('.word') as HTMLElement | null
    if (!target)
      return

    const pos = target.dataset.pos
    const word = decodeURIComponent(target.dataset.word || '')

    if (pos === 'x' || !/[\p{L}\p{N}]/u.test(word))
      return

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
