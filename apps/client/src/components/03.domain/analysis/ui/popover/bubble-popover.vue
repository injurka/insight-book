<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { computed, onUnmounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { useHighlightsStore } from '~/components/05.modules/reader/store/highlights.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useTts } from '~/shared/composables/use-tts'
import { normalizeString } from '~/shared/lib/helpers'
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const props = defineProps<{
  box: any
  referenceEl: HTMLElement | null
}>()
const highlightsStore = useHighlightsStore()
const readerStore = useReaderStore()
const isSavingHighlight = ref(false)

const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']
const isSaveModalOpen = ref(false)
const selectedColor = ref(highlightColors[0])
const modalText = ref('')
const modalTranslation = ref('')
const isFetchingTranslation = ref(false)
const previewTranslation = ref(true)

async function openSaveModal() {
  if (!props.box?.text || !readerStore.currentBook)
    return

  modalText.value = props.box.text.replace(/\n+/g, '')
  modalTranslation.value = ''
  previewTranslation.value = true
  isSaveModalOpen.value = true
  isFetchingTranslation.value = true

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
  await createHighlight(selectedColor.value)
  isSaveModalOpen.value = false
}

const matchingHighlight = computed(() => {
  if (!props.box?.text || !readerStore.currentBook)
    return null
  const rawNorm = normalizeString(props.box.text)
  return highlightsStore.highlights.find((h) => {
    const hNorm = normalizeString(h.text)
    return Number(h.bookId) === Number(readerStore.currentBook?.id) && (rawNorm === hNorm || (hNorm.length >= 2 && (rawNorm.includes(hNorm) || hNorm.includes(rawNorm))))
  })
})

async function createHighlight(color: string) {
  if (!modalText.value || !readerStore.currentBook || !readerStore.currentPage)
    return
  if (isSavingHighlight.value)
    return

  const text = modalText.value
  const translation = modalTranslation.value
  const pageNum = readerStore.currentPage.pageNum
  const bookId = readerStore.currentBook.id
  const language = readerStore.currentBook.language || 'en'

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

    analysisStore.closePopover()
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
  }
  catch (err) {
    console.error('Failed to delete highlight', err)
  }
}

const floating = ref<HTMLElement | null>(null)

const { x, y, strategy } = useFloating(toRef(props, 'referenceEl'), floating, {
  placement: 'bottom',
  strategy: 'fixed',
  middleware: [offset(8), flip(), shift({ padding: 12 })],
  whileElementsMounted: autoUpdate,
})

const style = computed(() => {
  const isPositioned = x.value != null && y.value != null
  return {
    position: strategy.value,
    top: `${y.value ?? 0}px`,
    left: `${x.value ?? 0}px`,
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  }
})

const { t } = useI18n()
const analysisStore = useAnalysisStore()
const { speak, stop, isPlaying, isLoading } = useTts()

function analyzeSentence() {
  if (props.box?.text) {
    const readerStore = useReaderStore()
    const text = props.box.text.replace(/\n+/g, '')
    let context = ''

    const blocks = readerStore.currentPage?.ocrBlocks || []
    const idx = blocks.findIndex(b => b.id === props.box.id)
    if (idx !== -1) {
      const prev = idx > 0 ? blocks[idx - 1].text.replace(/\n+/g, '') : ''
      const next = idx < blocks.length - 1 ? blocks[idx + 1].text.replace(/\n+/g, '') : ''
      context = `${prev} [${text}] ${next}`.trim()
    }

    analysisStore.closePopover()
    analysisStore.handleSentenceAnalysis(text, context)
  }
}

function playTTS() {
  if (props.box?.text) {
    if (isPlaying.value || isLoading.value) {
      stop()
    }
    else {
      speak(props.box.text.replace(/\n+/g, ''))
    }
  }
}

onUnmounted(() => stop())
</script>

<template>
  <Transition name="fade">
    <div
      v-if="box && referenceEl"
      ref="floating"
      class="bubble-popover-container"
      :style="style"
    >
      <div class="bubble-actions" @mousedown.stop @touchstart.stop>
        <button class="action-btn" :title="t('analysis.aiAnalysis')" @click.stop="analyzeSentence">
          <Icon icon="mdi:robot-outline" />
        </button>
        <button class="action-btn" :title="t('analysis.voice')" @click.stop="playTTS">
          <Icon
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
          />
        </button>

        <button
          v-if="matchingHighlight"
          class="action-btn delete-btn"
          :title="t('analysis.removeHighlight')"
          @click.stop="deleteHighlight(matchingHighlight.id)"
        >
          <Icon icon="mdi:marker-cancel" />
        </button>
        <template v-else>
          <div v-if="isSavingHighlight" class="action-btn" style="cursor: default;">
            <Icon icon="mdi:loading" class="spin-animation" style="color: var(--fg-accent-color);" />
          </div>
          <button
            v-else
            class="action-btn"
            :title="t('analysis.saveToNotebook')"
            @click.stop="openSaveModal"
          >
            <Icon icon="mdi:bookmark-plus-outline" />
          </button>
        </template>
      </div>

      <div class="bubble-popover js-tooltip-selectable">
        <div class="bubble-popover-text" v-html="box.html || box.text.replace(/\n+/g, '')" />
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
</template>

<style lang="scss" scoped>
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

.bubble-popover-container {
  position: fixed;
  z-index: var(--z-modal, 1250);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.bubble-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;

  .action-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: var(--fg-primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1.4rem;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-accent-color);
      transform: scale(1.05);
    }
  }

  .action-btn.color-btn {
    border-color: rgba(0, 0, 0, 0.1);
  }

  .action-btn.delete-btn {
    color: var(--fg-error-color, #ef4444);
    border-color: var(--fg-error-color, #ef4444);
  }
}

.bubble-popover {
  background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  padding: 12px;
  border-radius: 12px;
  max-width: 400px;
  width: max-content;
  color: var(--fg-primary-color);
  user-select: none;
  pointer-events: auto;

  .bubble-popover-text {
    font-size: 1.25rem;
    line-height: 1.5;
    text-align: left;
    writing-mode: horizontal-tb;
    word-break: break-word;
    cursor: pointer;

    :deep(.sentence) {
      display: inline;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s ease;
      &:hover,
      &.is-hovered {
        background-color: var(--bg-hover-color);
      }
    }

    :deep(.word) {
      padding: 0;
      border-radius: 4px;
      transition:
        background-color 0.1s,
        color 0.1s;
      &.add-space {
        margin-right: 0.25em;
      }
      &.is-punctuation {
        cursor: default;
      }
      &.is-active {
        background-color: var(--fg-accent-color);
        color: var(--bg-primary-color);
        font-weight: bold;
      }
    }
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
  transform: translateY(-5px);
}

.spin-animation {
  animation: spin 1s linear infinite;
}

.pulse-animation {
  animation: pulse-op 1.2s ease-in-out infinite;
  color: var(--fg-accent-color);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 600px) {
  .bubble-popover-container {
    flex-direction: column-reverse;
    align-items: flex-end;
  }

  .bubble-actions {
    flex-direction: row;
  }
}
</style>
