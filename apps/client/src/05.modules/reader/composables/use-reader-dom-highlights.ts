import type { Ref } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'

export function useReaderDomHighlights(containerRef: Ref<HTMLElement | null>) {
  const analysisStore = useAnalysisStore()

  function getTextScope(target?: Element | null) {
    return target?.closest('.reader-content, .ocr-bubble, .translation-html') || containerRef.value
  }

  watch(() => [analysisStore.activeTokenId, analysisStore.wordPopover?.target] as const, ([newId, target]) => {
    containerRef.value?.querySelectorAll('.word.is-active').forEach(el => el.classList.remove('is-active'))

    if (newId) {
      const [sentId, tokenIdx] = newId.split('-')
      getTextScope(target)?.querySelectorAll(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`).forEach(el => el.classList.add('is-active'))
    }
  })

  function onSentenceHover(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('.sentence')

    if (!target)
      return

    const sentId = target.getAttribute('data-sent-id')

    if (sentId && containerRef.value) {
      getTextScope(target)?.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
        el.classList.add('is-hovered')
      })
    }
  }

  function onSentenceOut(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('.sentence')

    if (!target)
      return

    const sentId = target.getAttribute('data-sent-id')

    if (sentId && containerRef.value) {
      getTextScope(target)?.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
        el.classList.remove('is-hovered')
      })
    }
  }

  return { onSentenceHover, onSentenceOut }
}
