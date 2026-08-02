<script setup lang="ts">
import type { LlmAnalysis } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useTts } from '~/01.shared/composables/use-tts'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { QuoteModal } from '~/04.features/quote-modal'
import { useHighlightsStore } from '~/05.modules/reader/store/highlights.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

const highlightsStore = useHighlightsStore()
const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()

const isSavingHighlight = ref(false)

const isSaveModalOpen = ref(false)
const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']
const modalInitialData = ref<{
  text: string
  translation: string
  color: string
  note: string
  analysisData?: LlmAnalysis | null
}>({
  text: '',
  translation: '',
  color: highlightColors[0],
  note: '',
  analysisData: null,
})
const isFetchingTranslation = ref(false)

function getChapterTitle(pageNum: number): string | null {
  if (!readerStore.currentToc || !readerStore.currentToc.length)
    return null
  let currentItem = null
  for (const item of readerStore.currentToc) {
    if (item.pageNum !== undefined && item.pageNum <= pageNum) {
      if (!currentItem || item.pageNum > (currentItem.pageNum || 0))
        currentItem = item
    }
  }

  return currentItem ? currentItem.title : null
}

async function handleSaveQuote(data: { text: string, translation: string, note: string, color: string, analysisData?: LlmAnalysis | null }) {
  if (!readerStore.currentBook || !readerStore.currentPage || isSavingHighlight.value)
    return

  const bookId = readerStore.currentBook.id
  const pageNum = readerStore.currentPage.pageNum
  const chapter = getChapterTitle(pageNum)

  isSavingHighlight.value = true

  try {
    await highlightsStore.createHighlight({
      bookId,
      text: data.text,
      color: data.color,
      pageNum,
      chapter,
      translation: data.translation,
      note: data.note || null,
      analysisData: data.analysisData || null,
    })

    isSaveModalOpen.value = false
  }
  catch (err) {
    console.error('Failed to create highlight', err)
  }
  finally {
    isSavingHighlight.value = false
  }
}

const { speak, stop, isPlaying, isLoading } = useTts()
const { t } = useI18n()

const popoverRef = ref<HTMLElement | null>(null)
const popoverPos = ref({ top: '-9999px', left: '-9999px', transform: 'none' })

const offset = 24

function isElementSelectable(node: Node | null): boolean {
  let curr = node
  while (curr && curr !== document.body) {
    if (curr.nodeType === Node.ELEMENT_NODE && (curr as HTMLElement).classList.contains('js-tooltip-selectable'))
      return true
    curr = curr.parentNode
  }

  return false
}

function getValidSelection(settingsStore: ReturnType<typeof useGlobalSettingsStore>, readerStore: ReturnType<typeof useReaderStore>): Selection | null {
  if (readerStore.currentBook?.language === settingsStore.appLanguage)
    return null
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed)
    return null

  return selection
}

function isValidSelection(text: string, anchorNode: Node | null): boolean {
  if (!text || text.length > 250)
    return false
  if (!/[\p{L}\p{N}]/u.test(text))
    return false

  return isElementSelectable(anchorNode)
}

const checkTextSelection = useDebounceFn(() => {
  const settingsStore = useGlobalSettingsStore()
  const selection = getValidSelection(settingsStore, readerStore)
  if (!selection) {
    analysisStore.closeSelectionTooltip()

    return
  }

  const text = selection.toString().trim()
  if (!isValidSelection(text, selection.anchorNode)) {
    analysisStore.closeSelectionTooltip()

    return
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    analysisStore.closeSelectionTooltip()

    return
  }

  if (analysisStore.wordPopover)
    analysisStore.closePopover()

  analysisStore.selectionTooltip = { text, targetRect: rect }
}, 250)

function getSelectionContext(text: string): string {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode)
    return ''
  const parent = selection.anchorNode.parentElement
  if (!parent)
    return ''
  const span = parent.closest('.sentence')
  if (!span)
    return ''

  const prev = span.previousElementSibling?.textContent || ''
  const next = span.nextElementSibling?.textContent || ''

  return `${prev} [${text}] ${next}`.trim()
}

function analyzeFragment() {
  if (!analysisStore.selectionTooltip)
    return
  const text = analysisStore.selectionTooltip.text
  const context = getSelectionContext(text)

  const sel = window.getSelection()
  if (sel)
    sel.removeAllRanges()

  analysisStore.closeSelectionTooltip()
  analysisStore.handleSentenceAnalysis(text, context)
}

function playTTS() {
  if (!analysisStore.selectionTooltip)
    return

  if (isPlaying.value || isLoading.value)
    stop()
  else
    speak(analysisStore.selectionTooltip.text)
}

function calculatePopoverCoords(rect: DOMRect, popRect: DOMRect) {
  const ww = window.innerWidth
  const wh = window.innerHeight

  let left = rect.left + rect.width / 2
  const isMobile = ww < 600
  let top = isMobile ? rect.bottom + 8 : rect.top - popRect.height - offset

  if (isMobile && top + popRect.height > wh - 10)
    top = rect.top - popRect.height - offset
  else if (!isMobile && top < 10)
    top = rect.bottom + offset

  if (left - popRect.width / 2 < 10)
    left = popRect.width / 2 + 10
  else if (left + popRect.width / 2 > ww - 10)
    left = ww - popRect.width / 2 - 10

  return { top, left }
}

watch(() => analysisStore.selectionTooltip, async (val) => {
  if (!val) {
    popoverPos.value = { top: '-9999px', left: '-9999px', transform: 'none' }
    if (isPlaying.value || isLoading.value)
      stop()

    return
  }

  await nextTick()
  if (!popoverRef.value || !val.targetRect)
    return

  const { top, left } = calculatePopoverCoords(val.targetRect, popoverRef.value.getBoundingClientRect())
  popoverPos.value = {
    top: `${top}px`,
    left: `${left}px`,
    transform: 'translateX(-50%)',
  }
}, { deep: true })

onMounted(() => {
  document.addEventListener('selectionchange', checkTextSelection)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', checkTextSelection)
  stop()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="analysisStore.selectionTooltip"
        ref="popoverRef"
        class="selection-tooltip"
        :style="popoverPos"
        @mousedown.stop
        @touchstart.stop
        @click.stop
      >
        <button class="tooltip-btn" :title="t('analysis.aiAnalysis')" @click="analyzeFragment">
          <Icon icon="mdi:text-search" />
          <span>{{ t('analysis.aiAnalysis') }}</span>
        </button>
        <div class="divider" />
        <button class="tooltip-btn" :title="t('analysis.voice')" @click="playTTS">
          <Icon
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            :class="{ 'pulse-animation': isPlaying, 'spin-animation': isLoading }"
          />
          <span>{{ t('analysis.listen') }}</span>
        </button>
      </div>
    </Transition>

    <QuoteModal
      v-model:visible="isSaveModalOpen"
      mode="create"
      :initial-data="modalInitialData"
      :is-fetching-translation="isFetchingTranslation"
      @save="handleSaveQuote"
    />
  </Teleport>
</template>

<style lang="scss" scoped>
.selection-tooltip {
  position: fixed;
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: var(--z-tooltip, 1400);
  padding: 4px 6px;
  pointer-events: auto;
}

.tooltip-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--fg-primary-color);
  padding: 6px 12px;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover,
  &:active {
    background: rgba(var(--bg-accent-overlay-color-rgb), 0.1);
  }

  svg {
    font-size: 1.2rem;
  }
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-primary-color);
  margin: 0 4px;
}

.highlight-actions {
  display: flex;
  align-items: center;
}

.saving-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  color: var(--fg-accent-color);
  font-size: 1.4rem;
}

.delete-btn {
  color: var(--fg-error-color, #ef4444);
  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }
}

.pulse-animation {
  animation: pulse-op 1.2s ease-in-out infinite;
  transform-origin: center;
  display: inline-block;
  color: var(--fg-accent-color);
}

.spin-animation {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px) !important;
}
</style>
