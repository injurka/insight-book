import { onMounted, onUnmounted } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useReaderStore } from '../store/reader.store'

function isTyping(): boolean {
  const active = document.activeElement
  if (!active)
    return false
  const tag = active.tagName.toLowerCase()

  return tag === 'input' || tag === 'textarea' || tag === 'select' || (active as HTMLElement).isContentEditable
}

export function useReaderHotkeys(prevPage: () => void, nextPage: () => void) {
  const readerStore = useReaderStore()
  const analysisStore = useAnalysisStore()

  function handleEscapeKey(): boolean {
    if (analysisStore.wordPopover) {
      analysisStore.closePopover()

      return true
    }

    if (analysisStore.grammarPopover) {
      analysisStore.closeGrammarPopover()

      return true
    }

    if (analysisStore.selectionTooltip) {
      analysisStore.closeSelectionTooltip()

      return true
    }

    if (readerStore.tocOpen) {
      readerStore.tocOpen = false

      return true
    }

    return false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isTyping() || event.ctrlKey || event.metaKey || event.altKey)
      return

    if (event.key === 'Escape') {
      if (handleEscapeKey())
        event.preventDefault()

      return
    }

    const nextKeys = ['ArrowRight', 'PageDown', 'd', 'l']
    const prevKeys = ['ArrowLeft', 'PageUp', 'a', 'h']

    if (nextKeys.includes(event.key)) {
      nextPage()
      event.preventDefault()
    }
    else if (prevKeys.includes(event.key)) {
      prevPage()
      event.preventDefault()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
