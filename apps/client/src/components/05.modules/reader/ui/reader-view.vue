<script setup lang="ts">
import { useSwipe } from '@vueuse/core'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KitDialog, KitSkeleton } from '~/components/01.kit'
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
        <div v-if="store.isPageLoading || store.isLoading" class="reader-loading container">
          <KitSkeleton v-for="i in 15" :key="i" width="100%" height="24px" class="mb-4" />
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
        >
          {{ item.title }}
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

.reader-loading {
  max-width: 800px;
  margin: 0 auto;
  padding: 48px 24px;
  flex-grow: 1;
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
  gap: 8px;
}

.toc-item {
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-secondary-color);
  color: var(--fg-primary-color);
  font-size: 0.95rem;

  &:last-child {
    border-bottom: none;
  }
}

.empty-state {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 16px 0;
}
</style>
