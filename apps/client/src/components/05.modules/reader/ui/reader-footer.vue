<script setup lang="ts">
import { KitBtn } from '~/components/01.kit'
import { useBooksStore } from '~/shared/store/books.store'

const emit = defineEmits(['prev', 'next'])
const store = useBooksStore()
</script>

<template>
  <footer class="reader-footer" @click.stop>
    <KitBtn icon="mdi:chevron-left" variant="text" :disabled="(store.currentBook?.currentPage || 1) <= 1" @click="emit('prev')">
      Назад
    </KitBtn>
    <span v-if="store.currentBook" class="page-info">
      {{ store.currentBook.currentPage }} / {{ store.currentBook.totalPages }}
    </span>
    <KitBtn append-icon="mdi:chevron-right" variant="text" :disabled="(store.currentBook?.currentPage || 1) >= (store.currentBook?.totalPages || 1)" @click="emit('next')">
      Вперед
    </KitBtn>
  </footer>
</template>

<style lang="scss" scoped>
.reader-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;

  .page-info {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    user-select: none;
  }
}
</style>
