<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { KitBtn, KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { SelectionTooltip, SentenceAnalysis, WordPopover } from '~/components/03.domain/analysis'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useReaderStore } from '../store/reader.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const route = useRoute()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')

const translationMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of analysisStore.analysisHistory) {
    map[item.sentence] = item.analysis.translation
  }
  return map
})

const translatedPageContent = computed(() => {
  if (!readerStore.currentPage?.content || !readerStore.isParallelView)
    return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(readerStore.currentPage.content, 'text/html')
  const map = translationMap.value

  doc.querySelectorAll('.sentence').forEach((span) => {
    const rawSent = decodeURIComponent(span.getAttribute('data-raw-sent') || '')
    if (map[rawSent]) {
      span.innerHTML = map[rawSent]
      span.classList.add('has-translation')
    }
    else {
      span.innerHTML = `<span class="untranslated-text">${span.innerHTML}</span>`
    }
  })
  return doc.body.innerHTML
})

// --- ЛОГИКА СИНХРОНИЗАЦИИ ВЫСОТЫ БЛОКОВ ПАРАЛЛЕЛЬНОГО ЧТЕНИЯ ---
function syncHeights() {
  const leftPane = readerViewRef.value?.querySelector('.left-pane')
  const rightPane = readerViewRef.value?.querySelector('.right-pane')

  if (!leftPane || !rightPane)
    return

  // Теги, которые мы хотим выравнивать
  const selectors = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, img'

  // Получаем узлы, исключая вложенные (чтобы не было двойного увеличения высоты)
  const getNodes = (pane: Element) => {
    const all = Array.from(pane.querySelectorAll(selectors)) as HTMLElement[]
    return all.filter(el => el.querySelectorAll(selectors).length === 0)
  }

  const leftNodes = getNodes(leftPane)
  const rightNodes = getNodes(rightPane)

  // Всегда сначала сбрасываем высоты
  leftNodes.forEach(el => el.style.minHeight = '')
  rightNodes.forEach(el => el.style.minHeight = '')

  if (!readerStore.isParallelView)
    return

  // Если панели перешли в колоночный мобильный вид (одна под другой) - не применяем высоты
  const leftRect = leftPane.getBoundingClientRect()
  const rightRect = rightPane.getBoundingClientRect()
  if (Math.abs(leftRect.top - rightRect.top) > 10) {
    return
  }

  // Применяем максимальную высоту к парам
  const minLen = Math.min(leftNodes.length, rightNodes.length)
  for (let i = 0; i < minLen; i++) {
    const leftEl = leftNodes[i]
    const rightEl = rightNodes[i]

    const leftHeight = leftEl.getBoundingClientRect().height
    const rightHeight = rightEl.getBoundingClientRect().height

    const maxH = Math.max(leftHeight, rightHeight)

    if (maxH > 0) {
      leftEl.style.minHeight = `${maxH}px`
      rightEl.style.minHeight = `${maxH}px`
    }
  }
}

watch(
  [() => readerStore.isParallelView, translatedPageContent],
  async () => {
    await nextTick()
    setTimeout(syncHeights, 100) // Даем немного времени на рендер шрифтов и отступов
  },
)

useResizeObserver(readerViewRef, () => {
  if (readerStore.isParallelView) {
    syncHeights()
  }
})
// ------------------------------------------------------------------

function onSentenceHover(event: MouseEvent) {
  if (!readerStore.isParallelView)
    return
  const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
  if (!target)
    return

  const sentId = target.getAttribute('data-sent-id')
  if (sentId && readerViewRef.value) {
    readerViewRef.value.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
      el.classList.add('is-hovered')
    })
  }
}

function onSentenceOut(event: MouseEvent) {
  if (!readerStore.isParallelView)
    return
  const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
  if (!target)
    return

  const sentId = target.getAttribute('data-sent-id')
  if (sentId && readerViewRef.value) {
    readerViewRef.value.querySelectorAll(`.sentence[data-sent-id="${sentId}"]`).forEach((el) => {
      el.classList.remove('is-hovered')
    })
  }
}

watch(() => analysisStore.activeTokenId, (newId, oldId) => {
  if (oldId) {
    const [sentId, tokenIdx] = oldId.split('-')
    const el = readerViewRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
    if (el)
      el.classList.remove('is-active')
  }
  if (newId) {
    const [sentId, tokenIdx] = newId.split('-')
    const el = readerViewRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
    if (el)
      el.classList.add('is-active')
  }
})

function prevPage() {
  if (readerStore.currentBook && (readerStore.currentBook.currentPage || 1) > 1) {
    const newPage = (readerStore.currentBook.currentPage || 1) - 1
    readerStore.loadPage(readerStore.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    readerViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function nextPage() {
  if (readerStore.currentBook && (readerStore.currentBook.currentPage || 1) < readerStore.currentBook.totalPages) {
    const newPage = (readerStore.currentBook.currentPage || 1) + 1
    readerStore.loadPage(readerStore.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    readerViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function goToPage(pageNum?: number) {
  if (!pageNum || !readerStore.currentBook)
    return
  readerStore.tocOpen = false
  readerStore.loadPage(readerStore.currentBook.id, pageNum)
  router.replace({ query: { ...route.query, page: pageNum } })
  readerViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

let pressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(event: MouseEvent | TouchEvent) {
  const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
  if (!target)
    return

  const rawSentEnc = target.dataset.rawSent
  if (!rawSentEnc)
    return

  const rawSent = decodeURIComponent(rawSentEnc)

  // Если в предложении нет букв/иероглифов/цифр, не анализируем
  if (!/[\p{L}\p{N}]/u.test(rawSent))
    return

  pressTimer = setTimeout(() => {
    analysisStore.closePopover()
    analysisStore.closeSelectionTooltip()
    window.getSelection()?.empty()
    analysisStore.handleSentenceAnalysis(rawSent)
    pressTimer = null
  }, 500)
}

function onPointerUp() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onContentClick(event: MouseEvent) {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }

  const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
  if (!target)
    return

  const pos = target.dataset.pos
  if (pos === 'x')
    return

  const word = decodeURIComponent(target.dataset.word || '')
  const sentenceId = Number(target.dataset.sentId)
  const tokenIndex = Number(target.dataset.tokenIdx)

  if (!word || Number.isNaN(sentenceId) || Number.isNaN(tokenIndex) || !pos)
    return

  window.getSelection()?.empty()

  event.stopPropagation()
  analysisStore.handleWordClick(word, pos, sentenceId, tokenIndex, target)
}

function onScroll() {
  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }
  if (analysisStore.selectionTooltip) {
    analysisStore.closeSelectionTooltip()
  }
}
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <div class="swipe-container">
      <ReaderHeader />

      <div class="reader-content-wrapper">
        <div v-if="readerStore.isPageLoading" class="reader-loading-wrapper">
          <div class="spinner-box">
            <PageLoader />
          </div>
          <h3 class="loading-text">
            Подготовка страницы...
          </h3>
          <p class="loading-subtext">
            Первичное чтение текста и распознавание слов может занять несколько секунд.
          </p>
        </div>

        <div v-else-if="readerStore.currentPage" class="reader-layout-wrapper">
          <div class="reader-content-layout" :class="{ 'is-parallel': readerStore.isParallelView }">
            <div
              class="reader-content left-pane js-tooltip-selectable"
              @click="onContentClick"
              @mousedown="onPointerDown"
              @touchstart="onPointerDown"
              @mouseup="onPointerUp"
              @touchend="onPointerUp"
              @touchcancel="onPointerUp"
              @mouseleave="onPointerUp"
              @mouseover="onSentenceHover"
              @mouseout="onSentenceOut"
              v-html="readerStore.currentPage.content"
            />

            <div
              v-if="readerStore.isParallelView"
              class="reader-content right-pane"
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
      </div>

      <ReaderFooter @prev="prevPage" @next="nextPage" />
    </div>

    <Transition name="fade">
      <div v-if="analysisStore.isAnalyzingPage" class="page-analysis-overlay">
        <div class="analysis-dialog">
          <h3>Анализ страницы</h3>
          <p>Обработано {{ analysisStore.pageAnalysisCurrent }} из {{ analysisStore.pageAnalysisTotal }} элементов...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisProgress}%` }" />
          </div>
          <KitBtn color="secondary" variant="outlined" @click="analysisStore.cancelPageAnalysis">
            Отмена
          </KitBtn>
        </div>
      </div>
    </Transition>

    <WordPopover />
    <SelectionTooltip />

    <KitDialog v-model:visible="readerStore.tocOpen" title="Оглавление" :max-width="500" icon="mdi:format-list-bulleted">
      <div v-if="readerStore.currentToc.length === 0" class="empty-state">
        <p>Оглавление пусто или не загружено.</p>
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
  </div>
</template>

<style lang="scss" scoped>
.reader-view {
  height: 100dvh;
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
  font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
  font-size: 1.4rem;
  line-height: 1.8;
  color: var(--fg-primary-color);
  user-select: text;
  word-wrap: break-word;

  @include media-down(sm) {
    font-size: 1.25rem;
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
.page-analysis-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  .analysis-dialog {
    background-color: var(--bg-secondary-color);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-primary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    text-align: center;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    h3 {
      margin: 0;
      color: var(--fg-primary-color);
      font-size: 1.25rem;
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 0.95rem;
    }
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;
      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        transition: width 0.3s ease;
      }
    }
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
