import type { Ref, WatchSource } from 'vue'
import type { QuoteHighlightSource } from '../lib/dom-highlighter'
import { nextTick, onUnmounted, watch } from 'vue'
import { clearQuoteHighlights, findQuoteRange, setQuoteHighlights } from '../lib/dom-highlighter'

let ownerCounter = 0

export function useTextQuoteHighlights(container: Ref<HTMLElement | null>, quotes: Ref<QuoteHighlightSource[]>, text: WatchSource<string | null | undefined>) {
  const owner = `text-quotes-${++ownerCounter}`

  watch([container, quotes, text], async () => {
    await nextTick()
    const root = container.value
    if (!root) {
      clearQuoteHighlights(owner)

      return
    }

    const rangesByColor = new Map<string, Range[]>()
    for (const quote of quotes.value) {
      const range = findQuoteRange(root, quote.text.trim())
      if (!range)
        continue
      const color = quote.color || '#fde047'
      const ranges = rangesByColor.get(color) || []
      ranges.push(range)
      rangesByColor.set(color, ranges)
    }

    setQuoteHighlights(owner, rangesByColor)
  }, { deep: true, immediate: true, flush: 'post' })

  onUnmounted(() => clearQuoteHighlights(owner))
}
