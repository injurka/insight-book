<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/02.kit'
import { useReaderStore } from '../../store/reader.store'

const emit = defineEmits<{
  (e: 'goTo', pageNum?: number): void
}>()

const readerStore = useReaderStore()
const { t } = useI18n()

function handlePageClick(pageNum?: number) {
  emit('goTo', pageNum)
}
</script>

<template>
  <KitDialog
    v-model:visible="readerStore.tocOpen"
    :title="t('bookInfo.tableOfContents')"
    :max-width="500"
    icon="mdi:format-list-bulleted"
    :minimizable="false"
  >
    <div v-if="readerStore.currentToc && readerStore.currentToc.length > 0" class="toc-list">
      <div
        v-for="item in readerStore.currentToc"
        :key="item.id"
        class="toc-item"
        :style="{ paddingLeft: `${(item.level - 1) * 16}px` }"
        @click="handlePageClick(item.pageNum)"
      >
        <span class="toc-title">{{ item.title }}</span>
        <span class="toc-dots" />
        <span class="toc-page">{{ item.pageNum || '-' }}</span>
      </div>
    </div>
    <div v-else-if="readerStore.currentBook?.totalPages" class="toc-grid">
      <div
        v-for="i in readerStore.currentBook.totalPages"
        :key="i"
        class="toc-grid-item"
        @click="handlePageClick(i)"
      >
        {{ i }}
      </div>
    </div>
    <div v-else class="empty-state">
      <p>{{ t('reader.tocEmpty') }}</p>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.toc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
  max-height: 50vh;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.toc-item {
  display: flex;
  align-items: flex-end;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
  color: var(--fg-secondary-color);

  &:hover {
    background-color: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    .toc-page {
      color: var(--fg-accent-color);
      font-weight: 600;
    }
  }
  .toc-title {
    flex-shrink: 0;
    font-size: 0.95rem;
  }
  .toc-dots {
    flex-grow: 1;
    border-bottom: 1px dotted var(--border-secondary-color);
    margin: 0 12px 5px 12px;
    opacity: 0.5;
  }
  .toc-page {
    flex-shrink: 0;
    font-size: 0.9rem;
    transition: color 0.2s;
  }
}

.toc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.toc-grid-item {
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  background-color: var(--bg-secondary-color);
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--fg-primary-color);
  transition: all 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}

.empty-state {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 16px 0;
}
</style>
