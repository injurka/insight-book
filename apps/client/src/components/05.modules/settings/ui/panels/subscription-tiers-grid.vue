<script setup lang="ts">
import type { SubscriptionTierConfig, SubscriptionTierId } from '~/shared/constants/subscriptions'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { SUBSCRIPTION_TIERS_CONFIG } from '~/shared/constants/subscriptions'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const { t } = useI18n()
const authStore = useAuthStore()
const settingsStore = useGlobalSettingsStore()

const currentTierId = computed<SubscriptionTierId>(() => authStore.user?.subscriptionTier || 'free')
const showDetailsModal = ref(false)
const selectedModalTier = ref<SubscriptionTierConfig | null>(null)

const tiers = computed(() => Object.values(SUBSCRIPTION_TIERS_CONFIG))

function isCurrentTier(tierId: SubscriptionTierId) {
  return currentTierId.value === tierId
}

function openTierDetails(tier: SubscriptionTierConfig) {
  selectedModalTier.value = tier
  showDetailsModal.value = true
}

function closeDetails() {
  showDetailsModal.value = false
  selectedModalTier.value = null
}

function formatTokens(num: number) {
  return new Intl.NumberFormat(settingsStore.appLanguage || 'ru-RU').format(num)
}
</script>

<template>
  <div class="subscription-section">
    <div class="section-header">
      <div class="title-with-badge">
        <h2 class="section-title">
          {{ t('subscriptions.title') }}
        </h2>
        <span class="sparkle-badge">
          <Icon icon="mdi:sparkles" class="sparkle-icon" />
          {{ t('subscriptions.subtitleTag') }}
        </span>
      </div>
      <p class="section-description">
        {{ t('subscriptions.description') }}
      </p>
    </div>

    <!-- Tier Cards Grid -->
    <div class="tiers-grid">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        class="tier-card"
        :class="{
          'is-current': isCurrentTier(tier.id),
          'is-popular': tier.popular,
        }"
        :style="{ '--tier-accent': tier.accentColor, '--tier-bg-gradient': tier.gradient }"
      >
        <!-- Popular Ribbon -->
        <div v-if="tier.popular" class="popular-ribbon">
          <Icon icon="mdi:star" />
          <span>{{ t('subscriptions.popular') }}</span>
        </div>

        <!-- Current Active Badge -->
        <div v-if="isCurrentTier(tier.id)" class="current-badge">
          <Icon icon="mdi:check-circle" />
          <span>{{ t('subscriptions.activeTier') }}</span>
        </div>

        <div class="card-top">
          <div class="icon-wrapper" :style="{ color: tier.accentColor }">
            <Icon :icon="tier.icon" />
          </div>
          <span class="tier-badge-pill">{{ tier.badge }}</span>
        </div>

        <h3 class="tier-title">
          {{ t(tier.nameKey) }}
        </h3>

        <div class="price-container">
          <span v-if="tier.priceRu === 0" class="price-free">{{ t('subscriptions.free') }}</span>
          <template v-else>
            <span class="price-currency">₽</span>
            <span class="price-value">{{ tier.priceRu }}</span>
            <span class="price-period">/ {{ t('subscriptions.monthShort') }}</span>
          </template>
        </div>

        <p class="tier-short-desc">
          {{ t(tier.descriptionKey) }}
        </p>

        <!-- Daily Limits Chips -->
        <div class="stats-chips">
          <div class="chip" title="Лимит токенов в день">
            <Icon icon="mdi:lightning-bolt" class="chip-icon tokens-color" />
            <span><b>{{ formatTokens(tier.dailyTokens) }}</b> токенов/день</span>
          </div>
          <div class="chip" title="Лимит книг в день">
            <Icon icon="mdi:book-open-page-variant" class="chip-icon books-color" />
            <span><b>{{ tier.dailyBooks }}</b> книг/день</span>
          </div>
        </div>

        <div class="divider" />

        <!-- Feature List -->
        <ul class="features-list">
          <li v-for="(fKey, idx) in tier.featuresKeys" :key="idx" class="feature-item">
            <Icon icon="mdi:check" class="check-icon" />
            <span>{{ t(fKey) }}</span>
          </li>
        </ul>

        <div class="card-footer">
          <KitBtn
            v-if="isCurrentTier(tier.id)"
            variant="subtle"
            block
            disabled
          >
            {{ t('subscriptions.currentPlanBtn') }}
          </KitBtn>
          <KitBtn
            v-else
            variant="subtle"
            block
            class="select-btn"
            @click="openTierDetails(tier)"
          >
            {{ t('subscriptions.selectPlanBtn') }}
          </KitBtn>
        </div>
      </div>
    </div>

    <!-- Modal for details/order info -->
    <KitDialog
      v-if="selectedModalTier"
      v-model:visible="showDetailsModal"
      :title="t(selectedModalTier.nameKey)"
      :icon="selectedModalTier.icon"
      :max-width="540"
      :style="{ '--tier-accent': selectedModalTier.accentColor }"
    >
      <div class="modal-body-content">
        <div class="modal-price-box">
          <span class="price-big">
            {{ selectedModalTier.priceRu === 0 ? t('subscriptions.free') : `${selectedModalTier.priceRu} ₽ / мес` }}
          </span>
          <span class="modal-badge-pill">{{ selectedModalTier.badge }}</span>
        </div>

        <h4>{{ t('subscriptions.limitsBreakdownTitle') }}</h4>
        <div class="limits-breakdown-grid">
          <div class="breakdown-card">
            <Icon icon="mdi:lightning-bolt" class="b-icon tokens" />
            <div class="b-text">
              <span class="b-label">{{ t('subscriptions.tokensLimit') }}</span>
              <span class="b-val">{{ formatTokens(selectedModalTier.dailyTokens) }} / день</span>
            </div>
          </div>
          <div class="breakdown-card">
            <Icon icon="mdi:book-open-page-variant" class="b-icon books" />
            <div class="b-text">
              <span class="b-label">{{ t('subscriptions.booksLimit') }}</span>
              <span class="b-val">{{ selectedModalTier.dailyBooks }} книг / день</span>
            </div>
          </div>
        </div>

        <h4>{{ t('subscriptions.whatIsIncluded') }}</h4>
        <ul class="features-list modal-features">
          <li v-for="(fKey, idx) in selectedModalTier.featuresKeys" :key="idx" class="feature-item">
            <Icon icon="mdi:check-circle-outline" class="check-icon" />
            <span>{{ t(fKey) }}</span>
          </li>
        </ul>

        <div class="info-note">
          <Icon icon="mdi:information-outline" class="info-icon" />
          <p>{{ t('subscriptions.contactAdminNote') }}</p>
        </div>
      </div>

      <template #footer>
        <KitBtn variant="text" @click="closeDetails">
          {{ t('kit.prompt.cancel') }}
        </KitBtn>
        <a href="mailto:limiteddissolve@gmail.com?subject=Subscription%20Order" class="contact-admin-link">
          <KitBtn variant="solid" icon="mdi:send">
            {{ t('subscriptions.requestSubscription') }}
          </KitBtn>
        </a>
      </template>
    </KitDialog>
  </div>
</template>

<style lang="scss" scoped>
.subscription-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 36px;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .section-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .sparkle-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2));
    border: 1px solid rgba(234, 179, 8, 0.4);
    color: var(--fg-primary-color);
    font-size: 0.8rem;
    font-weight: 600;

    .sparkle-icon {
      color: #eab308;
    }
  }

  .section-description {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
    line-height: 1.5;
  }
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  width: 100%;

  @include media-down(xl) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

.tier-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary-color);
  background-image: var(--tier-bg-gradient);
  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: translateY(-6px);
    border-color: var(--tier-accent);
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.15),
      0 0 20px rgba(var(--fg-accent-color-rgb), 0.12);
  }

  &.is-popular {
    border-color: var(--tier-accent);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
  }

  &.is-current {
    border-color: var(--fg-success-color);
  }
}

.popular-ribbon {
  position: absolute;
  top: -12px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
  letter-spacing: 0.3px;
}

.current-badge {
  position: absolute;
  top: -12px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--fg-success-color);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--bg-tertiary-color);
    font-size: 1.6rem;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
  }

  .tier-badge-pill {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);
  }
}

.tier-title {
  margin: 0 0 8px;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.price-container {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 12px;

  .price-free {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .price-currency {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--tier-accent);
  }

  .price-value {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
    color: var(--fg-primary-color);
    font-variant-numeric: tabular-nums;
  }

  .price-period {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    margin-left: 2px;
  }
}

.tier-short-desc {
  margin: 0 0 16px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
  min-height: 2.8em;
}

.stats-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;

  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(var(--bg-tertiary-color-rgb), 0.5);
    backdrop-filter: blur(4px);
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--fg-primary-color);
    border: 1px solid rgba(var(--border-secondary-color-rgb, 255, 255, 255), 0.1);

    .chip-icon {
      font-size: 1rem;

      &.tokens-color {
        color: #eab308;
      }
      &.books-color {
        color: #3b82f6;
      }
    }
  }
}

.divider {
  height: 1px;
  background: var(--border-secondary-color);
  margin-bottom: 16px;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-grow: 1;

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--fg-primary-color);
    line-height: 1.35;

    .check-icon {
      font-size: 1.1rem;
      color: var(--tier-accent);
      flex-shrink: 0;
      margin-top: 1px;
    }
  }
}

.card-footer {
  margin-top: auto;
}

/* Custom Request Tier Button */
.contact-admin-link {
  text-decoration: none;
}

.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  h4 {
    margin: 8px 0 4px;
    font-size: 1rem;
    color: var(--fg-primary-color);
  }
}

.modal-price-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-secondary-color);
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  .price-big {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .modal-badge-pill {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
  }
}

.limits-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  .breakdown-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-secondary-color);
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);

    .b-icon {
      font-size: 1.6rem;

      &.tokens {
        color: #eab308;
      }
      &.books {
        color: #3b82f6;
      }
    }

    .b-text {
      display: flex;
      flex-direction: column;

      .b-label {
        font-size: 0.75rem;
        color: var(--fg-secondary-color);
        text-transform: uppercase;
        font-weight: 600;
      }

      .b-val {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--fg-primary-color);
      }
    }
  }
}

.modal-features {
  margin: 0;
}

.info-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 10px;
  font-size: 0.85rem;
  color: var(--fg-primary-color);

  .info-icon {
    font-size: 1.2rem;
    color: #3b82f6;
    flex-shrink: 0;
    margin-top: 2px;
  }

  p {
    margin: 0;
    line-height: 1.4;
  }
}
</style>
