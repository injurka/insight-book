<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { collapsePageRanges, formatBytes, formatPageRange } from '~/05.modules/settings/lib/formatters'
import { formatNumber } from '../lib/formatters'

const libraryStore = useLibraryStore()
const cacheStore = useCacheStore()
const { t } = useI18n()

const MAX_VISIBLE_RANGES = 8

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

const isPagesExpanded = ref(false)
const pageRanges = computed(() => collapsePageRanges(bookCacheStats.value?.cachedPages ?? []))
const hasHiddenRanges = computed(() => pageRanges.value.length > MAX_VISIBLE_RANGES)
const hiddenRangesCount = computed(() => Math.max(0, pageRanges.value.length - MAX_VISIBLE_RANGES))
const visibleRanges = computed(() =>
  isPagesExpanded.value
    ? pageRanges.value
    : pageRanges.value.slice(0, MAX_VISIBLE_RANGES))

watch(() => libraryStore.currentBookInfo?.id, () => {
  isPagesExpanded.value = false
})
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
          <div class="cp-pages" :class="{ 'is-expanded': isPagesExpanded }">
            <TransitionGroup name="cp-chip">
              <span
                v-for="range in visibleRanges"
                :key="`${range.start}:${range.end}`"
                class="cp-page-chip"
                :class="{ 'cp-page-chip--range': range.start !== range.end }"
                :title="range.start !== range.end ? `${range.start}–${range.end}` : undefined"
              >
                {{ formatPageRange(range) }}
              </span>
            </TransitionGroup>
            <button
              v-if="hasHiddenRanges"
              type="button"
              class="cp-page-chip cp-page-chip--toggle"
              :aria-expanded="isPagesExpanded"
              @click="isPagesExpanded = !isPagesExpanded"
            >
              <Icon :icon="isPagesExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="cp-page-chip-chevron" />
              {{ isPagesExpanded ? t('settings.collapse', 'Свернуть') : `+${hiddenRangesCount}` }}
            </button>
          </div>
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
  margin-left: 4px;
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
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);

  &--pages {
    align-items: center;
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

.cp-pages {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  transition: max-height 0.3s ease;

  &.is-expanded {
    max-height: 88px;
    overflow-y: auto;
    align-content: flex-start;
    padding-right: 4px;
  }

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 99px;
  }
}

.cp-page-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border: none;
  border-radius: 99px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  white-space: nowrap;
  transition:
    background-color 0.2s,
    color 0.2s,
    transform 0.2s;

  &:hover {
    background-color: var(--border-secondary-color);
    color: var(--fg-primary-color);
  }

  &--range {
    background-color: color-mix(in srgb, var(--fg-success-color) 12%, transparent);
    color: var(--fg-success-color);
    font-weight: 600;

    &:hover {
      background-color: color-mix(in srgb, var(--fg-success-color) 20%, transparent);
      color: var(--fg-success-color);
    }
  }

  &--toggle {
    cursor: pointer;
    background-color: transparent;
    border: 1px dashed var(--border-secondary-color);
    color: var(--fg-accent-color);
    font-weight: 600;

    &:hover {
      background-color: color-mix(in srgb, var(--fg-accent-color) 10%, transparent);
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.cp-page-chip-chevron {
  font-size: 0.85rem;
}

.cp-chip-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.cp-chip-enter-from {
  opacity: 0;
  transform: scale(0.8);
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
