<script setup lang="ts">
import { KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { BubblePopover, PageAnalysisModal, SelectionTooltip, SentenceAnalysis, useTextSelection, WordPopover } from '~/components/03.domain/analysis'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { getMediaUrl } from '~/workers/service/lib/utils'

import { usePanZoom } from '../composables/use-pan-zoom'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights'
import { useReaderNavigation } from '../composables/use-reader-navigation'
import { useReaderWakeLock } from '../composables/use-reader-wakelock'
import { useScrollRestoration } from '../composables/use-scroll-restoration'
import { useReaderStore } from '../store/reader.store'

import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
const mangaContainerRef = useTemplateRef<HTMLElement>('mangaContainerRef')
const mangaWrapperRef = useTemplateRef<HTMLElement>('mangaWrapperRef')

const { saveScrollPosition, restoreScrollPosition, setScrollIntent } = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

useReaderWakeLock()
const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

// === ЛОГИКА PAN & ZOOM ===
const { scale, panX, panY, isPanning, isPinching, dragDist, resetZoom } = usePanZoom(mangaContainerRef, mangaWrapperRef)

watch(() => readerStore.currentPage, () => {
  resetZoom()
})

function handleWrapperClick(e: MouseEvent) {
  if (dragDist.value > 10 && scale.value > 1) {
    dragDist.value = 0
    return
  }
  onWordClick(e)
}

const activeBubble = ref<any>(null)
const bubbleReference = ref<HTMLElement | null>(null)

function handleBubbleClick(event: MouseEvent, box: any) {
  if (dragDist.value > 10 && scale.value > 1) {
    return
  }

  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }

  if (settingsStore.mangaOcrDisplayMode === 'popover') {
    event.stopPropagation()
    activeBubble.value = box
    bubbleReference.value = event.currentTarget as HTMLElement
  }
}

function handleBubblePointerDown(event: MouseEvent | TouchEvent, box: any) {
  if (settingsStore.mangaOcrDisplayMode === 'hover') {
    onPointerDown(event, box.text)
  }
}

function closeBubblePopover() {
  const target = event?.target as HTMLElement | null
  if (target?.closest('.word-popover') || target?.closest('.kit-dialog') || target?.closest('.selection-tooltip') || target?.closest('.page-analysis-overlay')) {
    return
  }

  activeBubble.value = null
  bubbleReference.value = null
}

function handleBubblePopoverClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
  const pos = target?.dataset.pos

  if (!target || pos === 'x') {
    analysisStore.closePopover()
  }
  else {
    onWordClick(event)
  }
}

onMounted(() => {
  document.addEventListener('click', closeBubblePopover)
})

onUnmounted(() => {
  document.removeEventListener('click', closeBubblePopover)
})

function getBoxStyle(box: any) {
  if (!readerStore.currentPage?.imageWidth || !readerStore.currentPage?.imageHeight)
    return {}
  return {
    left: `${(box.x / readerStore.currentPage.imageWidth) * 100}%`,
    top: `${(box.y / readerStore.currentPage.imageHeight) * 100}%`,
    width: `${(box.w / readerStore.currentPage.imageWidth) * 100}%`,
    height: `${(box.h / readerStore.currentPage.imageHeight) * 100}%`,
  }
}

function onContentEnter(el: Element) {
  if (el.classList.contains('manga-container')) {
    restoreScrollPosition()
  }
}

watch(() => readerStore.isPageLoading, async (isLoading) => {
  if (isLoading) {
    closeBubblePopover()
  }
  if (!isLoading && readerStore.currentPage) {
    await nextTick()
    setTimeout(restoreScrollPosition, 50)
  }
}, { immediate: true })

function onScroll() {
  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }
  if (analysisStore.selectionTooltip) {
    analysisStore.closeSelectionTooltip()
  }
  closeBubblePopover()
  saveScrollPosition()
}
</script>

<template>
  <div ref="readerViewRef" class="manga-reader-view" @scroll.passive="onScroll">
    <ReaderHeader />

    <div class="reader-content-wrapper">
      <Transition name="fade" mode="out-in" @enter="onContentEnter">
        <div v-if="readerStore.isPageLoading" class="reader-loading-wrapper">
          <PageLoader />
          <p class="loading-text">
            Подготовка страницы (OCR & NLP)...
          </p>
        </div>

        <div v-else-if="readerStore.currentPage?.imageUrl" ref="mangaContainerRef" class="manga-container">
          <div
            ref="mangaWrapperRef"
            class="manga-page-wrapper js-tooltip-selectable"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
              transformOrigin: '0 0',
              cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              transition: isPinching || isPanning ? 'none' : 'transform 0.1s ease-out',
              willChange: 'transform',
            }"
            @click="handleWrapperClick"
            @mouseup="onPointerUp"
            @touchend="onPointerUp"
            @touchcancel="onPointerUp"
            @mouseleave="onPointerUp"
          >
            <img :src="`${getMediaUrl(readerStore.currentPage.imageUrl)}`" class="manga-image" @load="restoreScrollPosition">

            <div class="ocr-overlay">
              <div
                v-for="box in readerStore.currentPage.ocrBlocks"
                :key="box.id"
                class="ocr-bubble"
                :class="{
                  'is-active': activeBubble?.id === box.id && settingsStore.mangaOcrDisplayMode === 'popover',
                  'mode-hover': settingsStore.mangaOcrDisplayMode === 'hover',
                  'mode-popover': settingsStore.mangaOcrDisplayMode === 'popover',
                }"
                :style="getBoxStyle(box)"
                @mousedown="handleBubblePointerDown($event, box)"
                @touchstart="handleBubblePointerDown($event, box)"
                @click="handleBubbleClick($event, box)"
              >
                <div v-if="settingsStore.mangaOcrDisplayMode === 'hover'" class="bubble-text-preview" v-html="box.html || box.text.replace(/\n+/g, '')" />
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <BubblePopover
      :box="activeBubble"
      :reference-el="bubbleReference"
      @click.stop="handleBubblePopoverClick"
      @mousedown.stop="onPointerDown($event, activeBubble?.text)"
      @touchstart.stop="onPointerDown($event, activeBubble?.text)"
      @mouseup="onPointerUp"
      @touchend="onPointerUp"
      @touchcancel="onPointerUp"
      @mouseleave="onPointerUp"
      @mouseover="onSentenceHover"
      @mouseout="onSentenceOut"
    />

    <ReaderFooter @prev="prevPage" @next="nextPage" @go-to="goToPage" />

    <KitDialog v-model:visible="readerStore.tocOpen" title="Оглавление" :max-width="500" icon="mdi:format-list-bulleted">
      <div v-if="readerStore.currentToc && readerStore.currentToc.length > 0" class="toc-list">
        <div
          v-for="item in readerStore.currentToc"
          :key="item.id"
          class="toc-item"
          :style="{ paddingLeft: `${(item.level - 1) * 16}px` }"
          @click="goToPage(item.pageNum)"
        >
          <span class="toc-title">{{ item.title }}</span>
          <span class="toc-dots" />
          <span class="toc-page">{{ item.pageNum || '-' }}</span>
        </div>
      </div>
      <div v-else class="toc-grid">
        <div v-for="i in readerStore.currentBook?.totalPages" :key="i" class="toc-grid-item" @click="goToPage(i)">
          {{ i }}
        </div>
      </div>
    </KitDialog>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <PageAnalysisModal />
  </div>
</template>

<style lang="scss" scoped>
.manga-reader-view {
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary-color);
  overflow-y: auto;
  overflow-x: hidden;

  &[data-theme='light'] {
    background-color: #f5f5f5;
  }
  &[data-theme='dark'] {
    background-color: #0d1117;
  }
}

.reader-content-wrapper {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0px;
  position: relative;
}

.manga-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  user-select: none;
}

.manga-page-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  z-index: 1;

  & ::selection {
    background-color: var(--bg-accent-overlay-color);
  }
}

.manga-image {
  max-width: 100%;
  max-height: 85vh;
  display: block;
  object-fit: contain;
  border-radius: 4px;
  pointer-events: none;
}

.ocr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ocr-bubble {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    inset: -12px;
    border-radius: 12px;
    background-color: transparent;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    z-index: 1;
  }

  &.mode-hover {
    .bubble-text-preview {
      position: absolute;
      inset: 0;
      z-index: 2;
      opacity: 0;
      color: var(--fg-primary-color);
      font-size: 0.95rem;
      font-weight: 600;
      text-align: center;
      word-break: break-all;
      transition: opacity 0.2s ease;

      display: flex;
      flex-wrap: wrap;
      align-content: center;
      justify-content: center;

      text-shadow:
        -1px -1px 0 var(--bg-primary-color),
        1px -1px 0 var(--bg-primary-color),
        -1px 1px 0 var(--bg-primary-color),
        1px 1px 0 var(--bg-primary-color);

      :deep(.sentence) {
        display: inline;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.2s ease;

        &:hover {
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
          &:hover {
            background-color: transparent;
            color: inherit;
          }
        }

        &.is-active {
          background-color: var(--fg-accent-color);
          color: var(--bg-primary-color);
          font-weight: bold;
          text-shadow: none;
        }
      }
    }

    &:hover {
      &::before {
        background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.4);
        backdrop-filter: blur(4px) brightness(1.2);
      }
      .bubble-text-preview {
        opacity: 1;
      }
    }
  }

  &.mode-popover {
    &.is-active::before {
      border-color: var(--fg-accent-color);
      background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.2);
    }
  }
}

.reader-loading-wrapper {
  text-align: center;
  .loading-text {
    margin-top: 16px;
    color: var(--fg-secondary-color);
  }
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  max-height: 50vh;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.toc-item {
  display: flex;
  align-items: flex-end;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
  color: var(--fg-secondary-color);

  &:hover {
    background-color: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    .toc-page {
      color: var(--fg-accent-color);
      font-weight: 600;
    }
  }
  .toc-title {
    flex-shrink: 0;
    font-size: 0.95rem;
  }
  .toc-dots {
    flex-grow: 1;
    border-bottom: 1px dotted var(--border-secondary-color);
    margin: 0 12px 5px 12px;
    opacity: 0.5;
  }
  .toc-page {
    flex-shrink: 0;
    font-size: 0.9rem;
    transition: color 0.2s;
  }
}

.toc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.toc-grid-item {
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  background-color: var(--bg-secondary-color);
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
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
</style>
