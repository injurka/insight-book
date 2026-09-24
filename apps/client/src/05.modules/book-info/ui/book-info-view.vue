<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
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

watch(bookId, (newId) => {
  if (newId)
    libraryStore.fetchBookInfo(newId)
}, { immediate: true })

function goBack() {
  router.replace(AppRoutePaths.Home)
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

      <div v-if="libraryStore.isLoading || libraryStore.currentBookInfo" class="book-container">
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
          <BookLexicalPanel v-if="libraryStore.currentBookInfo?.type !== 'manga'" />
          <BookTocPanel />
        </div>

        <Transition name="skeleton-fade">
          <div
            v-if="!libraryStore.hasLoadedBookInfo && !libraryStore.currentBookInfo"
            class="skeleton-overlay"
            aria-hidden="true"
          >
            <div class="layout-top">
              <div class="cover-col">
                <div class="cover-skeleton">
                  <KitSkeleton width="100%" height="100%" border-radius="12px" />
                </div>
                <div class="action-buttons">
                  <KitSkeleton
                    class="skeleton-primary"
                    width="100%"
                    height="38px"
                    border-radius="6px"
                  />
                  <KitSkeleton
                    class="skeleton-secondary"
                    width="100%"
                    height="38px"
                    border-radius="6px"
                  />
                </div>
              </div>
              <div class="content-col">
                <KitSkeleton
                  width="80%"
                  height="40px"
                  class="title-skeleton"
                  border-radius="8px"
                />
                <KitSkeleton
                  width="40%"
                  height="24px"
                  class="author-skeleton"
                  border-radius="6px"
                />
                <div class="progress-skeleton">
                  <KitSkeleton width="55%" height="19px" border-radius="5px" />
                  <KitSkeleton width="100%" height="6px" border-radius="3px" />
                </div>
                <div class="stats-skeleton">
                  <KitSkeleton width="35%" height="22px" border-radius="5px" />
                  <div class="stats-skeleton-grid">
                    <KitSkeleton width="100%" height="42px" border-radius="6px" />
                    <KitSkeleton width="100%" height="42px" border-radius="6px" />
                    <KitSkeleton width="100%" height="42px" border-radius="6px" />
                  </div>
                  <KitSkeleton width="100%" height="72px" border-radius="6px" />
                </div>
              </div>
            </div>
          </div>
        </Transition>
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

.book-container {
  position: relative;
}

.skeleton-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  pointer-events: none;
}

.skeleton-fade-enter-active,
.skeleton-fade-leave-active {
  transition: opacity 0.3s ease;
}

.skeleton-fade-enter-from,
.skeleton-fade-leave-to {
  opacity: 0;
}

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

  @include media-down(md) {
    flex-direction: row;
    gap: 8px;

    .skeleton-primary {
      flex: 1;
      width: auto !important;
    }

    .skeleton-secondary {
      width: 38px !important;
      flex-shrink: 0;
    }
  }
}

.title-skeleton {
  margin-bottom: 8px;
}

.author-skeleton {
  margin-bottom: 24px;
}

.progress-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  margin-bottom: 24px;
  background-color: var(--bg-primary-color);
  border-radius: 12px;
}

.stats-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-accent-color);
  border-radius: 12px;
}

.stats-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.progress-skeleton > .kit-skeleton:last-child {
  opacity: 0.8;
}

.content-col {
  min-width: 0;
}
</style>
