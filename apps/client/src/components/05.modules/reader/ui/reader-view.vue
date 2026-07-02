<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { useTextSelection } from '~/components/03.domain/analysis'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useParallelSync } from '../composables/use-parallel-sync'
import { useReaderContent } from '../composables/use-reader-content'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights'
import { useReaderNavigation } from '../composables/use-reader-navigation'
import { useReaderScroll } from '../composables/use-reader-scroll'
import { useReadingSession } from '../composables/use-reading-session'
import { useScrollRestoration } from '../composables/use-scroll-restoration'
import { useReaderStore } from '../store/reader.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'

const PageAnalysisModal = lazyComponent(() => import('~/components/03.domain/analysis/ui/modal/page-analysis-modal.vue'))
const SelectionTooltip = lazyComponent(() => import('~/components/03.domain/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/components/03.domain/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/components/03.domain/analysis/ui/popover/word-popover.vue'))
const GrammarPopover = lazyComponent(() => import('~/components/03.domain/analysis/ui/popover/grammar-popover.vue'))

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()
const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
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

const { isHeaderVisible, onScroll } = useReaderScroll(saveScrollPosition)
const { performLayoutSync } = useParallelSync(readerViewRef, restoreScrollPosition)
const { leftPaneContent, translatedPageContent } = useReaderContent()

function onContentEnter(el: Element) {
  if (el.classList.contains('reader-layout-wrapper')) {
    performLayoutSync()
  }
}

watch(
  [
    () => readerStore.isParallelView,
    translatedPageContent,
    () => settingsStore.readerFontSize,
    () => settingsStore.readerLineHeight,
  ],
  async () => {
    if (readerStore.isPageLoading)
      return
    await nextTick()
    setTimeout(performLayoutSync, 50)
  },
)

watch(() => readerStore.isPageLoading, async (isLoading) => {
  if (!isLoading && readerStore.currentPage) {
    await nextTick()
    setTimeout(performLayoutSync, 50)
  }
}, { immediate: true })
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <ReaderHeader :is-visible="isHeaderVisible" />

    <div class="reader-content-wrapper">
      <Transition name="fade" mode="out-in" @enter="onContentEnter">
        <div v-if="readerStore.isPageLoading" class="reader-loading-wrapper">
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

        <div v-else-if="readerStore.currentPage" class="reader-layout-wrapper">
          <div class="reader-content-layout" :class="{ 'is-parallel': readerStore.isParallelView }">
            <div
              class="reader-content left-pane js-tooltip-selectable"
              :style="{
                fontSize: `${settingsStore.readerFontSize}rem`,
                lineHeight: settingsStore.readerLineHeight,
                fontFamily: settingsStore.readerFontFamily,
              }"
              @click="onWordClick"
              @mousedown="onPointerDown"
              @touchstart="onPointerDown"
              @mouseup="onPointerUp"
              @touchend="onPointerUp"
              @touchcancel="onPointerUp"
              @mouseleave="onPointerUp"
              @mouseover="onSentenceHover"
              @mouseout="onSentenceOut"
              v-html="leftPaneContent"
            />

            <div
              v-if="readerStore.isParallelView"
              class="reader-content right-pane"
              :style="{
                fontSize: `${settingsStore.readerFontSize}rem`,
                lineHeight: settingsStore.readerLineHeight,
                fontFamily: settingsStore.readerFontFamily,
              }"
              @mousedown="onPointerDown"
              @touchstart="onPointerDown"
              @mouseup="onPointerUp"
              @touchend="onPointerUp"
              @touchcancel="onPointerUp"
              @mouseleave="onPointerUp"
              @mouseover="onSentenceHover"
              @mouseout="onSentenceOut"
              v-html="translatedPageContent"
            />
          </div>
        </div>
      </Transition>
    </div>

    <ReaderFooter @prev="prevPage" @next="nextPage" @go-to="goToPage" />

    <WordPopover />
    <GrammarPopover />
    <SelectionTooltip />

    <KitDialog v-model:visible="readerStore.tocOpen" :title="t('bookInfo.tableOfContents')" :max-width="500" icon="mdi:format-list-bulleted">
      <div v-if="readerStore.currentToc.length === 0" class="empty-state">
        <p>{{ t('reader.tocEmpty') }}</p>
      </div>
      <div v-else class="toc-list">
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
    </KitDialog>

    <SentenceAnalysis />
    <PageAnalysisModal />
  </div>
</template>

<style lang="scss" scoped>
.reader-view {
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;
  overflow-x: hidden;
  background-color: var(--bg-primary-color);
}
.reader-content-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: 80px;
  min-height: calc(100% - 70px);
}
.reader-layout-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 24px;
  @include media-down(sm) {
    padding: 16px;
  }
}
.reader-content-layout {
  display: flex;
  width: 100%;
  max-width: 800px;
  transition: max-width 0.3s ease;
  gap: 48px;
  &.is-parallel {
    max-width: 1600px;
    .left-pane,
    .right-pane {
      flex: 1;
      min-width: 0;
    }
    .right-pane {
      border-left: 1px dashed var(--border-secondary-color);
      padding-left: 48px;
    }
    @include media-down(md) {
      flex-direction: column;
      gap: 24px;
      .right-pane {
        border-left: none;
        border-top: 1px dashed var(--border-secondary-color);
        padding-left: 0;
        padding-top: 24px;
      }
    }
  }
}
.reader-content {
  width: 100%;
  color: var(--fg-primary-color);
  user-select: text;
  word-wrap: break-word;
  font-size: 1.4rem;
  line-height: 1.8;
  font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
  transition:
    font-size 0.2s,
    line-height 0.2s;

  :deep(svg) {
    height: auto;
  }

  @include media-down(sm) {
    user-select: none;
  }

  & ::selection {
    background-color: var(--bg-accent-overlay-color);
  }
  :deep(p) {
    margin-bottom: 1.2em;
    text-indent: 1.5em;
  }
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    font-weight: 600;
    line-height: 1.3;
    text-align: center;
    color: var(--fg-accent-color);
  }
  :deep(img),
  :deep(image) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1.5em auto;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  :deep(blockquote) {
    border-left: 4px solid var(--fg-secondary-color);
    margin: 1em 0;
    padding-left: 1em;
    font-style: italic;
    color: var(--fg-secondary-color);
  }
  :deep(b),
  :deep(strong) {
    font-weight: bold;
  }
  :deep(i),
  :deep(em) {
    font-style: italic;
  }
  :deep(.sentence) {
    display: inline;
    cursor: pointer;
    transition: background-color 0.2s ease;
    &:hover,
    &.is-hovered {
      background-color: var(--bg-hover-color);
    }
  }
  :deep(.sentence-tts-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: text-bottom;
    position: relative;
    top: -2px;
    width: 28px;
    height: 28px;
    margin-left: 8px;
    margin-right: 4px;
    border: none;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.6;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

    .icon-play,
    .icon-playing {
      width: 16px;
      height: 16px;
    }

    .icon-playing {
      display: none;
    }

    &.is-playing {
      opacity: 1;
      color: var(--fg-accent-color);
      .icon-play {
        display: none;
      }
      .icon-playing {
        display: block;
        animation: pulse 1.5s infinite ease-in-out;
      }
    }

    &:hover {
      opacity: 1;
      background-color: var(--fg-accent-color);
      color: var(--bg-primary-color);
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: scale(0.95);
    }
  }
  :deep(.untranslated-text) {
    opacity: 0.4;
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
      font-weight: 600;
    }
  }
  :deep(.interleaved-translation) {
    display: block;
    text-indent: 0;
    color: var(--fg-secondary-color);
    font-size: 0.9em;
    margin-top: 4px;
    margin-bottom: 12px;
    line-height: 1.5;
    padding-left: 8px;
    border-left: 2px solid var(--border-secondary-color);

    .interleaved-grammar-rules {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .grammar-rule-badge {
      display: inline-flex;
      align-items: center;
      background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.04));
      color: var(--fg-secondary-color);
      border: 1px solid var(--border-primary-color);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.75em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;

      &:hover {
        color: var(--fg-secondary-color);
        background-color: var(--border-primary-color);
      }

      &:active {
        background-color: var(--border-secondary-color);
      }
    }

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

      .grammar-rule-badge {
        color: var(--fg-secondary-color);
        background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.02));
        border-color: transparent;
        box-shadow: none;
        pointer-events: none;
      }
    }
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
.reader-loading-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
.toc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
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
.empty-state {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 16px 0;
}
</style>
