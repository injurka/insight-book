<script setup lang="ts">
import type { BookCacheStat } from '../../model'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import BookCacheItem from './storage/book-cache-item.vue'

const { t } = useI18n()
const cacheStore = useCacheStore()

const searchQuery = ref('')
const pageSize = 5
const currentPage = ref(1)

const activeBookStats = computed(() => {
  if (!cacheStore.stats?.bookStats)
    return []

  const res: BookCacheStat[] = []
  for (const [id, book] of Object.entries(cacheStore.stats.bookStats)) {
    if (book.sizeBytes > 0 || book.cachedPages.length > 0 || book.analysesCount > 0 || book.imagesCount > 0 || book.ttsCount > 0 || book.dictPagesCount > 0)
      res.push({ id, ...book })
  }

  return res.sort((a, b) => b.sizeBytes - a.sizeBytes)
})

const filteredBookStats = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return activeBookStats.value

  return activeBookStats.value.filter(book =>
    book.title.toLowerCase().includes(query))
})

const displayedBookStats = computed(() => {
  return filteredBookStats.value.slice(0, currentPage.value * pageSize)
})

const hasMoreBooks = computed(() => {
  return displayedBookStats.value.length < filteredBookStats.value.length
})

const remainingBooksCount = computed(() => {
  return filteredBookStats.value.length - displayedBookStats.value.length
})

function loadMore() {
  currentPage.value++
}

const confirmVisible = ref(false)
const confirmBookId = ref<number | null>(null)
const deletingBookId = ref<number | null>(null)

function confirmClearCache(bookId: string) {
  confirmBookId.value = Number(bookId)
  confirmVisible.value = true
}

async function handleConfirmClear() {
  if (confirmBookId.value !== null) {
    const id = confirmBookId.value
    deletingBookId.value = id
    confirmBookId.value = null
    try {
      await cacheStore.clearBookCache(id)
    }
    finally {
      deletingBookId.value = null
    }
  }
}
</script>

<template>
  <div class="settings-books-cache-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="panel-title">
          {{ t('settings.savedBooksData') }}
        </h3>
        <span v-if="activeBookStats.length > 0" class="count-badge">
          {{ activeBookStats.length }}
        </span>
      </div>

      <div v-if="activeBookStats.length > 2" class="header-search">
        <KitInput
          v-model="searchQuery"
          :placeholder="t('settings.searchBooksPlaceholder', 'Поиск по книгам...')"
          icon="mdi:magnify"
          size="sm"
          :clearable="true"
        />
      </div>
    </div>

    <div class="books-list">
      <template v-if="cacheStore.isLoading && !cacheStore.stats">
        <div v-for="i in 2" :key="`mock-${i}`" class="book-skeleton-item">
          <div class="skeleton-icon">
            <KitSkeleton
              width="40px"
              height="40px"
              border-radius="10px"
              color="var(--bg-tertiary-color)"
            />
          </div>
          <div class="skeleton-content">
            <KitSkeleton
              width="220px"
              height="20px"
              border-radius="4px"
              color="var(--bg-tertiary-color)"
            />
            <div class="skeleton-badges">
              <KitSkeleton
                width="80px"
                height="24px"
                border-radius="6px"
                color="var(--bg-tertiary-color)"
              />
              <KitSkeleton
                width="120px"
                height="24px"
                border-radius="6px"
                color="var(--bg-tertiary-color)"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="cacheStore.stats">
        <TransitionGroup name="list" appear>
          <BookCacheItem
            v-for="book in displayedBookStats"
            :key="book.id"
            :book="book"
            :is-deleting="deletingBookId === Number(book.id)"
            @delete="confirmClearCache"
          />
        </TransitionGroup>

        <div v-if="hasMoreBooks" class="load-more-container">
          <KitBtn
            variant="tonal"
            color="primary"
            class="load-more-btn"
            @click="loadMore"
          >
            {{ t('settings.showMore', 'Показать еще') }} ({{ remainingBooksCount }})
          </KitBtn>
        </div>

        <div v-if="activeBookStats.length === 0" class="empty-state">
          <Icon icon="mdi:folder-open-outline" class="empty-icon" />
          <p>{{ t('settings.noBooks') }}</p>
        </div>

        <div v-else-if="filteredBookStats.length === 0" class="empty-state">
          <Icon icon="mdi:book-search-outline" class="empty-icon" />
          <p>{{ t('settings.noBooksFound', 'Ничего не найдено') }}</p>
        </div>
      </template>
    </div>

    <KitPrompt
      v-model:visible="confirmVisible"
      :description="t('settings.confirmClearCache', 'Вы уверены, что хотите удалить все сохраненные данные этой книги?')"
      :hide-input="true"
      @submit="handleConfirmClear"
    />
  </div>
</template>

<style lang="scss" scoped>
.settings-books-cache-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  @include media-down(xs) {
    flex-direction: column;
    align-items: stretch;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .panel-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
    }
  }

  .header-search {
    width: 240px;

    @include media-down(xs) {
      width: 100%;
    }
  }
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.book-skeleton-item {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;

  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;

    .skeleton-badges {
      display: flex;
      gap: 8px;
    }
  }
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 8px;

  .load-more-btn {
    width: 100%;
    max-width: 240px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--fg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: 14px;
  background-color: var(--bg-secondary-color);

  .empty-icon {
    font-size: 2.8rem;
    opacity: 0.4;
  }

  p {
    margin: 0;
    font-size: 1rem;
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
