<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { formatBytes, formatPagesList } from '~/components/05.modules/settings/lib/formatters'
import { useCacheStore } from '~/shared/store/cache.store'
import { formatNumber } from '../lib/formatters'

const libraryStore = useLibraryStore()
const cacheStore = useCacheStore()
const { t } = useI18n()

const bookCacheStats = computed(() => {
  if (!cacheStore.stats || !libraryStore.currentBookInfo)
    return null
  return (
    cacheStore.stats.bookStats[libraryStore.currentBookInfo.id] || {
      cachedPages: [],
      analysesCount: 0,
      sizeBytes: 0,
    }
  )
})

const totalPages = computed(() => libraryStore.currentBookInfo?.totalPages ?? 0)
const cachedCount = computed(() => bookCacheStats.value?.cachedPages?.length ?? 0)
const cachePercent = computed(() => {
  if (!totalPages.value)
    return 0
  return Math.min(100, Math.round((cachedCount.value / totalPages.value) * 100))
})
const isCacheFull = computed(() => cachedCount.value >= totalPages.value)

const aiCount = computed(() => libraryStore.currentBookInfo?.analysesCount ?? 0)
const hasAi = computed(() => aiCount.value > 0)
</script>

<template>
  <div class="cp-root">
    <div class="cp-card" :class="{ 'cp-card--success': isCacheFull }">
      <div class="cp-card-header">
        <div class="cp-card-icon-wrap" :class="{ 'is-success': isCacheFull }">
          <Icon
            :icon="isCacheFull ? 'mdi:cloud-check-variant' : 'mdi:cloud-download-outline'"
            class="cp-card-icon"
          />
        </div>
        <div class="cp-card-meta">
          <span class="cp-card-label">{{ t('bookStats.inCache') }}</span>
          <span class="cp-card-value">
            <b>{{ formatNumber(cachedCount) }}</b>
            <span class="cp-card-total"> / {{ formatNumber(totalPages) }} {{ t('bookInfo.pages') }}</span>
          </span>
        </div>
        <div class="cp-card-badge" :class="{ 'is-success': isCacheFull }">
          {{ cachePercent }}%
        </div>
      </div>

      <div class="cp-progress">
        <div
          class="cp-progress-fill"
          :class="{ 'is-success': isCacheFull }"
          :style="{ width: `${cachePercent}%` }"
        />
      </div>

      <div class="cp-card-details">
        <div class="cp-detail">
          <Icon icon="mdi:database-outline" class="cp-detail-icon" />
          <span class="cp-detail-label">{{ t('bookStats.cacheSize') }}</span>
          <b class="cp-detail-val">{{ formatBytes(bookCacheStats?.sizeBytes ?? 0) }}</b>
        </div>
        <div v-if="cachedCount > 0" class="cp-detail cp-detail--pages">
          <Icon icon="mdi:file-multiple-outline" class="cp-detail-icon" />
          <span class="cp-detail-label">{{ t('bookStats.cachedPagesList') }}</span>
          <span class="cp-detail-pages">{{ formatPagesList(bookCacheStats?.cachedPages ?? []) }}</span>
        </div>
        <div v-else class="cp-detail cp-detail--empty">
          <Icon icon="mdi:cloud-off-outline" class="cp-detail-icon" />
          <span>{{ t('bookStats.noDescription') }}</span>
        </div>
      </div>
    </div>

    <div class="cp-card" :class="{ 'cp-card--ai': hasAi }">
      <div class="cp-card-header">
        <div class="cp-card-icon-wrap" :class="{ 'is-ai': hasAi }">
          <Icon icon="mdi:robot-outline" class="cp-card-icon" />
        </div>
        <div class="cp-card-meta">
          <span class="cp-card-label">{{ t('bookStats.aiTranslations') }}</span>
          <span class="cp-card-value">
            <b>{{ formatNumber(aiCount) }}</b>
            <span class="cp-card-total"> {{ t('bookStats.phrases') }}</span>
          </span>
        </div>
        <div v-if="hasAi" class="cp-card-badge is-ai">
          <Icon icon="mdi:check-circle-outline" />
        </div>
      </div>

      <div v-if="!libraryStore.currentBookInfo?.stats?.totalSentences" class="cp-card-hint">
        <Icon icon="mdi:information-outline" />
        {{ t('bookStats.aiTranslationsHint') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cp-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
}

.cp-card {
  position: relative;
  border-radius: 12px;
  padding: 14px 16px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  overflow: hidden;
  transition: border-color 0.25s;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }

  &--success {
    border-color: color-mix(in srgb, var(--fg-success-color) 35%, transparent);

    &::before {
      background: radial-gradient(
        ellipse at top left,
        color-mix(in srgb, var(--fg-success-color) 8%, transparent) 0%,
        transparent 70%
      );
      opacity: 1;
    }
  }

  &--ai {
    border-color: color-mix(in srgb, var(--fg-accent-color) 35%, transparent);

    &::before {
      background: radial-gradient(
        ellipse at top left,
        color-mix(in srgb, var(--fg-accent-color) 8%, transparent) 0%,
        transparent 70%
      );
      opacity: 1;
    }
  }
}

.cp-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cp-card-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 1.25rem;
  transition:
    background-color 0.25s,
    color 0.25s;

  &.is-success {
    background-color: color-mix(in srgb, var(--fg-success-color) 15%, transparent);
    color: var(--fg-success-color);
  }

  &.is-ai {
    background-color: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
    color: var(--fg-accent-color);
  }
}

.cp-card-icon {
  display: block;
}

.cp-card-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-card-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted-color);
  line-height: 1;
}

.cp-card-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.2;

  b {
    font-size: 1.1rem;
  }
}

.cp-card-total {
  font-weight: 400;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin-left: 8px;
}

.cp-card-badge {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 99px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-variant-numeric: tabular-nums;

  &.is-success {
    background-color: color-mix(in srgb, var(--fg-success-color) 15%, transparent);
    color: var(--fg-success-color);
  }

  &.is-ai {
    background-color: color-mix(in srgb, var(--fg-accent-color) 15%, transparent);
    color: var(--fg-accent-color);
    padding: 6px;
    font-size: 1rem;
    display: flex;
    align-items: center;
  }
}

.cp-progress {
  height: 4px;
  border-radius: 99px;
  background-color: var(--bg-tertiary-color);
  overflow: hidden;
  margin-bottom: 12px;
  margin-top: 10px;
}

.cp-progress-fill {
  height: 100%;
  border-radius: 99px;
  background-color: var(--fg-secondary-color);
  transition:
    width 0.5s ease,
    background-color 0.25s;

  &.is-success {
    background: linear-gradient(
      90deg,
      var(--fg-success-color),
      color-mix(in srgb, var(--fg-success-color) 60%, var(--fg-accent-color))
    );
  }
}

.cp-card-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-detail {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);

  &--pages {
    align-items: flex-start;
  }

  &--empty {
    color: var(--fg-muted-color);
    font-style: italic;
  }
}

.cp-detail-icon {
  flex-shrink: 0;
  font-size: 0.9rem;
  margin-top: 1px;
  color: var(--fg-muted-color);
}

.cp-detail-label {
  flex-shrink: 0;
}

.cp-detail-val {
  color: var(--fg-primary-color);
  font-weight: 600;
  font-size: 0.85rem;
}

.cp-detail-pages {
  color: var(--fg-primary-color);
  font-size: 0.82rem;
  word-break: break-all;
  max-height: 60px;
  overflow-y: auto;
  line-height: 1.4;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 99px;
  }
}

.cp-card-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--fg-muted-color);
  line-height: 1.4;
  margin-top: 4px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 0.95rem;
  }
}
</style>
