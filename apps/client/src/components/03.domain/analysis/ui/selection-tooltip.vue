<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { QuoteModal } from '~/components/04.features/quote-modal'
import { useHighlightsStore } from '~/components/05.modules/reader/store/highlights.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useTts } from '~/shared/composables/use-tts'
import { normalizeString } from '~/shared/lib/helpers'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const highlightsStore = useHighlightsStore()
const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()

const isSavingHighlight = ref(false)

const isSaveModalOpen = ref(false)
const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']
const modalInitialData = ref({ text: '', translation: '', color: highlightColors[0], note: '' })
const isFetchingTranslation = ref(false)

const matchingHighlight = computed(() => {
  if (!analysisStore.selectionTooltip || !readerStore.currentBook)
    return null
  const rawNorm = normalizeString(analysisStore.selectionTooltip.text)
  return highlightsStore.highlights.find((h) => {
    const hNorm = normalizeString(h.text)
    return Number(h.bookId) === Number(readerStore.currentBook?.id) && (rawNorm === hNorm || (hNorm.length >= 2 && (rawNorm.includes(hNorm) || hNorm.includes(rawNorm))))
  })
})

async function openSaveModal() {
  if (!analysisStore.selectionTooltip || !readerStore.currentBook)
    return

  const text = analysisStore.selectionTooltip.text.replace(/\n+/g, '')
  modalInitialData.value = { text, translation: '', color: '#fde047', note: '' }
  isSaveModalOpen.value = true
  isFetchingTranslation.value = true

  analysisStore.closeSelectionTooltip()
  window.getSelection()?.removeAllRanges()

  try {
    const cached = await offlineService.getAnalysis(text)
    if (cached && cached.translation) {
      modalInitialData.value.translation = cached.translation
    }
    else {
      const language = readerStore.currentBook.language || 'en'
      const res = await api.books.analyze(readerStore.currentBook.id, text, language)
      await offlineService.saveAnalysis(text, res)
      modalInitialData.value.translation = res.translation || ''
    }
  }
  catch (e) {
    console.error('Translation failed:', e)
  }
  finally {
    isFetchingTranslation.value = false
  }
}

async function handleSaveQuote(data: { text: string, translation: string, note: string, color: string }) {
  if (!readerStore.currentBook || !readerStore.currentPage)
    return
  if (isSavingHighlight.value)
    return

  const bookId = readerStore.currentBook.id
  const pageNum = readerStore.currentPage.pageNum

  let chapter: string | null = null
  if (readerStore.currentToc && readerStore.currentToc.length) {
    let currentItem = null
    for (const item of readerStore.currentToc) {
      if (item.pageNum !== undefined && item.pageNum <= pageNum) {
        if (!currentItem || item.pageNum > (currentItem.pageNum || 0)) {
          currentItem = item
        }
      }
    }
    chapter = currentItem ? currentItem.title : null
  }

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

async function deleteHighlight(id: number) {
  try {
    await highlightsStore.deleteHighlight(id)
    analysisStore.closeSelectionTooltip()
    window.getSelection()?.removeAllRanges()
  }
  catch (err) {
    console.error('Failed to delete highlight', err)
  }
}

const { speak, stop, isPlaying, isLoading } = useTts()
const { t } = useI18n()

const popoverRef = ref<HTMLElement | null>(null)
const popoverPos = ref({ top: '-9999px', left: '-9999px', transform: 'none' })

const offset = 24

const checkTextSelection = useDebounceFn(() => {
  const selection = window.getSelection()

  if (!selection || selection.isCollapsed) {
    analysisStore.closeSelectionTooltip()
    return
  }

  const text = selection.toString().trim()
  if (!text || !/[\p{L}\p{N}]/u.test(text)) {
    analysisStore.closeSelectionTooltip()
    return
  }

  let node = selection.anchorNode
  let isSelectable = false

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('js-tooltip-selectable')) {
      isSelectable = true
      break
    }
    node = node.parentNode
  }

  if (!isSelectable) {
    return
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  if (rect.width === 0 || rect.height === 0) {
    analysisStore.closeSelectionTooltip()
    return
  }

  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }

  analysisStore.selectionTooltip = { text, targetRect: rect }
}, 250)

function analyzeFragment() {
  if (!analysisStore.selectionTooltip)
    return
  const text = analysisStore.selectionTooltip.text
  let context = ''

  const selection = window.getSelection()
  if (selection && selection.anchorNode) {
    const span = selection.anchorNode.parentElement?.closest('.sentence')

    if (span) {
      const prev = span.previousElementSibling?.textContent || ''
      const next = span.nextElementSibling?.textContent || ''
      context = `${prev} [${text}] ${next}`.trim()
    }
  }

  window.getSelection()?.removeAllRanges()

  analysisStore.closeSelectionTooltip()
  analysisStore.handleSentenceAnalysis(text, context)
}

function playTTS() {
  if (!analysisStore.selectionTooltip)
    return

  if (isPlaying.value || isLoading.value) {
    stop()
  }
  else {
    speak(analysisStore.selectionTooltip.text)
  }
}

watch(
  () => analysisStore.selectionTooltip,
  async (val) => {
    if (!val) {
      popoverPos.value = { top: '-9999px', left: '-9999px', transform: 'none' }
      if (isPlaying.value || isLoading.value) {
        stop()
      }
      return
    }

    await nextTick()
    if (!popoverRef.value || !val.targetRect)
      return

    const rect = val.targetRect
    const popRect = popoverRef.value.getBoundingClientRect()
    const ww = window.innerWidth
    const wh = window.innerHeight

    let left = rect.left + rect.width / 2

    const isMobile = ww < 600
    let top = isMobile ? rect.bottom + 8 : rect.top - popRect.height - offset

    if (isMobile) {
      if (top + popRect.height > wh - 10) {
        top = rect.top - popRect.height - offset
      }
    }
    else {
      if (top < 10) {
        top = rect.bottom + offset
      }
    }

    if (left - popRect.width / 2 < 10) {
      left = popRect.width / 2 + 10
    }
    else if (left + popRect.width / 2 > ww - 10) {
      left = ww - popRect.width / 2 - 10
    }

    popoverPos.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translateX(-50%)',
    }
  },
  { deep: true },
)

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
          <Icon icon="mdi:robot-outline" />
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
        <div class="divider" />
        <div v-if="matchingHighlight" class="highlight-actions">
          <button class="tooltip-btn delete-btn" :title="t('analysis.removeHighlight')" @click="deleteHighlight(matchingHighlight.id)">
            <Icon icon="mdi:marker-cancel" />
            <span>{{ t('analysis.removeHighlight') }}</span>
          </button>
        </div>
        <div v-else class="highlight-actions">
          <div v-if="isSavingHighlight" class="saving-loader">
            <Icon icon="mdi:loading" class="spin-animation" />
          </div>
          <button v-else class="tooltip-btn" :title="t('analysis.saveToNotebook')" @click="openSaveModal">
            <Icon icon="mdi:bookmark-plus-outline" />
            <span>{{ t('analysis.saveToNotebook') }}</span>
          </button>
        </div>
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
