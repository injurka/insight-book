<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import BooksVirtualGrid from './books-virtual-grid.vue'
import LibrarySkeletonGrid from './library-skeleton-grid.vue'

interface Props {
  books: Book[]
  isLoading: boolean
  hasMore: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'openBook', book: Book): void
  (e: 'editBook', book: Book): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="public-catalog-view">
    <h3 class="series-title">
      <Icon icon="mdi:earth" />
      <span class="text">{{ t('library.menuPublicCatalog') }}</span>
    </h3>

    <LibrarySkeletonGrid v-if="isLoading && books.length === 0" :count="10" />

    <div v-else-if="books.length === 0" class="empty-state">
      <h2>{{ t('library.emptySection') }}</h2>
    </div>

    <BooksVirtualGrid
      v-else
      :books="props.books"
      :has-more="props.hasMore"
      :is-loading="props.isLoading"
      @load-more="emit('loadMore')"
      @open-book="(book) => emit('openBook', book)"
      @edit-book="(book) => emit('editBook', book)"
    />
  </div>
</template>

<style lang="scss" scoped>
.public-catalog-view {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  padding-bottom: 24px;
}

.series-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  color: var(--fg-accent-color);
  margin: 0 0 16px 0;
  border-bottom: 2px solid var(--border-secondary-color);
  padding-bottom: 8px;
  height: 28px;
  flex-shrink: 0;

  .text {
    flex-grow: 1;
  }
}

.empty-state {
  text-align: center;
  padding: 64px 24px;
  background-color: var(--bg-secondary-color);
  border-radius: 16px;
  border: 1px dashed var(--border-primary-color);
  h2 {
    margin-bottom: 12px;
    color: var(--fg-primary-color);
  }
}
</style>
