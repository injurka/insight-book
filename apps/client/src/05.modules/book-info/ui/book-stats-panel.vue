<script setup lang="ts">
import type { TagKey } from '~/01.shared/constants/tags'
import { Icon } from '@iconify/vue'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BOOK_TAGS } from '~/01.shared/constants/tags'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDropdown } from '~/02.kit/molecules/kit-dropdown/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { BookEntity } from '~/03.domain/entities/book.entity.ts'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useBookStatsEdit } from '../composables/use-book-stats-edit'
import { formatNumber } from '../lib/formatters'
import BookStatsEditor from './book-stats-editor.vue'
import BookTranslationPanel from './book-translation-panel.vue'
import CachePopover from './cache-popover.vue'

const isEditingStats = defineModel<boolean>('isEditing', { default: false })

const libraryStore = useLibraryStore()
const cacheStore = useCacheStore()
const authStore = useAuthStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()
const networkStore = useNetworkStore()
const { currentDescription, difficultyLevelClass } = useBookStatsEdit(isEditingStats)

const canEdit = computed(() => !!authStore.user && libraryStore.currentBookInfo?.userId === authStore.user.id)
const bookCacheStats = computed(() => {
  if (!cacheStore.stats || !libraryStore.currentBookInfo)
    return null

  return cacheStore.stats.bookStats[libraryStore.currentBookInfo.id] || { cachedPages: [], analysesCount: 0, sizeBytes: 0 }
})
const bookDescription = computed(() => {
  return currentDescription.value
})
const progressPercent = computed(() => {
  if (!libraryStore.currentBookInfo)
    return 0

  const entity = new BookEntity(libraryStore.currentBookInfo)

  return entity.getProgressPercent()
})
const localizedTags = computed(() => {
  const tags = libraryStore.currentBookInfo?.stats?.tags || []

  return tags.map((tag: string) => {
    return BOOK_TAGS[tag as TagKey]?.[settingsStore.appLanguage as keyof (typeof BOOK_TAGS)[TagKey]] || tag
  })
})

watch(() => libraryStore.syncState, (val) => {
  if (val === 'finished') {
    cacheStore.loadStats()

    // После успешной синхронизации (которая могла перевести фразы) обновляем текущую инфу о книге
    if (libraryStore.currentBookInfo)
      libraryStore.fetchBookInfo(libraryStore.currentBookInfo.id)
  }
})

onMounted(() => {
  cacheStore.loadStats()
})
</script>

<template>
  <div v-if="libraryStore.currentBookInfo" class="book-details">
    <h1 class="book-title">
      {{ libraryStore.currentBookInfo.title }}
    </h1>
    <p class="book-author">
      {{ libraryStore.currentBookInfo.author || t('bookStats.authorNotSpecified') }}
    </p>

    <div class="progress-section">
      <div class="progress-header">
        <div class="progress-text">
          {{ t('bookStats.progressPage') }} {{ libraryStore.currentBookInfo.currentPage || 1 }} {{ t('bookStats.outOf') }} {{ formatNumber(libraryStore.currentBookInfo.totalPages) }}
        </div>
        <KitDropdown placement="bottom-end" width="300px">
          <template #activator="{ props: slotProps }">
            <KitTooltip :text="t('bookStats.inCache')" placement="top">
              <button
                type="button"
                :aria-label="t('bookStats.inCache')"
                class="cache-trigger-btn"
                :class="{ 'is-active': slotProps.isOpen, 'is-loaded': bookCacheStats !== null }"
              >
                <Icon icon="mdi:cloud-outline" />
              </button>
            </KitTooltip>
          </template>

          <CachePopover />
        </KitDropdown>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>

    <section class="book-overview">
      <div class="box-header">
        <h2>{{ t('bookStats.info') }}</h2>
        <div class="overview-actions">
          <BookTranslationPanel />
          <KitTooltip v-if="canEdit" :text="t('bookInfo.edit')" placement="top">
            <KitBtn
              class="edit-info-btn"
              variant="text"
              size="sm"
              icon="mdi:pencil-outline"
              :aria-label="t('bookInfo.edit')"
              :disabled="networkStore.effectiveOffline"
              @click="isEditingStats = true"
            />
          </KitTooltip>
        </div>
      </div>

      <template v-if="libraryStore.currentBookInfo.stats">
        <div v-if="localizedTags.length" class="tags-list">
          <span v-for="tag in localizedTags" :key="tag" class="tag-badge">{{ tag }}</span>
        </div>
        <div class="book-description">
          <p>{{ bookDescription }}</p>
        </div>
        <div class="stats-grid" :class="{ 'single-col': libraryStore.currentBookInfo.type === 'manga' }">
          <div class="stat-item">
            <span class="stat-label">{{ t('bookStats.difficulty') }}</span>
            <span class="stat-value difficulty-badge" :class="difficultyLevelClass">
              {{ libraryStore.currentBookInfo.stats.difficulty || '?' }}
            </span>
          </div>
          <template v-if="libraryStore.currentBookInfo.type !== 'manga'">
            <div class="stat-item">
              <span class="stat-label">{{ t('bookStats.totalChars') }}</span>
              <span class="stat-value">{{ formatNumber(libraryStore.currentBookInfo.stats.totalChars) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('bookStats.uniqueChars') }}</span>
              <span class="stat-value text-accent">{{ formatNumber(libraryStore.currentBookInfo.stats.uniqueChars) }}</span>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div class="empty-stats">
          <p>{{ t('bookStats.noBookInfo') }}</p>
          <KitBtn
            v-if="canEdit"
            variant="outlined"
            color="primary"
            :disabled="networkStore.effectiveOffline"
            @click="isEditingStats = true"
          >
            {{ t('bookStats.add') }}
          </KitBtn>
        </div>
      </template>
      <p v-if="libraryStore.isAnalyzingBook" class="analysis-status" role="status">
        <Icon icon="mdi:robot-outline" /> {{ t('bookStats.aiAnalyzing') }}
      </p>
    </section>
    <BookStatsEditor v-if="canEdit" v-model:visible="isEditingStats" />
  </div>
</template>

<style lang="scss" scoped>
.book-details {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.book-overview {
  flex: 1;
}

.book-title {
  font-size: 2.2rem;
  line-height: 1.2;
  margin: 0 0 8px 0;
  color: var(--fg-primary-color);
}
.book-author {
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
  margin: 0 0 24px 0;
}
.progress-section {
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .progress-text {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .cache-trigger-btn {
    background: transparent;
    border: none;
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &.is-loaded {
      color: var(--fg-accent-color);
    }

    &:hover,
    &.is-active {
      color: var(--fg-primary-color);
      background-color: var(--bg-tertiary-color);
    }
  }
  .progress-bar {
    height: 6px;
    background-color: var(--bg-tertiary-color);
    border-radius: 3px;
    overflow: hidden;
    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition: width 0.3s ease;
    }
  }
}

.book-overview {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 24px;
  .box-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .overview-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .edit-info-btn {
    color: var(--fg-secondary-color);

    &:hover {
      color: var(--fg-primary-color);
    }

    @media (pointer: coarse) {
      width: 44px;
      height: 44px;
    }
  }
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }
  .tag-badge {
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
  .book-description p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.75;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    padding-top: 20px;
    margin-top: 20px;
    border-top: 1px solid var(--border-secondary-color);
  }
  .stats-grid.single-col {
    grid-template-columns: 1fr;
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }
  .stat-label {
    color: var(--fg-secondary-color);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .difficulty-badge {
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-tertiary-color);
    font-size: 1rem;
  }
  .level-easy {
    background: var(--bg-success-color);
    color: var(--fg-success-color);
  }
  .level-medium {
    background: var(--bg-warning-color);
    color: var(--fg-warning-color);
  }
  .level-hard {
    background: var(--bg-error-color);
    color: var(--fg-error-color);
  }
  .empty-stats {
    color: var(--fg-secondary-color);
    line-height: 1.6;
  }
  .analysis-status {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--fg-secondary-color);
    line-height: 1.5;
  }
  @include media-down(sm) {
    padding: 16px;
    .stats-grid {
      gap: 10px;
    }
    .stat-value {
      font-size: 1.1rem;
    }
  }
}
</style>
