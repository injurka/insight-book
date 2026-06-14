<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { useCacheStore } from '~/shared/store/cache.store'
import { formatBytes, formatPagesList } from '../../lib/formatters'

const { t } = useI18n()
const cacheStore = useCacheStore()

const activeBookStats = computed(() => {
  if (!cacheStore.stats?.bookStats)
    return {}
  const res: Record<string, any> = {}
  for (const [id, book] of Object.entries(cacheStore.stats.bookStats)) {
    if (book.sizeBytes > 0 || book.cachedPages.length > 0 || book.analysesCount > 0) {
      res[id] = book
    }
  }
  return res
})
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.savedBooksData') }}
  </h2>
  <div class="books-list">
    <template v-if="cacheStore.isLoading && !cacheStore.stats">
      <div v-for="i in 2" :key="`mock-${i}`" class="settings-card book-cache-card">
        <div class="book-card-header">
          <div class="title-section">
            <div class="icon-wrapper">
              <Icon icon="mdi:book-open-variant" />
            </div>
            <KitSkeleton width="200px" height="24px" color="var(--bg-tertiary-color)" />
          </div>
          <KitBtn icon="mdi:delete-outline" variant="outlined" class="delete-btn" :disabled="true" />
        </div>
        <div class="book-card-body">
          <div class="stats-badges">
            <KitSkeleton width="100px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="140px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
            <KitSkeleton width="160px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
          </div>
          <div class="cache-progress-section">
            <div class="progress-bar-wrap">
              <KitSkeleton width="100%" height="100%" color="var(--bg-tertiary-color)" />
            </div>
            <div class="progress-footer">
              <KitSkeleton width="180px" height="16px" color="var(--bg-tertiary-color)" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="cacheStore.stats">
      <div v-for="(book, id) in activeBookStats" :key="id" class="settings-card book-cache-card">
        <div class="book-card-header">
          <div class="title-section">
            <div class="icon-wrapper">
              <Icon icon="mdi:book-open-variant" />
            </div>
            <h3>{{ book.title }}</h3>
          </div>
          <div class="header-actions">
            <KitTooltip v-if="book.ttsSizeBytes > 0" :text="t('settings.clearTtsHint')" placement="top">
              <KitBtn icon="mdi:headphones-off" variant="outlined" class="delete-tts-btn" @click="cacheStore.clearBookTtsCache(Number(id))" />
            </KitTooltip>
            <KitTooltip :text="t('settings.clearAllHint')" placement="top-end">
              <KitBtn icon="mdi:delete-outline" variant="outlined" class="delete-btn" @click="cacheStore.clearBookCache(Number(id))" />
            </KitTooltip>
          </div>
        </div>

        <div class="book-card-body">
          <div class="stats-badges">
            <div class="badge">
              <Icon icon="mdi:database-outline" />
              <span>{{ formatBytes(book.sizeBytes) }}</span>
            </div>
            <div class="badge">
              <Icon icon="mdi:robot-outline" />
              <span>{{ t('settings.cacheAiAnalyses') }} <b>{{ book.analysesCount }}</b></span>
            </div>
            <div class="badge">
              <Icon icon="mdi:file-document-edit-outline" />
              <span>{{ t('settings.cachePages') }} <b>{{ book.cachedPages.length }} / {{ book.totalPages }}</b></span>
            </div>
            <div v-if="book.ttsSizeBytes > 0" class="badge">
              <Icon icon="mdi:waveform" />
              <span>{{ t('settings.ttsSizeBytes') }} <b>{{ formatBytes(book.ttsSizeBytes) }}</b></span>
            </div>
          </div>

          <div class="cache-progress-section">
            <div class="progress-bar-wrap">
              <div
                class="progress-fill"
                :style="{ width: `${book.totalPages > 0 ? (book.cachedPages.length / book.totalPages) * 100 : 0}%` }"
              />
            </div>
            <div class="progress-footer">
              <span class="progress-text" v-html="t('settings.offlineAvailable').replace('{percent}', `<b>${book.totalPages > 0 ? Math.round((book.cachedPages.length / book.totalPages) * 100) : 0}</b>`)" />
              <KitTooltip v-if="book.cachedPages.length > 0" :text="formatPagesList(book.cachedPages)" placement="top-end">
                <span class="pages-list-hint">{{ t('settings.pageNumbers') }}</span>
              </KitTooltip>
            </div>
          </div>
        </div>
      </div>

      <div v-if="Object.keys(activeBookStats).length === 0" class="empty-state">
        <Icon icon="mdi:folder-open-outline" class="empty-icon" />
        <p>{{ t('settings.noBooks') }}</p>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}
.books-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.book-cache-card {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  &:hover {
    border-color: var(--border-accent-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  }
  .book-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    .title-section {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-grow: 1;
      min-width: 0;
      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
        color: var(--fg-accent-color);
        border-radius: 12px;
        font-size: 1.6rem;
        flex-shrink: 0;
      }
      h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--fg-primary-color);
        font-weight: 600;
        line-height: 1.4;
        word-break: break-word;
      }
    }
    .header-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .delete-btn {
      color: var(--fg-error-color) !important;
      border-color: var(--border-error-color) !important;
      padding: 0.5rem;
      &:hover:not(:disabled) {
        background-color: var(--bg-error-color) !important;
        color: white !important;
      }
    }
    .delete-tts-btn {
      color: var(--fg-warning-color) !important;
      border-color: var(--border-warning-color) !important;
      padding: 0.5rem;
      &:hover:not(:disabled) {
        background-color: var(--bg-warning-color) !important;
        color: white !important;
      }
    }
  }
  .book-card-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .stats-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    .badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      svg {
        font-size: 1.2rem;
        color: var(--fg-primary-color);
      }
      b {
        color: var(--fg-primary-color);
        font-weight: 600;
      }
    }
  }
  .cache-progress-section {
    background: var(--bg-secondary-color);
    padding: 16px;
    border-radius: 12px;
    .progress-bar-wrap {
      width: 100%;
      height: 6px;
      background-color: var(--bg-tertiary-color);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;
      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }
    .progress-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      .progress-text {
        color: var(--fg-secondary-color);
        display: inline-flex;
        align-items: center;
        :deep(b) {
          color: var(--fg-primary-color);
          margin: 0 4px;
        }
      }
      .pages-list-hint {
        color: var(--fg-accent-color);
        cursor: help;
        font-weight: 500;
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-color: var(--fg-accent-color);
        text-underline-offset: 4px;
        padding-left: 12px;
      }
    }
  }
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--fg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: 16px;
  background-color: var(--bg-secondary-color);
  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
  }
  p {
    margin: 0;
    font-size: 1.1rem;
  }
}
</style>
