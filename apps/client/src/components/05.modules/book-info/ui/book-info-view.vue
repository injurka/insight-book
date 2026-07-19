<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { AppRoutePaths } from '~/shared/constants/routes'
import BookCoverPanel from './book-cover-panel.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookTocPanel from './book-toc-panel.vue'

const SelectionTooltip = lazyComponent(() => import('~/components/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/components/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/components/04.features/analysis/ui/popover/word-popover.vue'))
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

watch(
  bookId,
  (newId) => {
    if (newId)
      libraryStore.fetchBookInfo(newId)
  },
  { immediate: true },
)

function goBack() {
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="book-info-scroll-wrapper">
    <HoverRevealBg />

    <div class="book-info-page">
      <header class="page-header">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
        <span class="header-title">{{ t('bookInfo.aboutBook') }}</span>
      </header>

      <div v-if="libraryStore.isLoading && !libraryStore.currentBookInfo" class="loading-state book-container">
        <div class="layout-top">
          <div class="cover-col">
            <KitSkeleton width="100%" height="auto" class="cover-skeleton" border-radius="12px" />
            <div class="action-buttons">
              <KitSkeleton width="100%" height="38px" border-radius="6px" />
              <KitSkeleton width="100%" height="38px" border-radius="6px" />
            </div>
          </div>
          <div class="content-col">
            <KitSkeleton width="80%" height="40px" class="title-skeleton" border-radius="8px" />
            <KitSkeleton width="40%" height="24px" class="author-skeleton" border-radius="6px" />
            <KitSkeleton width="100%" height="100px" border-radius="12px" class="progress-skeleton" />
            <KitSkeleton width="100%" height="250px" border-radius="12px" />
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
  }
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
