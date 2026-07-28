<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitSkeleton } from '~/components/01.kit'
import { KitViewSwitcher } from '~/components/01.kit/kit-view-switcher'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useTokenStats } from '../../composables/use-token-stats'
import { formatCurrency, formatNumber } from '../../lib/formatters'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const {
  isTokensLoading,
  totalTokens,
  totalCost,
  tokensByAction,
  selectedPeriod,
} = useTokenStats()

const periodOptions = [
  { id: 'today', label: 'Сегодня', icon: 'mdi:calendar-today' },
  { id: 'week', label: 'Неделя', icon: 'mdi:calendar-week' },
  { id: 'all', label: 'Все время', icon: 'mdi:infinity' },
]
</script>

<template>
  <div class="header-row">
    <h2 class="section-title">
      {{ t('settings.tokenUsageTitle') }}
    </h2>
    <KitViewSwitcher v-model="selectedPeriod" :items="periodOptions" />
  </div>

  <div class="settings-card tokens-card" :class="{ 'is-loading': isTokensLoading }">
    <KitSkeleton
      v-if="isTokensLoading && totalTokens.input === 0 && totalTokens.output === 0"
      width="100%"
      height="150px"
      color="var(--bg-tertiary-color)"
    />

    <template v-else-if="totalTokens.input > 0 || totalTokens.output > 0">
      <div class="total-tokens">
        <div class="stat-item">
          <span class="label">{{ t('settings.inputTokens') }}</span>
          <span class="value text-accent">{{ formatNumber(totalTokens.input, settingsStore.appLanguage) }}</span>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('settings.outputTokens') }}</span>
          <span class="value">{{ formatNumber(totalTokens.output, settingsStore.appLanguage) }}</span>
        </div>
        <div v-if="totalCost" class="stat-item">
          <span class="label">{{ t('settings.totalCost') }}</span>
          <span class="value text-success">{{ formatCurrency(totalCost) }}</span>
        </div>
      </div>

      <div class="divider" />

      <div class="models-tokens-list">
        <div v-for="act in tokensByAction" :key="act.action" class="model-row-wrapper">
          <div class="model-row">
            <div class="model-name">
              <Icon icon="mdi:flash-outline" class="bot-icon" />
              <span>{{ t(`settings.actions.${act.action}`) !== `settings.actions.${act.action}` ? t(`settings.actions.${act.action}`) : act.action }}</span>
            </div>
            <div class="model-stats">
              <span class="m-in" :title="t('settings.inputTokens')">
                <Icon icon="mdi:arrow-down" class="token-icon" /> {{ formatNumber(act.input, settingsStore.appLanguage) }}
              </span>
              <span class="m-out" :title="t('settings.outputTokens')">
                <Icon icon="mdi:arrow-up" class="token-icon" /> {{ formatNumber(act.output, settingsStore.appLanguage) }}
              </span>
              <span v-if="act.cost" class="m-cost" :title="t('settings.totalCost')">
                ~{{ formatCurrency(act.cost) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="empty-state">
      <Icon icon="mdi:database-off-outline" class="empty-icon" />
      <p>{{ t('settings.tokensNoData') }}</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  margin-bottom: 16px;
  gap: 16px;

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }
}

.section-title {
  margin: 0;
  font-size: 1.4rem;
}

.settings-card {
  background: var(--bg-secondary-color);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
  transition: opacity 0.2s ease;

  &.is-loading {
    opacity: 0.6;
    pointer-events: none;
  }
}

.tokens-card {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .total-tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 48px;
    padding: 12px 12px 0 12px;

    @include media-down(sm) {
      gap: 24px;
    }
  }
  .divider {
    height: 1px;
    background: var(--border-secondary-color);
  }
  .models-tokens-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .model-row-wrapper {
    display: flex;
    flex-direction: column;
    background: var(--bg-tertiary-color);
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    overflow: hidden;
    .model-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      @include media-down(md) {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .model-name {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--fg-primary-color);
        .bot-icon {
          font-size: 1.2rem;
          color: var(--fg-accent-color);
        }
      }
      .model-stats {
        display: flex;
        gap: 16px;
        font-size: 0.9rem;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        @include media-down(sm) {
          margin-left: 28px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .token-icon {
          font-size: 1rem;
          margin-right: 2px;
        }
        .m-in {
          color: var(--fg-accent-color);
          display: flex;
          align-items: center;
        }
        .m-out {
          color: var(--fg-secondary-color);
          display: flex;
          align-items: center;
        }
        .m-cost {
          color: var(--fg-success-color);
          display: flex;
          align-items: center;
          margin-left: 8px;
          @include media-down(sm) {
            margin-left: 0;
          }
        }
      }
    }
  }
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
    &.text-success {
      color: var(--fg-success-color);
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
