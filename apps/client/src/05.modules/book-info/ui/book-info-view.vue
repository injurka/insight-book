<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import BookCoverPanel from './book-cover-panel.vue'
import BookInfoSkeleton from './book-info-skeleton.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookTocPanel from './book-toc-panel.vue'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const { t } = useI18n()

const SelectionTooltip = lazyComponent(() => import('~/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/04.features/analysis/ui/popover/word-popover.vue'))
const AppendMangaModal = lazyComponent(() => import('./modal/append-manga-modal.vue'))
const BookSyncModal = lazyComponent(() => import('./modal/book-sync-modal.vue'))
const isEditingStats = ref(false)
const isSyncModalOpen = ref(false)
const isAppendChapterOpen = ref(false)

const bookId = computed(() => Number(route.params.id))
const isBookReady = computed(() =>
  libraryStore.hasLoadedBookInfo && libraryStore.currentBookInfo?.id === bookId.value)

watch(bookId, (newId) => {
  if (newId)
    libraryStore.fetchBookInfo(newId)
}, { immediate: true })

function goBack() {
  router.replace(AppRoutePaths.Home)
}

useHead({
  title: computed(() => libraryStore.currentBookInfo?.title || t('bookInfo.aboutBook')),
})
</script>

<template>
  <div class="book-info-scroll-wrapper">
    <KitHoverRevealBg />

    <div class="book-info-page">
      <header class="page-header">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
        <span class="header-title">{{ t('bookInfo.aboutBook') }}</span>
      </header>

      <div v-if="!libraryStore.hasLoadedBookInfo || libraryStore.currentBookInfo" class="book-container" :aria-busy="!isBookReady">
        <div v-if="isBookReady" class="layout-top">
          <BookCoverPanel
            @open-sync="isSyncModalOpen = true"
            @open-append-chapter="isAppendChapterOpen = true"
          />
          <div class="content-col">
            <BookStatsPanel v-model:is-editing="isEditingStats" />
          </div>
        </div>
        <div v-if="isBookReady" class="layout-bottom">
          <BookLexicalPanel v-if="libraryStore.currentBookInfo?.type !== 'manga'" />
          <BookTocPanel />
        </div>

        <BookInfoSkeleton v-if="!isBookReady" />
      </div>
    </div>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <BookSyncModal v-if="isBookReady" v-model:visible="isSyncModalOpen" :book-id="bookId" />
    <AppendMangaModal v-model:visible="isAppendChapterOpen" />
  </div>
</template>

<style lang="scss" scoped>
.book-info-scroll-wrapper {
  padding-top: var(--safe-area-top);

  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
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
    max-width: 500px;
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

.content-col {
  min-width: 0;
}
</style>
