<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/components/01.kit'
import BookCard from '../book-card.vue'
import LibrarySkeletonGrid from './library-skeleton-grid.vue'

const props = defineProps<{
  books: Book[]
  isLoading: boolean
  page: number
  total: number
  limit: number
}>()

const emit = defineEmits<{
  (e: 'loadPage', page: number): void
  (e: 'openBook', book: Book): void
  (e: 'editBook', book: Book): void
}>()

const { t } = useI18n()

const totalPages = computed(() => Math.ceil(props.total / props.limit))
</script>

<template>
  <div class="public-catalog-view">
    <h3 class="series-title">
      <Icon icon="mdi:earth" />
      <span class="text">{{ t('library.menuPublicCatalog') }}</span>
    </h3>

    <LibrarySkeletonGrid v-if="isLoading" :count="10" />

    <div v-else-if="books.length === 0" class="empty-state">
      <h2>{{ t('library.emptySection') }}</h2>
    </div>

    <div v-else>
      <div class="books-grid">
        <BookCard
          v-for="book in books"
          :key="book.id"
          :book="book"
          @click="emit('openBook', book)"
          @edit="emit('editBook', book)"
        />
      </div>
      <div v-if="total > limit" class="pagination">
        <KitBtn variant="tonal" :disabled="page <= 1" @click="emit('loadPage', page - 1)">
          {{ t('library.prevPage') }}
        </KitBtn>
        <span>{{ page }} / {{ totalPages }}</span>
        <KitBtn variant="tonal" :disabled="page >= totalPages" @click="emit('loadPage', page + 1)">
          {{ t('library.nextPage') }}
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.public-catalog-view {
  display: flex;
  flex-direction: column;
  padding-bottom: 24px;

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
    font-weight: 500;
  }
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

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
