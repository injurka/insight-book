<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { BOOK_COVER_TRANSITION_NAME, coverTransitionBookId } from '~/01.shared/lib/view-transitions'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/index.ts'
import { KitBtn, KitImage, KitSkeleton } from '~/02.kit/index.ts'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import BookCoverPanel from './book-cover-panel.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookTocPanel from './book-toc-panel.vue'

const SelectionTooltip = lazyComponent(() => import('~/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/04.features/analysis/ui/popover/word-popover.vue'))
const AppendMangaModal = lazyComponent(() => import('./modal/append-manga-modal.vue'))
const BookSyncModal = lazyComponent(() => import('./modal/book-sync-modal.vue'))

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const { t } = useI18n()

useHead({
  title: computed(() => libraryStore.currentBookInfo?.title || t('bookInfo.aboutBook')),
})

const bookId = computed(() => Number(route.params.id))
const isEditingStats = ref(false)
const isSyncModalOpen = ref(false)
const isAppendChapterOpen = ref(false)

// Пока данные книги грузятся, целью shared-element перехода обложки
// служит скелетон обложки (View Transitions API)
const skeletonCoverTransitionStyle = computed(() =>
  coverTransitionBookId.value === bookId.value
    ? { viewTransitionName: BOOK_COVER_TRANSITION_NAME }
    : undefined)

// Данные книги уже известны из списка библиотеки — используем их в состоянии
// загрузки, чтобы первый переход на страницу был бесшовным (View Transitions API)
const knownBook = computed(() =>
  libraryStore.books.find(b => b.id === bookId.value)
  || libraryStore.publicBooks.find(b => b.id === bookId.value)
  || null)

const optimisticCoverUrl = computed(() =>
  knownBook.value?.localCoverUrl || knownBook.value?.coverUrl || null)

watch(bookId, (newId) => {
  if (newId)
    libraryStore.fetchBookInfo(newId)
}, { immediate: true })

function goBack() {
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="book-info-scroll-wrapper">
    <KitHoverRevealBg />

    <div class="book-info-page">
      <header class="page-header">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
        <span class="header-title">{{ t('bookInfo.aboutBook') }}</span>
      </header>

      <div v-if="libraryStore.isLoading && !libraryStore.currentBookInfo" class="loading-state book-container">
        <div class="layout-top">
          <div class="cover-col">
            <div class="cover-skeleton" :style="skeletonCoverTransitionStyle">
              <KitImage
                v-if="optimisticCoverUrl"
                :src="optimisticCoverUrl"
                :alt="t('library.cover')"
                :lazy="false"
              />
              <KitSkeleton
                v-else
                width="100%"
                height="100%"
                border-radius="12px"
              />
            </div>
            <div class="action-buttons">
              <KitSkeleton width="100%" height="38px" border-radius="6px" />
              <KitSkeleton width="100%" height="38px" border-radius="6px" />
            </div>
          </div>
          <div class="content-col">
            <h1 v-if="knownBook" class="opt-book-title">
              {{ knownBook.title }}
            </h1>
            <KitSkeleton
              v-else
              width="80%"
              height="40px"
              class="title-skeleton"
              border-radius="8px"
            />
            <p v-if="knownBook" class="opt-book-author">
              {{ knownBook.author || t('bookStats.authorNotSpecified') }}
            </p>
            <KitSkeleton
              v-else
              width="40%"
              height="24px"
              class="author-skeleton"
              border-radius="6px"
            />
            <KitSkeleton
              width="100%"
              height="72px"
              border-radius="12px"
              class="progress-skeleton"
            />
            <KitSkeleton width="100%" height="240px" border-radius="12px" />
          </div>
        </div>
        <div class="layout-bottom">
          <KitSkeleton width="100%" height="300px" border-radius="12px" />
        </div>
      </div>

      <div v-else-if="libraryStore.currentBookInfo" class="book-container">
        <div class="layout-top">
          <BookCoverPanel
            @edit-stats="isEditingStats = true"
            @open-sync="isSyncModalOpen = true"
            @open-append-chapter="isAppendChapterOpen = true"
          />
          <div class="content-col">
            <BookStatsPanel v-model:is-editing="isEditingStats" />
          </div>
        </div>
        <div class="layout-bottom">
          <BookLexicalPanel v-if="libraryStore.currentBookInfo.type !== 'manga'" />
          <BookTocPanel />
        </div>
      </div>
    </div>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <BookSyncModal v-if="libraryStore.currentBookInfo" v-model:visible="isSyncModalOpen" :book-id="bookId" />
    <AppendMangaModal v-model:visible="isAppendChapterOpen" />
  </div>
</template>

<style lang="scss" scoped>
.book-info-scroll-wrapper {
  padding-top: var(--safe-area-top);

  height: 100%;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.book-info-page {
  position: relative;
  z-index: 1;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);

  @include media-down(md) {
    padding: 16px 8px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  .header-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.layout-top {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 40px;
  margin-bottom: 32px;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
}

.layout-bottom {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.loading-state {
  .cover-skeleton {
    aspect-ratio: 2 / 3;
    margin-bottom: 24px;
    border-radius: 12px;
    overflow: hidden;
  }
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .opt-book-title {
    font-size: 2.2rem;
    line-height: 1.2;
    margin: 0 0 8px 0;
    color: var(--fg-primary-color);
  }
  .opt-book-author {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    margin: 0 0 24px 0;
  }
  .title-skeleton {
    margin-bottom: 8px;
  }
  .author-skeleton {
    margin-bottom: 24px;
  }
  .progress-skeleton {
    margin-bottom: 24px;
  }
}

.content-col {
  min-width: 0;
}
</style>
