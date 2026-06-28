<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { useCacheStore } from '~/shared/store/cache.store'
import { formatBytes, formatPagesList } from '../../lib/formatters'

const { t } = useI18n()
const cacheStore = useCacheStore()

const pageSize = 5
const currentPage = ref(1)

interface BookCacheStat {
  id: string
  title: string
  totalPages: number
  cachedPages: number[]
  analysesCount: number
  sizeBytes: number
  imagesCount: number
  ttsCount: number
  dictPagesCount: number
}

const activeBookStats = computed(() => {
  if (!cacheStore.stats?.bookStats)
    return []

  const res: BookCacheStat[] = []
  for (const [id, book] of Object.entries(cacheStore.stats.bookStats)) {
    if (book.sizeBytes > 0 || book.cachedPages.length > 0 || book.analysesCount > 0 || book.imagesCount > 0 || book.ttsCount > 0 || book.dictPagesCount > 0) {
      res.push({ id, ...book })
    }
  }
  return res
})

const displayedBookStats = computed(() => {
  return activeBookStats.value.slice(0, currentPage.value * pageSize)
})

const hasMoreBooks = computed(() => {
  return displayedBookStats.value.length < activeBookStats.value.length
})

function loadMore() {
  currentPage.value++
}

const confirmVisible = ref(false)
const confirmBookId = ref<number | null>(null)

function confirmClearCache(bookId: string) {
  confirmBookId.value = Number(bookId)
  confirmVisible.value = true
}

function handleConfirmClear() {
  if (confirmBookId.value !== null) {
    cacheStore.clearBookCache(confirmBookId.value)
    confirmBookId.value = null
  }
}
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.savedBooksData') }}
  </h2>
  <div class="books-list">
    <TransitionGroup name="list" appear>
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
        <div v-for="book in displayedBookStats" :key="book.id" class="settings-card book-cache-card">
          <div class="book-card-header">
            <div class="title-section">
              <div class="icon-wrapper">
                <Icon icon="mdi:book-open-variant" />
              </div>
              <h3>{{ book.title }}</h3>
            </div>
            <KitBtn
              icon="mdi:delete-outline"
              variant="outlined"
              class="delete-btn"
              @click="confirmClearCache(book.id)"
            />
          </div>

          <div class="book-card-body">
            <div class="stats-badges">
              <div class="badge">
                <Icon icon="mdi:database-outline" />
                <span>{{ formatBytes(book.sizeBytes) }}</span>
              </div>
              <div v-if="book.analysesCount > 0" class="badge">
                <Icon icon="mdi:robot-outline" />
                <span>{{ t('settings.cacheAiAnalyses') }} <b>{{ book.analysesCount }}</b></span>
              </div>
              <div class="badge">
                <Icon icon="mdi:file-document-edit-outline" />
                <span>{{ t('settings.cachePages') }} <b>{{ book.cachedPages.length }} / {{ book.totalPages }}</b></span>
              </div>
              <KitTooltip v-if="book.imagesCount > 0" text="Кэшированные иллюстрации" placement="top">
                <div class="badge">
                  <Icon icon="mdi:image-outline" />
                  <span><b>{{ book.imagesCount }}</b></span>
                </div>
              </KitTooltip>
              <KitTooltip v-if="book.ttsCount > 0" text="Кэшированные аудио-фрагменты (озвучка)" placement="top">
                <div class="badge">
                  <Icon icon="mdi:volume-high" />
                  <span><b>{{ book.ttsCount }}</b></span>
                </div>
              </KitTooltip>
              <KitTooltip v-if="book.dictPagesCount > 0" text="Кэшированные словари для страниц" placement="top">
                <div class="badge">
                  <Icon icon="mdi:translate" />
                  <span><b>{{ book.dictPagesCount }}</b></span>
                </div>
              </KitTooltip>
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

        <div v-if="hasMoreBooks" class="load-more-container">
          <KitBtn class="load-more-btn" @click="loadMore">
            {{ t('settings.showMore', 'Показать еще') }}
          </KitBtn>
        </div>

        <div v-if="activeBookStats.length === 0" class="empty-state">
          <Icon icon="mdi:folder-open-outline" class="empty-icon" />
          <p>{{ t('settings.noBooks') }}</p>
        </div>
      </template>
    </TransitionGroup>

    <KitConfirm
      v-model:visible="confirmVisible"
      :description="t('settings.confirmClearCache', 'Вы уверены, что хотите удалить все сохраненные данные этой книги?')"
      @confirm="handleConfirmClear"
    />
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
  margin-bottom: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: all 0.3s ease;
  &:hover {
    border-color: var(--border-accent-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
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
    .delete-btn {
      color: var(--fg-error-color) !important;
      border-color: var(--border-error-color) !important;
      flex-shrink: 0;
      padding: 0.5rem;
      &:hover:not(:disabled) {
        background-color: var(--bg-error-color) !important;
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
.load-more-container {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;

  .load-more-btn {
    width: 100%;
    max-width: 300px;
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

.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-leave-active {
  position: absolute;
}
</style>
