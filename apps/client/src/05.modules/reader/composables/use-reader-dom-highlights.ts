import type { Ref } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'

export function useReaderDomHighlights(containerRef: Ref<HTMLElement | null>) {
  const analysisStore = useAnalysisStore()

  watch(() => analysisStore.activeTokenId, (newId, oldId) => {
    if (oldId) {
      const [sentId, tokenIdx] = oldId.split('-')
      const el = containerRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
      if (el)
        el.classList.remove('is-active')
    }
    if (newId) {
      const [sentId, tokenIdx] = newId.split('-')
      const el = containerRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
      if (el)
        el.classList.add('is-active')
    }
  })

  function onSentenceHover(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
    if (!target)
      return

    const sentId = target.getAttribute('data-sent-id')
    if (sentId && containerRef.value) {
      containerRef.value.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
        el.classList.add('is-hovered')
      })
    }
  }

  function onSentenceOut(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
    if (!target)
      return

    const sentId = target.getAttribute('data-sent-id')
    if (sentId && containerRef.value) {
      containerRef.value.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
        el.classList.remove('is-hovered')
      })
    }
  }

  return { onSentenceHover, onSentenceOut }
}
