<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

interface Props {
  isReadOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isReadOnly: false,
})

const status = defineModel<'private' | 'pending' | 'public' | 'rejected'>('status', {
  default: 'private',
})

const { t } = useI18n()

const effectiveStatus = computed<'private' | 'pending' | 'public' | 'rejected'>(() => {
  if (props.isReadOnly || status.value === 'public')
    return 'public'
  if (status.value === 'pending')
    return 'pending'
  if (status.value === 'rejected')
    return 'rejected'

  return 'private'
})

const statusConfig = computed(() => {
  switch (effectiveStatus.value) {
    case 'public':
      return {
        icon: 'mdi:check-decagram',
        badgeClass: 'badge--success',
        badgeIcon: 'mdi:check-circle',
        badgeLabel: t('library.publicStatusPublished'),
        desc: t('library.publishPublishedDesc'),
      }
    case 'pending':
      return {
        icon: 'mdi:clock-time-four-outline',
        badgeClass: 'badge--warning',
        badgeIcon: 'mdi:clock-outline',
        badgeLabel: t('library.publicStatusPending'),
        desc: t('library.publishPendingDesc'),
      }
    case 'rejected':
      return {
        icon: 'mdi:alert-circle-outline',
        badgeClass: 'badge--error',
        badgeIcon: 'mdi:close-circle',
        badgeLabel: t('library.publicStatusRejected'),
        desc: t('library.publishRejectedDesc'),
      }
    case 'private':
    default:
      return {
        icon: 'mdi:earth',
        badgeClass: 'badge--neutral',
        badgeIcon: 'mdi:lock-outline',
        badgeLabel: t('library.publicStatusPrivate'),
        desc: t('library.publishRequestDesc'),
      }
  }
})

function setPending() {
  status.value = 'pending'
}

function cancelRequest() {
  status.value = 'private'
}
</script>

<template>
  <div
    class="publish-request-block"
    :class="`publish-request-block--${effectiveStatus}`"
  >
    <div class="publish-content">
      <div class="publish-icon-box">
        <Icon :icon="statusConfig.icon" class="publish-main-icon" />
      </div>

      <div class="publish-details">
        <div class="publish-header-row">
          <span class="publish-title">{{ t('library.menuPublicCatalog') }}</span>
          <span class="status-pill" :class="statusConfig.badgeClass">
            <Icon :icon="statusConfig.badgeIcon" class="pill-icon" />
            {{ statusConfig.badgeLabel }}
          </span>
        </div>
        <p class="publish-description">
          {{ statusConfig.desc }}
        </p>
      </div>

      <div class="publish-action">
        <KitBtn
          v-if="effectiveStatus === 'private'"
          variant="tonal"
          color="primary"
          size="sm"
          prepend-icon="mdi:send-outline"
          @click="setPending"
        >
          {{ t('library.sendPublishRequest') }}
        </KitBtn>

        <KitBtn
          v-else-if="effectiveStatus === 'pending'"
          variant="tonal"
          color="error"
          size="sm"
          prepend-icon="mdi:close-circle-outline"
          @click="cancelRequest"
        >
          {{ t('library.cancelPublishRequest') }}
        </KitBtn>

        <KitBtn
          v-else-if="effectiveStatus === 'rejected'"
          variant="tonal"
          color="primary"
          size="sm"
          prepend-icon="mdi:refresh"
          @click="setPending"
        >
          {{ t('library.retryPublishRequest') }}
        </KitBtn>

        <div v-else-if="effectiveStatus === 'public'" class="publish-lock-badge">
          <Icon icon="mdi:lock" class="lock-icon" />
        </div>
      </div>
    </div>

    <div v-if="effectiveStatus === 'public'" class="publish-warning-banner">
      <Icon icon="mdi:information-outline" class="warning-icon" />
      <span>{{ t('library.publicBookWarning') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.publish-request-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &--public {
    background-color: rgba(var(--fg-success-color-rgb, 75, 130, 102), 0.08);
    border-color: rgba(var(--fg-success-color-rgb, 75, 130, 102), 0.25);
  }

  &--pending {
    background-color: rgba(var(--fg-warning-color-rgb, 255, 152, 0), 0.08);
    border-color: rgba(var(--fg-warning-color-rgb, 255, 152, 0), 0.25);
  }

  &--rejected {
    background-color: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.08);
    border-color: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.25);
  }
}

.publish-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.publish-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: var(--bg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  .publish-main-icon {
    font-size: 22px;
  }
}

.publish-request-block--public .publish-icon-box .publish-main-icon {
  color: var(--fg-success-color, #4b8266);
}

.publish-request-block--pending .publish-icon-box .publish-main-icon {
  color: var(--fg-warning-color, #ff9800);
}

.publish-request-block--rejected .publish-icon-box .publish-main-icon {
  color: var(--fg-error-color, #f44336);
}

.publish-request-block--private .publish-icon-box .publish-main-icon {
  color: var(--fg-accent-color, #4b8266);
}

.publish-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.publish-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.publish-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.2;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 12px;
  line-height: 1.4;

  .pill-icon {
    font-size: 13px;
    flex-shrink: 0;
  }

  &.badge--success {
    background-color: rgba(var(--fg-success-color-rgb, 75, 130, 102), 0.18);
    color: var(--fg-success-color, #4b8266);
  }

  &.badge--warning {
    background-color: rgba(var(--fg-warning-color-rgb, 255, 152, 0), 0.18);
    color: var(--fg-warning-color, #d97706);
  }

  &.badge--error {
    background-color: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.18);
    color: var(--fg-error-color, #dc2626);
  }

  &.badge--neutral {
    background-color: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.15));
    color: var(--fg-secondary-color, #8e867b);
  }
}

.publish-description {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.35;
}

.publish-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.publish-lock-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: rgba(var(--fg-success-color-rgb, 75, 130, 102), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-success-color, #4b8266);

  .lock-icon {
    font-size: 16px;
  }
}

.publish-warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background-color: rgba(var(--fg-warning-color-rgb, 255, 152, 0), 0.1);
  color: var(--fg-warning-color, #b45309);
  font-size: 0.775rem;
  line-height: 1.35;

  .warning-icon {
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
}
</style>
