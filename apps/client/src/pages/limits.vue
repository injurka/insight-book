<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import SettingsTokensPanel from '~/components/05.modules/settings/ui/panels/settings-tokens-panel.vue'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const settingsStore = useGlobalSettingsStore()

const tokenPercent = computed(() => {
  const used = authStore.user?.usedTokens ?? 0
  const limit = authStore.user?.tokenLimit
  if (limit === null || limit === undefined)
    return 0
  if (limit === 0)
    return 100
  return Math.min(100, Math.round((used / limit) * 100))
})

const bookPercent = computed(() => {
  const used = authStore.user?.usedBooks ?? 0
  const limit = authStore.user?.bookLimit
  if (limit === null || limit === undefined)
    return 0
  if (limit === 0)
    return 100
  return Math.min(100, Math.round((used / limit) * 100))
})

function getPercentClass(percentage: number) {
  if (percentage < 70)
    return 'is-success'
  if (percentage <= 90)
    return 'is-warning'
  return 'is-error'
}

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
  <div class="limits-page">
    <HoverRevealBg />

    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>{{ t('limits.title') }}</h1>
        <p>{{ t('limits.subtitle') }}</p>
      </div>
    </header>

    <div class="content">
      <h2 class="section-title">
        {{ t('limits.generalTitle') }}
      </h2>

      <div class="limits-grid">
        <!-- ИИ Токены -->
        <div class="limit-card">
          <div class="card-header">
            <div class="icon-container ai-icon">
              <Icon icon="mdi:robot-outline" />
            </div>
            <div class="title-container">
              <h3 class="limit-name">
                {{ t('limits.aiTokensTitle') }}
              </h3>
              <p class="limit-desc">
                {{ t('limits.aiTokensDesc') }}
              </p>
            </div>
          </div>

          <div class="card-body">
            <div v-if="authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined" class="progress-container">
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: `${tokenPercent}%` }" :class="getPercentClass(tokenPercent)" />
              </div>
            </div>

            <div class="usage-details">
              <span class="detail-label">{{ t('limits.used') }}:</span>
              <span class="detail-value">
                {{ formatNumber(authStore.user?.usedTokens) }} / {{ authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined ? formatNumber(authStore.user?.tokenLimit) : t('limits.infinite') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Книги -->
        <div class="limit-card">
          <div class="card-header">
            <div class="icon-container book-icon">
              <Icon icon="mdi:book-open-page-variant-outline" />
            </div>
            <div class="title-container">
              <h3 class="limit-name">
                {{ t('limits.booksTitle') }}
              </h3>
              <p class="limit-desc">
                {{ t('limits.booksDesc') }}
              </p>
            </div>
          </div>

          <div class="card-body">
            <div v-if="authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined" class="progress-container">
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: `${bookPercent}%` }" :class="getPercentClass(bookPercent)" />
              </div>
            </div>

            <div class="usage-details">
              <span class="detail-label">{{ t('limits.used') }}:</span>
              <span class="detail-value">
                {{ formatNumber(authStore.user?.usedBooks) }} / {{ authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined ? formatNumber(authStore.user?.bookLimit) : t('limits.infinite') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <SettingsTokensPanel />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.limits-page {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  padding-top: calc(32px + var(--safe-area-top));
  width: 100%;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

  @include media-down(md) {
    padding: 16px;
    padding-top: calc(16px + var(--safe-area-top));
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
      color: var(--fg-primary-color);
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }
}

.content {
  display: flex;
  flex-direction: column;
}

.section-title {
  margin-top: 16px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.limits-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;

  @include media-down(md) {
    grid-template-columns: 1fr;
  }
}

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
