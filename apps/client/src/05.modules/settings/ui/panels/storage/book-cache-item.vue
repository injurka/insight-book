<script setup lang="ts">
import type { BookCacheStat } from '../../../model'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { formatBytes, formatNumber, formatPagesList } from '../../../lib/formatters'

interface Props {
  book: BookCacheStat
  isDeleting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDeleting: false,
})

const emit = defineEmits<{
  (e: 'delete', bookId: string): void
}>()

const { t } = useI18n()

const offlinePercent = computed(() => {
  if (props.book.totalPages <= 0)
    return 0

  return Math.min(100, Math.round((props.book.cachedPages.length / props.book.totalPages) * 100))
})

const hasCachedPages = computed(() => props.book.cachedPages.length > 0)

function handleDelete() {
  emit('delete', props.book.id)
}
</script>

<template>
  <div class="book-cache-item">
    <div class="item-main-row">
      <div class="book-icon-wrapper">
        <Icon icon="mdi:book-open-page-variant-outline" class="book-icon" />
      </div>

      <div class="book-info">
        <div class="book-title-row">
          <h4 class="book-title" :title="book.title">
            {{ book.title }}
          </h4>
        </div>

        <div class="badges-row">
          <div class="stat-badge is-primary">
            <Icon icon="mdi:database-outline" />
            <span>{{ formatBytes(book.sizeBytes) }}</span>
          </div>

          <div v-if="book.analysesCount > 0" class="stat-badge is-ai">
            <Icon icon="mdi:robot-outline" />
            <span>{{ t('settings.cacheAiAnalyses') }} <b>{{ formatNumber(book.analysesCount) }}</b></span>
          </div>

          <div v-if="hasCachedPages" class="stat-badge is-pages">
            <Icon icon="mdi:file-document-outline" />
            <span>{{ t('settings.cachePages') }} <b>{{ book.cachedPages.length }} / {{ book.totalPages }}</b></span>
          </div>
          <div v-else class="stat-badge is-subtle">
            <Icon icon="mdi:file-document-outline" />
            <span>{{ t('settings.noOfflinePages', 'Без оффлайн-страниц') }} (0/{{ book.totalPages }})</span>
          </div>

          <KitTooltip v-if="book.imagesCount > 0" text="Кэшированные иллюстрации" placement="top">
            <div class="stat-badge is-media">
              <Icon icon="mdi:image-outline" />
              <span><b>{{ book.imagesCount }}</b></span>
            </div>
          </KitTooltip>

          <KitTooltip v-if="book.ttsCount > 0" text="Кэшированные аудио-фрагменты (озвучка)" placement="top">
            <div class="stat-badge is-media">
              <Icon icon="mdi:volume-high" />
              <span><b>{{ book.ttsCount }}</b></span>
            </div>
          </KitTooltip>

          <KitTooltip v-if="book.dictPagesCount > 0" text="Кэшированные словари для страниц" placement="top">
            <div class="stat-badge is-media">
              <Icon icon="mdi:translate" />
              <span><b>{{ book.dictPagesCount }}</b></span>
            </div>
          </KitTooltip>
        </div>
      </div>

      <div class="book-actions">
        <KitTooltip :text="t('settings.clearBookCacheTooltip', 'Очистить кэш книги')" placement="top">
          <KitBtn
            icon="mdi:delete-outline"
            variant="tonal"
            color="error"
            size="sm"
            class="delete-btn"
            :disabled="isDeleting"
            @click="handleDelete"
          />
        </KitTooltip>
      </div>
    </div>

    <!-- Smart Offline Progress section: only shown if there are actually cached pages -->
    <div v-if="hasCachedPages" class="offline-progress-wrap">
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :style="{ width: `${offlinePercent}%` }"
        />
      </div>

      <div class="progress-info-row">
        <span class="progress-text">
          {{ t('settings.offlineAvailable', { percent: offlinePercent }) }}
        </span>

        <KitTooltip :text="formatPagesList(book.cachedPages)" placement="top-end">
          <button class="pages-hint-btn" type="button">
            <Icon icon="mdi:information-outline" />
            <span>{{ t('settings.pageNumbers') }}</span>
          </button>
        </KitTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.book-cache-item {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-accent-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
}

.item-main-row {
  display: flex;
  align-items: center;
  gap: 14px;

  @include media-down(xs) {
    align-items: flex-start;
  }
}

.book-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
  color: var(--fg-accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.book-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .book-title-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .book-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      @include media-down(xs) {
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
    }
  }
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    white-space: nowrap;

    svg {
      font-size: 0.95rem;
    }

    b {
      color: var(--fg-primary-color);
      font-weight: 600;
    }

    &.is-primary {
      color: var(--fg-primary-color);
      font-weight: 500;
    }

    &.is-ai {
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.08);
      border-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.2);
      color: var(--fg-accent-color);
    }

    &.is-pages {
      background: rgba(56, 189, 248, 0.08);
      border-color: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
    }

    &.is-subtle {
      opacity: 0.75;
      font-size: 0.75rem;
    }

    &.is-media {
      padding: 3px 7px;
    }
  }
}

.book-actions {
  flex-shrink: 0;

  .delete-btn {
    opacity: 0.7;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      opacity: 1;
    }
  }
}

.offline-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: var(--bg-secondary-color);
  border-radius: 10px;
  margin-top: 2px;

  .progress-bar-track {
    width: 100%;
    height: 5px;
    background-color: var(--bg-tertiary-color);
    border-radius: 99px;
    overflow: hidden;

    .progress-bar-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      border-radius: 99px;
      transition: width 0.3s ease;
    }
  }

  .progress-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;

    .progress-text {
      color: var(--fg-secondary-color);
    }

    .pages-hint-btn {
      background: transparent;
      border: none;
      color: var(--fg-accent-color);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;

      &:hover {
        background-color: var(--bg-tertiary-color);
        color: var(--fg-primary-color);
      }
    }
  }
}
</style>
