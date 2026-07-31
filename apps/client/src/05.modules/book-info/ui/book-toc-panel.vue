<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useLibraryStore } from '../../library/store/library.store'

const libraryStore = useLibraryStore()
const router = useRouter()
const { t } = useI18n()

function goToPage(pageNum?: number) {
  if (!pageNum || !libraryStore.currentBookInfo)
    return
  router.push({
    path: AppRoutePaths.Reader,
    query: { bookId: libraryStore.currentBookInfo.id, page: pageNum },
  })
}
</script>

<template>
  <div v-if="libraryStore.currentBookInfo?.toc && libraryStore.currentBookInfo.toc.length > 0" class="toc-section">
    <h3>{{ t('bookInfo.tableOfContents') }}</h3>
    <div class="toc-list">
      <div
        v-for="item in libraryStore.currentBookInfo.toc"
        :key="item.id"
        class="toc-item"
        :style="{ paddingLeft: `${(item.level - 1) * 16}px` }"
        @click="goToPage(item.pageNum)"
      >
        <span class="toc-title">{{ item.title }}</span>
        <span class="toc-dots" />
        <span class="toc-page">{{ item.pageNum || '-' }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.toc-section {
  h3 {
    font-size: 1.4rem;
    margin: 0 0 16px 0;
    color: var(--fg-primary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 8px;
  }
  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
}
</style>
