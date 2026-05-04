<script setup lang="ts">
import { useSwipe } from '@vueuse/core'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { useBooksStore } from '~/shared/store/books.store'

import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'
import SentenceAnalysis from './sentence-analysis.vue'
import WordPopover from './word-popover.vue'

const store = useBooksStore()
const router = useRouter()
const route = useRoute()

const readerViewRef = ref<HTMLElement | null>(null)
const swipeContainerRef = ref<HTMLElement | null>(null)

const swipeOffsetX = ref(0)
const isSwiping = ref(false)

const { lengthX } = useSwipe(swipeContainerRef, {
  passive: false,
  onSwipeStart: (e) => {
    const target = e.target as HTMLElement
    if (target.closest('.word, .sentence'))
      return false
    isSwiping.value = true
  },
  onSwipe: () => {
    if (!isSwiping.value)
      return
    const isFirstPage = (store.currentBook?.currentPage || 1) <= 1
    const isLastPage = (store.currentBook?.currentPage || 1) >= (store.currentBook?.totalPages || 1)

    let offset = -lengthX.value
    if (isFirstPage && offset > 0)
      offset *= 0.2
    if (isLastPage && offset < 0)
      offset *= 0.2

    swipeOffsetX.value = offset
  },
  onSwipeEnd: () => {
    if (!isSwiping.value)
      return
    isSwiping.value = false
    const threshold = window.innerWidth * 0.25

    if (lengthX.value > threshold) {
      nextPage()
    }
    else if (lengthX.value < -threshold) {
      prevPage()
    }
    swipeOffsetX.value = 0
  },
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

function onWordClick(token: any, sentenceId: number, tokenIndex: number, event: MouseEvent) {
  if (token.pos === 'PU')
    return
  event.stopPropagation()
  store.handleWordClick(token.word, token.pos, sentenceId, tokenIndex, event.target as HTMLElement)
}

function onSentenceLongPress(sentenceRaw: string) {
  store.closePopover()
  store.handleSentenceAnalysis(sentenceRaw)
}

function onScroll() {
  if (store.wordPopover) {
    store.closePopover()
  }
}
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <div
      ref="swipeContainerRef"
      class="swipe-container"
      :style="{ transform: `translateX(${swipeOffsetX}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease-out' }"
    >
      <ReaderHeader />

      <div class="reader-content-wrapper">
        <!-- Красивый лоудер вместо скелетона -->
        <div v-if="store.isPageLoading || store.isLoading" class="reader-loading-wrapper">
          <div class="spinner-box">
            <PageLoader />
          </div>
          <h3 class="loading-text">
            Подготовка страницы...
          </h3>
          <p class="loading-subtext">
            Первичное чтение текста и распознавание иероглифов может занять несколько секунд.
          </p>
        </div>

        <div v-else-if="store.currentPage" class="reader-content container">
          <p
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
                'is-punctuation': token.pos === 'PU',
              }"
              @click="onWordClick(token, sentence.sentenceId, i, $event)"
            >
              {{ token.word }}
            </span>
          </p>
        </div>
      </div>

      <ReaderFooter @prev="prevPage" @next="nextPage" />
    </div>

    <!-- Всплывающее окно со словом -->
    <WordPopover />

    <!-- Модалка оглавления -->
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

    <!-- Сайдбар/Модалка анализа предложения через AI -->
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
  will-change: transform;
  touch-action: pan-y;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
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

  @include media-down(sm) {
    padding: 16px 16px;
    font-size: 1.25rem;
  }
}

/* Стили для лоудера загрузки страницы */
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

    /* Убираем min-height у внутреннего лоудера, если он был, чтобы не ломать верстку */
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
