<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { SelectionTooltip, SentenceAnalysis, WordPopover } from '~/components/03.domain/analysis'
import { useDictionaryStore } from '~/components/05.modules/dictionary/store/dictionary.store'

import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

import BookCoverPanel from './book-cover-panel.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookTocPanel from './book-toc-panel.vue'

const route = useRoute()
const router = useRouter()
const store = useBooksStore()
const dictStore = useDictionaryStore()

const bookId = computed(() => Number(route.params.id))

watch(
  bookId,
  (newId) => {
    if (newId)
      store.fetchBookInfo(newId)
  },
  { immediate: true },
)

onMounted(() => {
  if (dictStore.words.length === 0) {
    dictStore.fetchDictionary()
  }
})

function goBack() {
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="book-info-page">
    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
      <span class="header-title">О книге</span>
    </header>

    <div v-if="store.isLoading && !store.currentBookInfo" class="loading-state">
      <div class="layout-grid">
        <KitSkeleton width="100%" height="400px" border-radius="12px" />
        <div class="content-col">
          <KitSkeleton width="80%" height="32px" class="title-skeleton" />
          <KitSkeleton width="40%" height="20px" class="author-skeleton" />
          <KitSkeleton width="100%" height="150px" border-radius="12px" />
        </div>
      </div>
    </div>

    <div v-else-if="store.currentBookInfo" class="book-container">
      <div class="layout-grid">
        <BookCoverPanel />

        <div class="content-col">
          <BookStatsPanel />
          <BookLexicalPanel />
          <BookTocPanel />
        </div>
      </div>
    </div>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
  </div>
</template>

<style lang="scss" scoped>
.book-info-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100dvh;

  @include media-down(md) {
    padding: 16px;
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

.layout-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 40px;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
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
