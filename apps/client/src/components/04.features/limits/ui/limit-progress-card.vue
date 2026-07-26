<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const props = defineProps<{
  icon: string
  iconClass?: string
  title: string
  description: string
  used?: number | null
  limit?: number | null
}>()

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

const percentage = computed(() => {
  const usedVal = props.used ?? 0
  const limitVal = props.limit
  if (limitVal === null || limitVal === undefined)
    return 0
  if (limitVal === 0)
    return 100
  return Math.min(100, Math.round((usedVal / limitVal) * 100))
})

const percentClass = computed(() => {
  if (percentage.value < 70)
    return 'is-success'
  if (percentage.value <= 90)
    return 'is-warning'
  return 'is-error'
})

function formatNumber(num: number | undefined | null) {
  if (num == null)
    return '0'
  return new Intl.NumberFormat(settingsStore.appLanguage || 'ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}
</script>

<template>
  <div class="limit-card">
    <div class="card-header">
      <div class="icon-container" :class="props.iconClass">
        <Icon :icon="props.icon" />
      </div>
      <div class="title-container">
        <h3 class="limit-name">
          {{ props.title }}
        </h3>
        <p class="limit-desc">
          {{ props.description }}
        </p>
      </div>
    </div>

    <div class="card-body">
      <div v-if="props.limit !== null && props.limit !== undefined" class="progress-container">
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: `${percentage}%` }" :class="percentClass" />
        </div>
      </div>

      <div class="usage-details">
        <span class="detail-label">{{ t('limits.used') }}:</span>
        <span class="detail-value">
          {{ formatNumber(props.used) }} / {{ props.limit !== null && props.limit !== undefined ? formatNumber(props.limit) : t('limits.infinite') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.limit-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  @include media-down(xs) {
    padding: 16px;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: var(--border-accent-color);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;

    .icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 10px;
      font-size: 1.5rem;
      flex-shrink: 0;

      &.ai-icon {
        background-color: rgba(var(--fg-accent-color-rgb), 0.1);
        color: var(--fg-accent-color);
      }

      &.book-icon {
        background-color: rgba(var(--fg-success-color-rgb), 0.1);
        color: var(--fg-success-color);
      }
    }

    .title-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;

      .limit-name {
        margin: 0;
        font-size: 1.1rem;
        color: var(--fg-primary-color);
        font-weight: 600;
      }

      .limit-desc {
        margin: 0;
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
        line-height: 1.3;
      }
    }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .progress-container {
      width: 100%;
    }

    .progress-track {
      height: 8px;
      background-color: var(--border-secondary-color);
      border-radius: 4px;
      overflow: hidden;
      width: 100%;
    }

    .progress-bar {
      height: 100%;
      border-radius: 4px;
      transition:
        width 0.3s ease,
        background-color 0.3s ease;

      &.is-success {
        background-color: var(--fg-success-color);
      }
      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-error {
        background-color: var(--fg-error-color);
      }
    }

    .usage-details {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;

      .detail-label {
        color: var(--fg-secondary-color);
      }

      .detail-value {
        font-weight: 600;
        color: var(--fg-primary-color);
      }
    }
  }
}
</style>
