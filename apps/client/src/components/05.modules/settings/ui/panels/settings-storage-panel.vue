<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitSkeleton, KitTooltip } from '~/components/01.kit'
import { useCacheStore } from '~/shared/store/cache.store'
import { formatBytes } from '../../lib/formatters'

const { t } = useI18n()
const cacheStore = useCacheStore()

const storagePercent = computed(() => {
  if (!cacheStore.deviceStorage || cacheStore.deviceStorage.quota === 0)
    return 0
  return Math.min(100, Math.round((cacheStore.deviceStorage.usage / cacheStore.deviceStorage.quota) * 100))
})
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.storageTitle') }}
  </h2>

  <div class="settings-card quota-card">
    <div class="quota-header">
      <div class="quota-title">
        <h3>{{ t('settings.browserStorage') }}</h3>
        <KitTooltip v-if="cacheStore.isPersisted" :text="t('settings.protectedHint')" placement="top">
          <div class="badge-safe">
            <Icon icon="mdi:shield-check" /> {{ t('settings.protected') }}
          </div>
        </KitTooltip>
        <KitTooltip v-else :text="t('settings.notProtectedHint')" placement="top">
          <div class="badge-warn">
            <Icon icon="mdi:shield-alert-outline" /> {{ t('settings.notProtected') }}
          </div>
        </KitTooltip>
      </div>
      <span class="quota-text">
        <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.deviceStorage" width="120px" height="20px" color="var(--bg-tertiary-color)" />
        <template v-else>
          <b>{{ formatBytes(cacheStore.deviceStorage?.usage || 0) }}</b> / {{ formatBytes(cacheStore.deviceStorage?.quota || 0) }}
        </template>
      </span>
    </div>

    <div class="progress-bar-wrap">
      <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.deviceStorage" width="100%" height="100%" color="var(--bg-tertiary-color)" />
      <div
        v-else
        class="progress-fill"
        :class="{ 'is-danger': storagePercent > 90, 'is-warning': storagePercent > 70 }"
        :style="{ width: `${storagePercent}%` }"
      />
    </div>
    <p class="quota-desc">
      {{ t('settings.quotaDesc').replace('{size}', formatBytes(cacheStore.stats?.totalSizeBytes || 0)) }}
    </p>
  </div>

  <div class="settings-card total-card">
    <div class="stat-item">
      <span class="label">{{ t('settings.dbUsage') }}</span>
      <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.stats" width="120px" height="32px" color="var(--bg-tertiary-color)" />
      <span v-else class="value text-accent">{{ formatBytes(cacheStore.stats?.totalSizeBytes || 0) }}</span>
    </div>
    <div class="stat-item">
      <span class="label">{{ t('settings.dictWords') }}</span>
      <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.stats" width="80px" height="32px" color="var(--bg-tertiary-color)" />
      <span v-else class="value">{{ cacheStore.stats?.totalDictionaryWords || 0 }}</span>
    </div>
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
.quota-card {
  .quota-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    @include media-down(sm) {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .quota-title {
      display: flex;
      align-items: center;
      gap: 12px;
      h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--fg-primary-color);
      }
      .badge-safe,
      .badge-warn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-safe {
        background: rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.2);
        color: var(--fg-success-color);
      }
      .badge-warn {
        background: rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.2);
        color: var(--fg-warning-color);
      }
    }
    .quota-text {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      display: inline-flex;
      align-items: center;
      b {
        color: var(--fg-primary-color);
      }
    }
  }
  .progress-bar-wrap {
    width: 100%;
    height: 12px;
    background-color: var(--bg-primary-color);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 12px;
    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition:
        width 0.5s ease-in-out,
        background-color 0.3s;
      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-danger {
        background-color: var(--fg-error-color);
      }
    }
  }
  .quota-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}
.total-card {
  display: flex;
  gap: 48px;
  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .label {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 2rem;
      font-weight: 600;
      display: inline-flex;
      &.text-accent {
        color: var(--fg-accent-color);
      }
    }
  }
}
</style>
