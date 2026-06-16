<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import DOMPurify from 'dompurify'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { PageAnalysisModal, SelectionTooltip, SentenceAnalysis, useTextSelection, WordPopover } from '~/components/03.domain/analysis'
import { useUmami } from '~/shared/composables/use-umami'
import { useAnalysisStore } from '~/shared/store/analysis.store'

import { useGlobalSettingsStore } from '~/shared/store/settings.store'
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

const isHeaderVisible = ref(true)
let lastScrollY = 0
let scrollAccumulator = 0

const { saveScrollPosition, restoreScrollPosition, setScrollIntent } = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()
const { trackEvent } = useUmami()

let readingSessionStartTime = 0

onMounted(() => {
  readingSessionStartTime = Date.now()
})

onUnmounted(() => {
  const durationSeconds = Math.round((Date.now() - readingSessionStartTime) / 1000)
  if (durationSeconds > 10) {
    trackEvent('reading_session_ended', {
      duration_seconds: durationSeconds,
      book_id: readerStore.currentBook?.id,
    })
  }
})

useAppWakeLock(() => analysisStore.isManualPageAnalysisActive || analysisStore.isAutoPageAnalysisActive)

const safePageContent = computed(() => {
  if (!readerStore.currentPage?.content)
    return ''

  return DOMPurify.sanitize(readerStore.currentPage.content, {
    ADD_ATTR: ['data-sent-id', 'data-raw-sent', 'data-word', 'data-pos', 'data-token-idx'],
  })
})

const translationMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of analysisStore.analysisHistory) {
    map[item.sentence] = item.analysis.translation
  }
  return map
})

const translatedPageContent = computed(() => {
  if (!safePageContent.value || !readerStore.isParallelView)
    return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(safePageContent.value, 'text/html')
  const map = translationMap.value

  const translatedSentIds = new Set<string>()

  doc.querySelectorAll('.sentence').forEach((span) => {
    const rawSent = decodeURIComponent(span.getAttribute('data-raw-sent') || '')
    const sentId = span.getAttribute('data-sent-id') || ''

    if (map[rawSent]) {
      if (translatedSentIds.has(sentId)) {
        span.innerHTML = '';
        (span as any).style.display = 'none'
      }
      else {
        span.innerHTML = map[rawSent]
        span.classList.add('has-translation')
        translatedSentIds.add(sentId)
      }
    }
    else {
      span.innerHTML = `<span class="untranslated-text">${span.innerHTML}</span>`
    }
  })
  return doc.body.innerHTML
})

function syncHeights() {
  const leftPane = readerViewRef.value?.querySelector('.left-pane')
  const rightPane = readerViewRef.value?.querySelector('.right-pane')

  if (!leftPane || !rightPane)
    return

  const selectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, img'

  const getNodes = (pane: Element) => {
    const all = Array.from(pane.querySelectorAll(selectors)) as HTMLElement[]
    return all.filter(el => el.querySelectorAll(selectors).length === 0)
  }

  const leftNodes = getNodes(leftPane)
  const rightNodes = getNodes(rightPane)

  leftNodes.forEach(el => el.style.minHeight = '')
  rightNodes.forEach(el => el.style.minHeight = '')

  if (!readerStore.isParallelView)
    return

  const leftRect = leftPane.getBoundingClientRect()
  const rightRect = rightPane.getBoundingClientRect()
  if (Math.abs(leftRect.top - rightRect.top) > 10) {
    return
  }

  const minLen = Math.min(leftNodes.length, rightNodes.length)
  const heights = [minLen].fill(0)

  for (let i = 0; i < minLen; i++) {
    const leftHeight = leftNodes[i].getBoundingClientRect().height
    const rightHeight = rightNodes[i].getBoundingClientRect().height
    heights[i] = Math.max(leftHeight, rightHeight)
  }

  for (let i = 0; i < minLen; i++) {
    if (heights[i] > 0) {
      leftNodes[i].style.minHeight = `${heights[i]}px`
      rightNodes[i].style.minHeight = `${heights[i]}px`
    }
  }
}

function performLayoutSync() {
  if (readerStore.isParallelView) {
    syncHeights()
  }
  restoreScrollPosition()
}

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

useResizeObserver(readerViewRef, () => {
  if (readerStore.isParallelView && !readerStore.isPageLoading) {
    syncHeights()
  }
})

function onScroll(e: Event) {
  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }
  if (analysisStore.selectionTooltip) {
    analysisStore.closeSelectionTooltip()
  }
  saveScrollPosition()

  // Логика видимости хэдера с буфером (предотвращает скрытие от микро-сдвигов пальца)
  const target = e.target as HTMLElement
  const currentY = Math.max(0, target.scrollTop)
  const delta = currentY - lastScrollY
  lastScrollY = currentY

  if (currentY < 80) {
    isHeaderVisible.value = true
    scrollAccumulator = 0
  }
  else {
    // Сброс буфера при смене направления
    if ((delta > 0 && scrollAccumulator < 0) || (delta < 0 && scrollAccumulator > 0)) {
      scrollAccumulator = 0
    }
    scrollAccumulator += delta

    if (scrollAccumulator > 50) {
      isHeaderVisible.value = false
      scrollAccumulator = 50 // cap
    }
    else if (scrollAccumulator < -50) {
      isHeaderVisible.value = true
      scrollAccumulator = -50 // cap
    }
  }
}
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <div class="swipe-container">
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
                v-html="safePageContent"
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
    </div>

    <WordPopover />
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
.swipe-container {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.reader-content-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: 80px;
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
    border-radius: 4px;
    transition: background-color 0.2s ease;
    &:hover,
    &.is-hovered {
      background-color: var(--bg-hover-color);
    }
  }
  :deep(.untranslated-text) {
    opacity: 0.4;
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
      font-weight: 600;
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
