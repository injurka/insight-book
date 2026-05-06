<script setup lang="ts">
import { KitDialog } from '~/components/01.kit'
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
const readerContentRef = useTemplateRef<HTMLElement>('readerContentRef')

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

function onContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
  if (!target)
    return

  const pos = target.dataset.pos
  if (pos === 'x')
    return

  const word = target.dataset.word
  const sentenceId = Number(target.dataset.sentId)
  const tokenIndex = Number(target.dataset.tokenIdx)

  if (!word || isNaN(sentenceId) || isNaN(tokenIndex) || !pos)
    return

  window.getSelection()?.empty()

  event.stopPropagation()
  store.handleWordClick(word, pos, sentenceId, tokenIndex, target)
}

function onSentenceLongPress(sentenceRaw: string) {
  store.closePopover()
  store.closeSelectionTooltip()
  window.getSelection()?.empty()
  store.handleSentenceAnalysis(sentenceRaw)
}

function onScroll() {
  if (store.wordPopover) {
    store.closePopover()
  }
  if (store.selectionTooltip) {
    store.closeSelectionTooltip()
  }
}

const shouldAddSpace = computed(() => {
  const lang = store.currentBook?.language || 'en'
  return !['zh', 'ja'].includes(lang.toLowerCase())
})
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

        <div v-else-if="store.currentPage" ref="readerContentRef" class="reader-content container js-tooltip-selectable" @click="onContentClick">
          <span
            v-for="sentence in store.currentPage.content" :key="sentence.sentenceId"
            v-long-press="() => onSentenceLongPress(sentence.raw)"
            class="sentence"
          >
            <span
              v-for="(token, i) in sentence.tokens"
              :key="i"
              class="word"
              :class="{
                'is-active': store.activeTokenId === `${sentence.sentenceId}-${i}`,
                'is-punctuation': token.pos === 'x',
                'add-space': shouldAddSpace && token.pos !== 'x',
              }"
              :data-word="token.word"
              :data-pos="token.pos"
              :data-sent-id="sentence.sentenceId"
              :data-token-idx="i"
            >{{ token.word }}</span>
          </span>
        </div>
      </div>

      <ReaderFooter @prev="prevPage" @next="nextPage" />
    </div>

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
}

.reader-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 24px;
  font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
  font-size: 1.4rem;
  line-height: 2.2;
  color: var(--fg-primary-color);
  user-select: text;
  white-space: pre-wrap;
  word-wrap: break-word;

  @include media-down(sm) {
    padding: 16px 16px;
    font-size: 1.25rem;
  }

  & ::selection {
    background-color: var(--bg-accent-overlay-color);
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

.sentence {
  display: inline;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
  }
}

.word {
  display: inline-block;
  padding: 0 1px;
  border-radius: 4px;
  transition:
    background-color 0.1s,
    color 0.1s;

  &.add-space {
    margin-right: 0.25em;
  }

  &.is-punctuation.add-space {
    margin-right: 0;
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
