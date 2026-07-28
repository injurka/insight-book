<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PageLoader } from '~/components/02.shared/page-loader'
import { useTextSelection } from '~/components/04.features/analysis/index.ts'
import { getMediaUrl } from '~/shared/lib/helpers'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store.ts'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useMangaBubbles } from '../composables/use-manga-bubbles'
import { usePanZoom } from '../composables/use-pan-zoom'
import { useReaderContent } from '../composables/use-reader-content'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights'
import { useReaderNavigation } from '../composables/use-reader-navigation'
import { useReaderScroll } from '../composables/use-reader-scroll'
import { useReadingSession } from '../composables/use-reading-session'
import { useScrollRestoration } from '../composables/use-scroll-restoration'
import { useReaderStore } from '../store/reader.store'
import ReaderTocDialog from './dialog/reader-toc-dialog.vue'
import ReaderBrightness from './partials/reader-brightness.vue'
import ReaderFooter from './partials/reader-footer.vue'
import ReaderHeader from './partials/reader-header.vue'

const BubblePopover = lazyComponent(() => import('~/components/04.features/analysis/ui/popover/bubble-popover.vue'))
const PageAnalysisModal = lazyComponent(() => import('~/components/04.features/analysis/ui/modal/page-analysis-modal.vue'))
const SelectionTooltip = lazyComponent(() => import('~/components/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/components/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/components/04.features/analysis/ui/popover/word-popover.vue'))

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
const mangaContainerRef = useTemplateRef<HTMLElement>('mangaContainerRef')
const mangaWrapperRef = useTemplateRef<HTMLElement>('mangaWrapperRef')

useAppWakeLock(() => analysisStore.isManualPageAnalysisActive || analysisStore.isAutoPageAnalysisActive)
useReadingSession()

const { saveScrollPosition, restoreScrollPosition, setScrollIntent } = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const {
  scale,
  panX,
  panY,
  isPanning,
  isPinching,
  dragDist,
  resetZoom,
} = usePanZoom(mangaContainerRef, mangaWrapperRef)

const {
  activeBubble,
  bubbleReference,
  handleBubbleClick,
  handleBubblePointerDown,
  closeBubblePopover,
  handleBubblePopoverClick,
  getBoxStyle,
  getOuterNumberStyle,
  getBubbleHighlightStyle,
} = useMangaBubbles(onPointerDown, onWordClick)

const { isHeaderVisible, onScroll } = useReaderScroll(saveScrollPosition, closeBubblePopover)

const { parallelTranslations } = useReaderContent()

function handleWrapperClick(e: MouseEvent) {
  if (dragDist.value > 10 && scale.value > 1) {
    dragDist.value = 0
    return
  }
  onWordClick(e)
}

watch(() => readerStore.currentPage, () => {
  resetZoom()
})

watch(() => readerStore.isPageLoading, async (isLoading) => {
  if (isLoading) {
    closeBubblePopover()
  }
  if (!isLoading && readerStore.currentPage) {
    await nextTick()
    setTimeout(restoreScrollPosition, 50)

    if (settingsStore.parallelViewMode !== 'none') {
      analysisStore.analyzeWholePage({ sentences: true, words: false, ttsSentences: false, ttsWords: false }, true)
    }
  }
}, { immediate: true })

watch(() => settingsStore.parallelViewMode, (mode) => {
  if (mode !== 'none' && !readerStore.isPageLoading && readerStore.currentPage) {
    analysisStore.analyzeWholePage({ sentences: true, words: false, ttsSentences: false, ttsWords: false }, true)
  }
})

onMounted(() => {
  document.addEventListener('click', closeBubblePopover)
})

onUnmounted(() => {
  document.removeEventListener('click', closeBubblePopover)
})
</script>

<template>
  <div ref="readerViewRef" class="manga-reader-view" @scroll.passive="onScroll">
    <ReaderHeader :is-visible="isHeaderVisible" />

    <div class="reader-content-wrapper">
      <div v-if="readerStore.isPageLoading && !readerStore.currentPage" class="reader-loading-wrapper">
        <div class="spinner-box">
          <PageLoader />
        </div>
        <h3 class="loading-text">
          {{ t('reader.preparingPageTitle') }}
        </h3>
        <p class="loading-subtext">
          {{ t('reader.preparingPageDesc') }}
        </p>
      </div>

      <div
        v-else-if="readerStore.currentPage?.imageUrl"
        :key="readerStore.currentPage.pageNum"
        class="manga-layout-wrapper page-enter-anim"
        :class="{ 'is-parallel': settingsStore.parallelViewMode !== 'none', 'is-loading': readerStore.isPageLoading }"
      >
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
                  :class="[
                    {
                      'is-active': (activeBubble?.id === box.id && settingsStore.mangaOcrDisplayMode === 'popover') || settingsStore.parallelViewMode !== 'none',
                      'mode-hover': settingsStore.mangaOcrDisplayMode === 'hover',
                      'mode-popover': settingsStore.mangaOcrDisplayMode === 'popover' || settingsStore.parallelViewMode !== 'none',
                      'has-parallel': settingsStore.parallelViewMode !== 'none',
                      'has-highlight': Object.keys(getBubbleHighlightStyle(box)).length > 0,
                    },
                  ]"
                  :style="[getBoxStyle(box), getBubbleHighlightStyle(box)]"
                  @mousedown="handleBubblePointerDown($event, box)"
                  @touchstart="handleBubblePointerDown($event, box)"
                  @click="handleBubbleClick($event, box, dragDist, scale)"
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
            <div
              v-for="(trans, idx) in parallelTranslations"
              :key="trans.id"
              class="manga-translation-item"
              @mousedown="onPointerDown"
              @touchstart="onPointerDown"
              @mouseup="onPointerUp"
              @touchend="onPointerUp"
              @touchcancel="onPointerUp"
              @mouseleave="onPointerUp"
              @mouseover="onSentenceHover"
              @mouseout="onSentenceOut"
            >
              <div class="translation-number">
                {{ idx + 1 }}
              </div>
              <div class="translation-html" v-html="trans.html" />
            </div>
          </div>
        </div>
      </div>
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

    <ReaderTocDialog @go-to="goToPage" />
    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <PageAnalysisModal />
    <ReaderBrightness />

    <ReaderFooter @prev="prevPage" @next="nextPage" @go-to="goToPage" />
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
  min-height: calc(100% - 70px);
}

.manga-layout-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  transition:
    opacity 0.2s ease,
    filter 0.2s ease;

  &.is-loading {
    opacity: 0.4;
    filter: blur(2px);
    pointer-events: none;
  }

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

  &.has-highlight::before {
    background-color: var(--hl-bg) !important;
    border-color: var(--hl-border) !important;
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
        &.exact-highlight {
          border-radius: 0;
        }
        transition:
          background-color 0.1s,
          color 0.1s;

        &.add-space {
          padding-right: 0.25em;
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  transform: translate(-50%, -50%);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  transition: all 0.2s ease;
}

.reader-loading-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 32px;
  text-align: center;
  .spinner-box {
    height: 80px;
    margin-bottom: 24px;
    :deep(.page-loader) {
      min-height: unset;
    }
  }
  .loading-text {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0 0 8px 0;
  }
  .loading-subtext {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter-anim {
  animation: pageEnter 0.2s ease-out 0.1s both;
}
</style>
