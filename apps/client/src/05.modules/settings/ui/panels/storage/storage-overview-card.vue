<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { formatBytes, formatNumber } from '../../../lib/formatters'

const { t } = useI18n()
const cacheStore = useCacheStore()

const storagePercent = computed(() => {
  if (!cacheStore.deviceStorage || cacheStore.deviceStorage.quota === 0)
    return 0

  return Math.min(100, (cacheStore.deviceStorage.usage / cacheStore.deviceStorage.quota) * 100)
})

const storagePercentFormatted = computed(() => {
  if (storagePercent.value === 0)
    return '0%'
  if (storagePercent.value < 0.1)
    return '< 0.1%'

  return `${storagePercent.value.toFixed(1)}%`
})

const cachedBooksCount = computed(() => {
  if (!cacheStore.stats?.bookStats)
    return 0

  return Object.values(cacheStore.stats.bookStats).filter(book =>
    book.sizeBytes > 0
    || book.cachedPages.length > 0
    || book.analysesCount > 0
    || book.imagesCount > 0
    || book.ttsCount > 0
    || book.dictPagesCount > 0).length
})

function handleRefresh() {
  cacheStore.loadStats()
}
</script>

<template>
  <div class="storage-overview-card">
    <div class="overview-header">
      <div class="title-with-badge">
        <div class="header-icon-wrap">
          <Icon icon="mdi:database-outline" class="header-icon" />
        </div>
        <div class="title-text-group">
          <h3>{{ t('settings.browserStorage') }}</h3>
          <p class="subtitle">
            {{ t('settings.quotaDesc', { size: formatBytes(cacheStore.stats?.totalSizeBytes || 0) }) }}
          </p>
        </div>
      </div>

      <div class="header-actions">
        <KitTooltip v-if="cacheStore.isPersisted" :text="t('settings.protectedHint')" placement="top">
          <div class="status-badge is-safe">
            <Icon icon="mdi:shield-check" />
            <span>{{ t('settings.protected') }}</span>
          </div>
        </KitTooltip>
        <KitTooltip v-else :text="t('settings.notProtectedHint')" placement="top">
          <div class="status-badge is-warn">
            <Icon icon="mdi:shield-alert-outline" />
            <span>{{ t('settings.notProtected') }}</span>
          </div>
        </KitTooltip>

        <KitTooltip :text="t('settings.refreshStorage', 'Обновить данные')" placement="top">
          <KitBtn
            icon="mdi:refresh"
            variant="tonal"
            color="secondary"
            size="sm"
            :class="{ 'spin-animation': cacheStore.isLoading }"
            :disabled="cacheStore.isLoading"
            @click="handleRefresh"
          />
        </KitTooltip>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-icon-wrap is-accent">
          <Icon icon="mdi:database" />
        </div>
        <div class="metric-data">
          <span class="metric-label">{{ t('settings.appDatabase', 'База данных') }}</span>
          <KitSkeleton
            v-if="cacheStore.isLoading && !cacheStore.stats"
            width="80px"
            height="24px"
            color="var(--bg-tertiary-color)"
          />
          <span v-else class="metric-value text-accent">
            {{ formatBytes(cacheStore.stats?.totalSizeBytes || 0) }}
          </span>
        </div>
      </div>

      <div class="metric-item">
        <div class="metric-icon-wrap is-primary">
          <Icon icon="mdi:book-alphabet" />
        </div>
        <div class="metric-data">
          <span class="metric-label">{{ t('settings.dictWords') }}</span>
          <KitSkeleton
            v-if="cacheStore.isLoading && !cacheStore.stats"
            width="60px"
            height="24px"
            color="var(--bg-tertiary-color)"
          />
          <span v-else class="metric-value">
            {{ formatNumber(cacheStore.stats?.totalDictionaryWords || 0) }}
          </span>
        </div>
      </div>

      <div class="metric-item">
        <div class="metric-icon-wrap is-info">
          <Icon icon="mdi:book-open-variant" />
        </div>
        <div class="metric-data">
          <span class="metric-label">{{ t('settings.cachedBooks', 'Книг в кэше') }}</span>
          <KitSkeleton
            v-if="cacheStore.isLoading && !cacheStore.stats"
            width="40px"
            height="24px"
            color="var(--bg-tertiary-color)"
          />
          <span v-else class="metric-value">
            {{ cachedBooksCount }}
          </span>
        </div>
      </div>

      <div class="metric-item">
        <div class="metric-icon-wrap is-muted">
          <Icon icon="mdi:harddisk" />
        </div>
        <div class="metric-data">
          <span class="metric-label">{{ t('settings.browserQuota', 'Квота браузера') }}</span>
          <KitSkeleton
            v-if="cacheStore.isLoading && !cacheStore.deviceStorage"
            width="100px"
            height="24px"
            color="var(--bg-tertiary-color)"
          />
          <span v-else class="metric-value is-subtle">
            {{ formatBytes(cacheStore.deviceStorage?.usage || 0) }} / {{ formatBytes(cacheStore.deviceStorage?.quota || 0) }}
          </span>
        </div>
      </div>
    </div>

    <div class="quota-bar-section">
      <div class="bar-header">
        <span class="bar-title">{{ t('settings.browserStorage') }}</span>
        <span class="bar-ratio">
          <KitSkeleton
            v-if="cacheStore.isLoading && !cacheStore.deviceStorage"
            width="70px"
            height="18px"
            color="var(--bg-tertiary-color)"
          />
          <template v-else>
            {{ storagePercentFormatted }} ({{ formatBytes(cacheStore.deviceStorage?.usage || 0) }})
          </template>
        </span>
      </div>

      <div class="progress-track">
        <KitSkeleton
          v-if="cacheStore.isLoading && !cacheStore.deviceStorage"
          width="100%"
          height="100%"
          color="var(--bg-tertiary-color)"
        />
        <div
          v-else
          class="progress-bar-fill"
          :class="{ 'is-danger': storagePercent > 90, 'is-warning': storagePercent > 70 }"
          :style="{ width: `${Math.max(storagePercent, 0.5)}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.storage-overview-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;

  .header-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
    color: var(--fg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .title-text-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      line-height: 1.3;
    }

    .subtitle {
      margin: 0;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;

  @include media-down(sm) {
    justify-content: space-between;
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: default;
  transition: all 0.2s ease;

  svg {
    font-size: 1rem;
  }

  &.is-safe {
    background: rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.15);
    color: var(--fg-success-color);
    border: 1px solid rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.3);
  }

  &.is-warn {
    background: rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.15);
    color: var(--fg-warning-color);
    border: 1px solid rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.3);
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  @include media-down(md) {
    grid-template-columns: repeat(2, 1fr);
  }

  @include media-down(xs) {
    grid-template-columns: 1fr;
  }
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-accent-color);
  }

  .metric-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;

    &.is-accent {
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
      color: var(--fg-accent-color);
    }

    &.is-primary {
      background: rgba(var(--bg-primary-color-rgb, 99, 102, 241), 0.12);
      color: var(--fg-primary-color);
    }

    &.is-info {
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
    }

    &.is-muted {
      background: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
    }
  }

  .metric-data {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .metric-label {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .metric-value {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.text-accent {
        color: var(--fg-accent-color);
      }

      &.is-subtle {
        font-size: 0.95rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}

.quota-bar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;

    .bar-title {
      color: var(--fg-secondary-color);
      font-weight: 500;
    }

    .bar-ratio {
      color: var(--fg-primary-color);
      font-weight: 600;
    }
  }

  .progress-track {
    width: 100%;
    height: 8px;
    background-color: var(--bg-primary-color);
    border-radius: 99px;
    overflow: hidden;

    .progress-bar-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      border-radius: 99px;
      transition:
        width 0.4s ease,
        background-color 0.3s;

      &.is-warning {
        background-color: var(--fg-warning-color);
      }

      &.is-danger {
        background-color: var(--fg-error-color);
      }
    }
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
