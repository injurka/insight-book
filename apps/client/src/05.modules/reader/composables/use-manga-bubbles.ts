import type { OcrBlock } from '~/01.shared/types/models'
import { ref } from 'vue'
import { hexToRgba, normalizeString } from '~/01.shared/lib/helpers'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useHighlightsStore } from '../store/highlights.store'
import { useReaderStore } from '../store/reader.store'

export function useMangaBubbles(onPointerDown: (e: MouseEvent | TouchEvent, t: string) => void, onWordClick: (e: MouseEvent) => void) {
  const settingsStore = useGlobalSettingsStore()
  const analysisStore = useAnalysisStore()
  const readerStore = useReaderStore()
  const highlightsStore = useHighlightsStore()

  const activeBubble = ref<OcrBlock | null>(null)
  const bubbleReference = ref<HTMLElement | null>(null)

  function handleBubbleClick(
    event: MouseEvent,
    box: OcrBlock,
    dragDist: number,
    scale: number,
  ) {
    if (dragDist > 10 && scale > 1)
      return

    if (analysisStore.wordPopover)
      analysisStore.closePopover()

    if (settingsStore.mangaOcrDisplayMode === 'popover') {
      event.stopPropagation()
      activeBubble.value = box
      bubbleReference.value = event.currentTarget as HTMLElement
    }
  }

  function handleBubblePointerDown(event: MouseEvent | TouchEvent, box: OcrBlock) {
    if (settingsStore.mangaOcrDisplayMode === 'hover')
      onPointerDown(event, box.text)
  }

  function closeBubblePopover(event?: Event) {
    const target = event?.target as HTMLElement | null
    if (target?.closest && (target.closest('.word-popover') || target.closest('.kit-dialog') || target.closest('.selection-tooltip')))
      return

    activeBubble.value = null
    bubbleReference.value = null
  }

  function handleBubblePopoverClick(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
    const pos = target?.dataset.pos

    if (!target || pos === 'x')
      analysisStore.closePopover()

    else
      onWordClick(event)
  }

  function getBoxStyle(box: OcrBlock) {
    if (!readerStore.currentPage?.imageWidth || !readerStore.currentPage?.imageHeight)
      return {}
    const imgWidth = readerStore.currentPage.imageWidth || 1
    const imgHeight = readerStore.currentPage.imageHeight || 1
    return {
      left: `${(box.x / imgWidth) * 100}%`,
      top: `${(box.y / imgHeight) * 100}%`,
      width: `${(box.w / imgWidth) * 100}%`,
      height: `${(box.h / imgHeight) * 100}%`,
    }
  }

  function getOuterNumberStyle(box: OcrBlock) {
    if (!readerStore.currentPage?.imageWidth || !readerStore.currentPage?.imageHeight)
      return {}
    const imgWidth = readerStore.currentPage.imageWidth || 1
    const imgHeight = readerStore.currentPage.imageHeight || 1
    return {
      left: `calc(${(box.x / imgWidth) * 100}% - 8px)`,
      top: `calc(${(box.y / imgHeight) * 100}% - 8px)`,
    }
  }

  function getBubbleHighlightStyle(box: OcrBlock) {
    if (!box?.text || !settingsStore.highlightSavedQuotes)
      return {}
    const rawNorm = normalizeString(box.text)
    const pageNum = Number(readerStore.currentPage?.pageNum)
    const pageHighlights = highlightsStore.highlights.filter(h => Number(h.pageNum) === pageNum)
    const matching = pageHighlights.find((h) => {
      const hNorm = normalizeString(h.text)
      return rawNorm === hNorm || (hNorm.length >= 2 && (rawNorm.includes(hNorm) || hNorm.includes(rawNorm)))
    })

    if (matching) {
      return {
        '--hl-bg': hexToRgba(matching.color || '#fde047', 0.25),
        '--hl-border': hexToRgba(matching.color || '#fde047', 0.8),
      }
    }
    return {}
  }

  return {
    activeBubble,
    bubbleReference,
    handleBubbleClick,
    handleBubblePointerDown,
    closeBubblePopover,
    handleBubblePopoverClick,
    getBoxStyle,
    getOuterNumberStyle,
    getBubbleHighlightStyle,
  }
}
