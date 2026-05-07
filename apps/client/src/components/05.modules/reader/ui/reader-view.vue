<script setup lang="ts">
import { watch } from 'vue'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'

import { useBooksStore } from '~/shared/store/books.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'
import SelectionTooltip from './selection-tooltip.vue'
import SentenceAnalysis from './sentence-analysis.vue'
import WordPopover from './word-popover.vue'

const store = useBooksStore()
const router = useRouter()
const route = useRoute()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')

watch(() => store.activeTokenId, (newId, oldId) => {
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
  if (store.currentBook && (store.currentBook.currentPage || 1) > 1) {
    const newPage = (store.currentBook.currentPage || 1) - 1
    store.loadPage(store.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    readerViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function nextPage() {
  if (store.currentBook && (store.currentBook.currentPage || 1) < store.currentBook.totalPages) {
    const newPage = (store.currentBook.currentPage || 1) + 1
    store.loadPage(store.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    readerViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function goToPage(pageNum?: number) {
  if (!pageNum || !store.currentBook)
    return
  store.tocOpen = false
  store.loadPage(store.currentBook.id, pageNum)
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

  pressTimer = setTimeout(() => {
    store.closePopover()
    store.closeSelectionTooltip()
    window.getSelection()?.empty()
    store.handleSentenceAnalysis(rawSent)
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
  store.handleWordClick(word, pos, sentenceId, tokenIndex, target)
}

function onScroll() {
  if (store.wordPopover) {
    store.closePopover()
  }
  if (store.selectionTooltip) {
    store.closeSelectionTooltip()
  }
}
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <div class="swipe-container">
      <ReaderHeader />

      <div class="reader-content-wrapper">
        <div v-if="store.isPageLoading || store.isLoading" class="reader-loading-wrapper">
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

        <div
          v-else-if="store.currentPage"
          class="reader-content container js-tooltip-selectable"
          @click="onContentClick"
          @mousedown="onPointerDown"
          @touchstart="onPointerDown"
          @mouseup="onPointerUp"
          @touchend="onPointerUp"
          @touchcancel="onPointerUp"
          @mouseleave="onPointerUp"
          v-html="store.currentPage.content"
        />
      </div>

      <ReaderFooter @prev="prevPage" @next="nextPage" />
    </div>

    <Transition name="fade">
      <div v-if="store.isAnalyzingPage" class="page-analysis-overlay">
        <div class="analysis-dialog">
          <h3>Анализ страницы</h3>
          <p>Обработано {{ store.pageAnalysisCurrent }} из {{ store.pageAnalysisTotal }} предложений...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${store.pageAnalysisProgress}%` }" />
          </div>
          <KitBtn color="secondary" variant="outlined" @click="store.cancelPageAnalysis">
            Отмена
          </KitBtn>
        </div>
      </div>
    </Transition>

    <WordPopover />
    <SelectionTooltip />

    <KitDialog v-model:visible="store.tocOpen" title="Оглавление" :max-width="500" icon="mdi:format-list-bulleted">
      <div v-if="store.currentToc.length === 0" class="empty-state">
        <p>Оглавление пусто или не загружено.</p>
      </div>
      <div v-else class="toc-list">
        <div
          v-for="item in store.currentToc"
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

.reader-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 24px;
  font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
  font-size: 1.4rem;
  line-height: 1.8;
  color: var(--fg-primary-color);
  user-select: text;
  word-wrap: break-word;

  @include media-down(sm) {
    padding: 16px 16px;
    font-size: 1.25rem;
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
