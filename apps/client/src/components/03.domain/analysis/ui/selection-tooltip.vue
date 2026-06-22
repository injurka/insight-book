<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
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

const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']

const isSaveModalOpen = ref(false)
const selectedColor = ref(highlightColors[0])
const modalText = ref('')
const modalTranslation = ref('')
const isFetchingTranslation = ref(false)
const previewTranslation = ref(true)

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

  modalText.value = analysisStore.selectionTooltip.text.replace(/\n+/g, '')
  modalTranslation.value = ''
  previewTranslation.value = true
  isSaveModalOpen.value = true
  isFetchingTranslation.value = true

  analysisStore.closeSelectionTooltip()
  window.getSelection()?.removeAllRanges()

  try {
    const cached = await offlineService.getAnalysis(modalText.value)
    if (cached && cached.translation) {
      modalTranslation.value = cached.translation
    }
    else {
      const language = readerStore.currentBook.language || 'en'
      const res = await api.books.analyze(readerStore.currentBook.id, modalText.value, language)
      await offlineService.saveAnalysis(modalText.value, res)
      modalTranslation.value = res.translation || ''
    }
  }
  catch (e) {
    console.error('Translation failed:', e)
  }
  finally {
    isFetchingTranslation.value = false
  }
}

async function confirmSaveHighlight() {
  if (!modalText.value || !readerStore.currentBook || !readerStore.currentPage)
    return
  if (isSavingHighlight.value)
    return

  const text = modalText.value
  const translation = modalTranslation.value
  const bookId = readerStore.currentBook.id
  const pageNum = readerStore.currentPage.pageNum
  const color = selectedColor.value

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
      text,
      color,
      pageNum,
      chapter,
      translation,
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

    <KitDialog
      v-model:visible="isSaveModalOpen"
      :title="t('analysis.saveToNotebook')"
      :max-width="500"
    >
      <div class="save-quote-content">
        <div class="quote-preview" :style="{ borderLeftColor: selectedColor }">
          <p>“{{ modalText }}”</p>
        </div>

        <div class="input-group">
          <div class="form-group-header">
            <label class="input-label">{{ t('notebook.translation') }}</label>
            <div class="mode-toggle">
              <KitBtn :variant="!previewTranslation ? 'tonal' : 'text'" size="sm" icon="mdi:pencil" @click="previewTranslation = false" />
              <KitBtn :variant="previewTranslation ? 'tonal' : 'text'" size="sm" icon="mdi:eye" @click="previewTranslation = true" />
            </div>
          </div>
          <div v-if="previewTranslation" class="markdown-preview preview-box" v-html="modalTranslation || (isFetchingTranslation ? t('analysis.analyzing') : '')" />
          <textarea
            v-else
            v-model="modalTranslation"
            class="translation-input"
            rows="3"
            :placeholder="isFetchingTranslation ? t('analysis.analyzing') : ''"
            :disabled="isFetchingTranslation"
          />
        </div>

        <div class="input-group">
          <label class="input-label">{{ t('notebook.color') }}</label>
          <div class="color-picker">
            <button
              v-for="color in highlightColors"
              :key="color"
              type="button"
              class="color-btn"
              :class="{ 'is-active': selectedColor === color }"
              :style="{ backgroundColor: color }"
              @click="selectedColor = color"
            />
            <div
              class="color-btn custom-color-wrapper"
              :class="{ 'is-active': !highlightColors.includes(selectedColor) }"
              :style="{ background: !highlightColors.includes(selectedColor) ? selectedColor : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }"
            >
              <Icon v-if="highlightColors.includes(selectedColor)" icon="mdi:palette" class="custom-color-icon" />
              <input
                v-model="selectedColor"
                type="color"
                class="invisible-color-input"
              >
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-actions">
          <KitBtn variant="tonal" @click="isSaveModalOpen = false">
            {{ t('notebook.cancel') }}
          </KitBtn>
          <KitBtn v-if="isFetchingTranslation" color="primary" disabled>
            <Icon icon="mdi:loading" class="spin-animation" />
          </KitBtn>
          <KitBtn v-else color="primary" @click="confirmSaveHighlight">
            {{ t('notebook.save') }}
          </KitBtn>
        </div>
      </template>
    </KitDialog>
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

.save-quote-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;

  .quote-preview {
    background-color: var(--bg-tertiary-color);
    border-left: 4px solid;
    padding: 12px;
    border-radius: 4px;
    p {
      margin: 0;
      font-style: italic;
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .input-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
      margin: 0;
    }

    .form-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .mode-toggle {
      display: flex;
      gap: 2px;
      background: var(--bg-secondary-color, #f3f4f6);
      padding: 2px;
      border-radius: 6px;

      :deep(.kit-btn) {
        min-width: 28px;
        height: 24px;
        padding: 0;
        --btn-border-radius: 4px;

        svg {
          width: 14px;
          height: 14px;
        }
      }
    }

    .preview-box {
      width: 100%;
      background-color: var(--bg-secondary-color, #f3f4f6);
      color: var(--fg-primary-color);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.95rem;
      min-height: 48px;
      max-height: 300px;
      overflow-y: auto;
      line-height: 1.5;
    }

    .translation-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border-primary-color);
      background-color: transparent;
      color: var(--fg-primary-color);
      font-family: inherit;
      font-size: 0.95rem;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;

      &:focus {
        border-color: var(--fg-primary-color);
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }
  }

  .color-picker {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;

    .color-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      border: none;
      outline: 2px solid transparent;
      outline-offset: -2px;
      transition: outline-color 0.1s;
      padding: 0;

      &.is-active {
        outline-color: var(--fg-primary-color);
      }
    }

    .custom-color-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      .custom-color-icon {
        color: white;
        font-size: 18px;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
        pointer-events: none;
        z-index: 1;
      }

      .invisible-color-input {
        position: absolute;
        top: -5px;
        left: -5px;
        width: calc(100% + 10px);
        height: calc(100% + 10px);
        opacity: 0;
        cursor: pointer;
      }
    }
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
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
