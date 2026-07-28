import type { Ref, WatchSource } from 'vue'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { clearQuoteHighlights, collectQuoteRanges, setQuoteHighlights } from '../lib/dom-highlighter'
import { useHighlightsStore } from '../store/highlights.store'
import { useReaderStore } from '../store/reader.store'

let ownerCounter = 0

/**
 * Подсвечивает сохраненные цитаты текущей страницы через CSS Custom Highlight
 * API: Range-ы строятся поверх живого DOM контейнера после каждого рендера,
 * сам DOM не модифицируется. Подписки нужно дополнительно передать источники
 * контента (computed со строками v-html), т.к. их обновление пересоздает
 * текстовые узлы и требует пересчета Range-ей.
 */
export function useQuoteHighlights(containerRef: Ref<HTMLElement | null>, contentSources: WatchSource[] = []) {
  const highlightsStore = useHighlightsStore()
  const settingsStore = useGlobalSettingsStore()
  const readerStore = useReaderStore()
  const ownerId = `reader-quotes-${++ownerCounter}`

  async function reapplyQuoteHighlights() {
    await nextTick()

    const root = containerRef.value
    const pageNum = Number(readerStore.currentPage?.pageNum)
    if (!root || !settingsStore.highlightSavedQuotes || !readerStore.currentPage) {
      clearQuoteHighlights(ownerId)
      return
    }

    const pageQuotes = highlightsStore.highlights.filter(h => Number(h.pageNum) === pageNum)
    setQuoteHighlights(ownerId, collectQuoteRanges(root, pageQuotes))
  }

  watch([
    () => highlightsStore.highlights,
    () => settingsStore.highlightSavedQuotes,
    () => readerStore.currentPage?.pageNum,
    ...contentSources,
  ], reapplyQuoteHighlights, { deep: true, immediate: true })

  onUnmounted(() => clearQuoteHighlights(ownerId))

  return { reapplyQuoteHighlights }
}
