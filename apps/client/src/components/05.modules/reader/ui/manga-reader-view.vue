<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { BubblePopover, PageAnalysisModal, SelectionTooltip, SentenceAnalysis, useTextSelection, WordPopover } from '~/components/03.domain/analysis'
import { getMediaUrl } from '~/shared/lib/helpers.ts'
import { useAnalysisStore } from '~/shared/store/analysis.store'

import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { usePanZoom } from '../composables/use-pan-zoom'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights'
import { useReaderNavigation } from '../composables/use-reader-navigation'

import { useScrollRestoration } from '../composables/use-scroll-restoration'
import { useReaderStore } from '../store/reader.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
const mangaContainerRef = useTemplateRef<HTMLElement>('mangaContainerRef')
const mangaWrapperRef = useTemplateRef<HTMLElement>('mangaWrapperRef')

const { y, directions } = useScroll(readerViewRef)

const isHeaderVisible = computed(() => {
  return y.value < 80 || directions.top
})

const { saveScrollPosition, restoreScrollPosition, setScrollIntent } = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

useAppWakeLock(() => analysisStore.isManualPageAnalysisActive || analysisStore.isAutoPageAnalysisActive)

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

function closeBubblePopover(event?: Event) {
  const target = event?.target as HTMLElement | null
  if (target?.closest && (target.closest('.word-popover') || target.closest('.kit-dialog') || target.closest('.selection-tooltip'))) {
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

  const imgWidth = readerStore.currentPage.imageWidth || 1
  const imgHeight = readerStore.currentPage.imageHeight || 1

  return {
    left: `${(box.x / imgWidth) * 100}%`,
    top: `${(box.y / imgHeight) * 100}%`,
    width: `${(box.w / imgWidth) * 100}%`,
    height: `${(box.h / imgHeight) * 100}%`,
  }
}

function getOuterNumberStyle(box: any) {
  if (!readerStore.currentPage?.imageWidth || !readerStore.currentPage?.imageHeight) return {}
  const imgWidth = readerStore.currentPage.imageWidth || 1
  const imgHeight = readerStore.currentPage.imageHeight || 1

  return {
    left: `calc(${(box.x / imgWidth) * 100}% - 8px)`,
    top: `calc(${(box.y / imgHeight) * 100}% - 8px)`,
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

const translationMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of analysisStore.analysisHistory) {
    map[item.sentence] = item.analysis.translation
  }
  return map
})

const parallelTranslations = computed(() => {
  if (settingsStore.parallelViewMode === 'none' || !readerStore.currentPage?.ocrBlocks) {
    return []
  }
  const map = translationMap.value
  const parser = new DOMParser()

  return readerStore.currentPage.ocrBlocks.map((box) => {
    let resultHtml = ''
    if (box.html) {
      const doc = parser.parseFromString(box.html, 'text/html')
      doc.querySelectorAll('.sentence').forEach((span) => {
        const rawSent = decodeURIComponent(span.getAttribute('data-raw-sent') || '')
        if (map[rawSent]) {
          const blurClass = settingsStore.parallelBlurTranslation ? 'is-blurred' : ''
          span.innerHTML = `<span class="split-translation ${blurClass}" onclick="this.classList.remove('is-blurred')">${map[rawSent]}</span>`
        }
        else {
          span.innerHTML = `<span class="untranslated-text">${span.innerHTML}</span>`
        }
        span.insertAdjacentHTML('afterend', ' ')
      })
      resultHtml = doc.body.innerHTML
    }
    else {
      resultHtml = `<span class="untranslated-text">${box.text.replace(/\n+/g, '')}</span>`
    }

    return {
      id: box.id,
      html: resultHtml,
    }
  })
})

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
    <ReaderHeader :is-visible="isHeaderVisible" />

    <div class="reader-content-wrapper">
      <Transition name="fade" mode="out-in" @enter="onContentEnter">
        <div v-if="readerStore.isPageLoading" class="reader-loading-wrapper">
          <PageLoader />
          <p class="loading-text">
            {{ t('reader.preparingPage') }}
          </p>
        </div>

        <div v-else-if="readerStore.currentPage?.imageUrl" class="manga-layout-wrapper" :class="{ 'is-parallel': settingsStore.parallelViewMode !== 'none' }">
          <div ref="mangaContainerRef" class="manga-container left-pane">
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
              <img :src="readerStore.currentPage.localImageUrl || (readerStore.currentPage.imageUrl ? getMediaUrl(readerStore.currentPage.imageUrl) : '')" class="manga-image" @load="restoreScrollPosition">

              <div class="ocr-overlay">
                <template v-for="(box, idx) in readerStore.currentPage.ocrBlocks" :key="box.id">
                  <div
                    class="ocr-bubble"
                    :class="{
                      'is-active': (activeBubble?.id === box.id && settingsStore.mangaOcrDisplayMode === 'popover') || settingsStore.parallelViewMode !== 'none',
                      'mode-hover': settingsStore.mangaOcrDisplayMode === 'hover',
                      'mode-popover': settingsStore.mangaOcrDisplayMode === 'popover' || settingsStore.parallelViewMode !== 'none',
                      'has-parallel': settingsStore.parallelViewMode !== 'none',
                    }"
                    :style="getBoxStyle(box)"
                    @mousedown="handleBubblePointerDown($event, box)"
                    @touchstart="handleBubblePointerDown($event, box)"
                    @click="handleBubbleClick($event, box)"
                  >
                    <div v-if="settingsStore.mangaOcrDisplayMode === 'hover'" class="bubble-text-preview" v-html="box.html || box.text.replace(/\n+/g, '')" />
                  </div>
                  <div
                    v-if="settingsStore.parallelViewMode !== 'none'"
                    class="bubble-number-outer"
                    :style="getOuterNumberStyle(box)"
                  >
                    {{ idx + 1 }}
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div v-if="settingsStore.parallelViewMode !== 'none'" class="manga-translations-pane right-pane">
            <div class="translations-scroll">
              <div v-for="(trans, idx) in parallelTranslations" :key="trans.id" class="manga-translation-item" @mousedown="onPointerDown" @touchstart="onPointerDown" @mouseup="onPointerUp" @touchend="onPointerUp" @touchcancel="onPointerUp" @mouseleave="onPointerUp" @mouseover="onSentenceHover" @mouseout="onSentenceOut">
                <div class="translation-number">
                  {{ idx + 1 }}
                </div>
                <div class="translation-html" v-html="trans.html" />
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

    <KitDialog v-model:visible="readerStore.tocOpen" :title="t('bookInfo.tableOfContents')" :max-width="500" icon="mdi:format-list-bulleted">
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
  height: 100%;
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
  padding-top: 80px;
}

.manga-layout-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  @include media-down(sm) {
    padding: 16px;
  }

  &.is-parallel {
    align-items: flex-start;
    .left-pane {
      flex: 1;
      height: 100%;
      min-width: 0;
      justify-content: flex-end;
      padding-right: 24px;
    }
    .right-pane {
      flex: 1;
      min-width: 0;
      border-left: 1px dashed var(--border-secondary-color);
      padding-left: 24px;
      height: 100%;
      overflow-y: auto;
    }
    @include media-down(md) {
      flex-direction: column;
      .left-pane {
        padding-right: 0;
        justify-content: center;
        height: auto;
      }
      .right-pane {
        border-left: none;
        border-top: 1px dashed var(--border-secondary-color);
        padding-left: 0;
        padding-top: 24px;
        margin-top: 24px;
        height: auto;
        overflow-y: visible;
      }
    }
  }
}

.manga-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  user-select: none;
}

.manga-translations-pane {
  display: flex;
  flex-direction: column;

  .translations-scroll {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 600px;
  }

  .manga-translation-item {
    display: flex;
    gap: 12px;
    color: var(--fg-primary-color);
    font-size: 1.1rem;
    line-height: 1.6;

    .translation-number {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: var(--fg-accent-color);
      color: var(--bg-primary-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .translation-html {
      flex-grow: 1;

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
        border-radius: 4px;
        &.is-active {
          background-color: var(--fg-accent-color);
          color: var(--bg-primary-color);
          font-weight: 600;
        }
      }
      :deep(.untranslated-text) {
        opacity: 0.4;
      }
      :deep(.split-translation) {
        &.is-blurred {
          filter: blur(5px);
          cursor: pointer;
          opacity: 0.7;
          transition:
            filter 0.2s,
            opacity 0.2s;
          &:hover {
            opacity: 1;
          }
        }
      }
    }
  }
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

.bubble-number-outer {
  position: absolute;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8rem;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  pointer-events: none;
  transform: translate(-50%, -50%);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  transition: all 0.2s ease;
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
