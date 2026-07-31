<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn } from '~/02.kit'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg'
import { LimitProgressCard } from '~/04.features/limits'
import SettingsTokensPanel from '~/05.modules/settings/ui/panels/settings-tokens-panel.vue'
import SubscriptionTiersGrid from '~/05.modules/settings/ui/panels/subscription-tiers-grid.vue'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const showSubscriptionTiers = ref(false)
</script>

<template>
  <div class="limits-page">
    <KitHoverRevealBg />

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
        <LimitProgressCard
          icon="mdi:robot-outline"
          icon-class="ai-icon"
          :title="t('limits.aiTokensTitle')"
          :description="t('limits.aiTokensDesc')"
          :used="authStore.user?.usedTokens"
          :limit="authStore.user?.tokenLimit"
        />

        <LimitProgressCard
          icon="mdi:book-open-page-variant-outline"
          icon-class="book-icon"
          :title="t('limits.booksTitle')"
          :description="t('limits.booksDesc')"
          :used="authStore.user?.usedBooks"
          :limit="authStore.user?.bookLimit"
        />
      </div>

      <!-- Кнопка раскрытия тарифов -->
      <div class="tiers-toggle-bar">
        <KitBtn
          :icon="showSubscriptionTiers ? 'mdi:chevron-up' : 'mdi:view-grid-plus-outline'"
          variant="outline"
          class="toggle-tiers-btn"
          @click="showSubscriptionTiers = !showSubscriptionTiers"
        >
          {{ showSubscriptionTiers ? 'Скрыть тарифные планы' : 'Сравнить и выбрать тарифный план' }}
        </KitBtn>
      </div>

      <!-- Тарифные планы подписки -->
      <Transition name="fade-slide">
        <div v-if="showSubscriptionTiers" class="tiers-wrapper">
          <SubscriptionTiersGrid />
        </div>
      </Transition>

      <SettingsTokensPanel />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.limits-page {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
  padding-top: calc(32px + var(--safe-area-top));
  width: 100%;
  padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));

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

.tiers-toggle-bar {
  display: flex;
  justify-content: center;
  margin: 16px 0 24px;

  .toggle-tiers-btn {
    padding: 10px 20px;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
  }
}

.tiers-wrapper {
  margin-bottom: 24px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
