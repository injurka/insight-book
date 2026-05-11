<script setup lang="ts">
import { KitBtn } from '~/components/01.kit'
import { useReaderStore } from '../store/reader.store'

const emit = defineEmits(['prev', 'next'])
const readerStore = useReaderStore()
</script>

<template>
  <footer class="reader-footer" @click.stop>
    <KitBtn icon="mdi:chevron-left" variant="text" :disabled="(readerStore.currentBook?.currentPage || 1) <= 1" @click="emit('prev')">
      Назад
    </KitBtn>
    <span v-if="readerStore.currentBook" class="page-info">
      {{ readerStore.currentBook.currentPage }} / {{ readerStore.currentBook.totalPages }}
    </span>
    <KitBtn append-icon="mdi:chevron-right" variant="text" :disabled="(readerStore.currentBook?.currentPage || 1) >= (readerStore.currentBook?.totalPages || 1)" @click="emit('next')">
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
