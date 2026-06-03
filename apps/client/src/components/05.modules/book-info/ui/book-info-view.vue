<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { SelectionTooltip, SentenceAnalysis, WordPopover } from '~/components/03.domain/analysis'

import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { AppRoutePaths } from '~/shared/constants/routes'

import BookCoverPanel from './book-cover-panel.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookSyncModal from './book-sync-modal.vue'
import BookTocPanel from './book-toc-panel.vue'

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()

const bookId = computed(() => Number(route.params.id))
const isEditingStats = ref(false)
const isSyncModalOpen = ref(false)

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
        <span class="header-title">О книге</span>
      </header>

      <div v-if="libraryStore.isLoading && !libraryStore.currentBookInfo" class="loading-state">
        <div class="layout-top">
          <KitSkeleton width="100%" height="400px" border-radius="12px" />
          <div class="content-col">
            <KitSkeleton width="80%" height="32px" class="title-skeleton" />
            <KitSkeleton width="40%" height="20px" class="author-skeleton" />
            <KitSkeleton width="100%" height="150px" border-radius="12px" />
          </div>
        </div>
      </div>

      <div v-else-if="libraryStore.currentBookInfo" class="book-container">
        <div class="layout-top">
          <BookCoverPanel @edit-stats="isEditingStats = true" @open-sync="isSyncModalOpen = true" />
          <div class="content-col">
            <BookStatsPanel v-model:is-editing="isEditingStats" />
          </div>
        </div>
        <div class="layout-bottom">
          <BookLexicalPanel />
          <BookTocPanel />
        </div>
      </div>
    </div>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <BookSyncModal v-if="libraryStore.currentBookInfo" v-model:visible="isSyncModalOpen" :book-id="bookId" />
  </div>
</template>

<style lang="scss" scoped>
.book-info-scroll-wrapper {
  height: 100dvh;
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
  .title-skeleton {
    margin-bottom: 16px;
  }
  .author-skeleton {
    margin-bottom: 16px;
  }
}

.content-col {
  min-width: 0;
}
</style>
