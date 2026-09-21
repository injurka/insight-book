<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useAccountSettings } from '../../../composables/use-account-settings'

const { t } = useI18n()

const {
  isYandexLinked,
  isLinking,
  isUnlinking,
  isUnlinkModalVisible,
  linkOAuth,
  openUnlinkModal,
  confirmUnlink,
} = useAccountSettings()
</script>

<template>
  <div class="settings-card integrations-card">
    <div class="integrations-header">
      <h3 class="integrations-title">
        {{ t('settings.linkedAccountsTitle', 'Связанные аккаунты') }}
      </h3>
      <p class="integrations-description">
        {{ t('settings.linkedAccountsDesc', 'Привяжите сторонние сервисы для быстрого входа в аккаунт в один клик.') }}
      </p>
    </div>

    <div class="integrations-list">
      <!-- Яндекс -->
      <div class="integration-item">
        <div class="integration-info">
          <div class="integration-icon-wrap yandex">
            <span class="yandex-badge">Я</span>
          </div>
          <div class="integration-meta">
            <h4>{{ t('settings.yandex', 'Яндекс') }}</h4>
            <div class="integration-status" :class="{ linked: isYandexLinked }">
              <span class="status-dot" />
              <span>{{ isYandexLinked ? t('settings.linked', 'Подключен') : t('settings.notLinked', 'Не привязан') }}</span>
            </div>
          </div>
        </div>
        <div class="integration-action">
          <KitBtn
            v-if="isYandexLinked"
            variant="outlined"
            color="secondary"
            size="sm"
            :disabled="isUnlinking"
            :loading="isUnlinking"
            @click="openUnlinkModal('yandex')"
          >
            {{ t('settings.unlink', 'Отвязать') }}
          </KitBtn>
          <KitBtn
            v-else
            variant="solid"
            color="primary"
            size="sm"
            :disabled="isLinking"
            :loading="isLinking"
            @click="linkOAuth('yandex')"
          >
            {{ t('settings.link', 'Привязать') }}
          </KitBtn>
        </div>
      </div>
    </div>

    <!-- Модалка подтверждения отвязки -->
    <KitDialog
      v-model:visible="isUnlinkModalVisible"
      :title="t('settings.unlinkConfirmTitle', 'Отвязать аккаунт?')"
      :max-width="440"
    >
      <div class="unlink-dialog-content">
        <p class="unlink-desc">
          {{ t('settings.unlinkConfirmDesc', { provider: 'Яндекс' }) }}
        </p>
        <div class="dialog-actions">
          <KitBtn variant="tonal" size="sm" @click="isUnlinkModalVisible = false">
            {{ t('common.cancel', 'Отмена') }}
          </KitBtn>
          <KitBtn
            color="error"
            size="sm"
            :loading="isUnlinking"
            @click="confirmUnlink"
          >
            {{ t('settings.unlink', 'Отвязать') }}
          </KitBtn>
        </div>
      </div>
    </KitDialog>
  </div>
</template>

<style lang="scss" scoped>
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: var(--r-m, 12px);
  border: 1px solid var(--border-secondary-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.integrations-card {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .integrations-header {
    .integrations-title {
      margin: 0 0 6px;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .integrations-description {
      margin: 0;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }
}

.integrations-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.integration-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m, 12px);
  gap: 1rem;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.integration-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.integration-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: var(--r-m, 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  flex-shrink: 0;

  &.yandex {
    color: #fc3f1d;
  }
}

.yandex-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fc3f1d;
  color: #ffffff;
  font-family:
    Arial,
    -apple-system,
    sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
}

.integration-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.integration-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  white-space: nowrap;
  color: var(--fg-secondary-color);

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  &.linked {
    color: var(--color-success, #22c55e);

    .status-dot {
      background-color: var(--color-success, #22c55e);
    }
  }
}

.unlink-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 8px;

  .unlink-desc {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>
