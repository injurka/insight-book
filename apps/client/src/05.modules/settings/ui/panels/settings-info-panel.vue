<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { getActivePinia } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from '~/01.shared/composables/use-toast'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { isMobileApp } from '~/01.shared/lib/env'
import { checkForTauriUpdate } from '~/01.shared/services/tauri-update.service'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const isCheckingForUpdates = ref(false)

async function checkForUpdates() {
  const pinia = getActivePinia()
  if (!pinia)
    return

  isCheckingForUpdates.value = true
  try {
    const updateAvailable = await checkForTauriUpdate(pinia, true)
    if (!updateAvailable)
      toast.success(t('settings.appUpToDate'))
  }
  catch (error) {
    console.error('Manual update check failed:', error)
    toast.error(t('settings.updateCheckFailed'))
  }
  finally {
    isCheckingForUpdates.value = false
  }
}
</script>

<template>
  <div class="settings-info-panel">
    <div v-if="isMobileApp" class="mobile-update-card">
      <div class="update-info">
        <h4 class="update-title">
          {{ t('settings.appUpdatesTitle') }}
        </h4>
        <p class="update-desc">
          {{ t('settings.appUpdatesDescription') }}
        </p>
      </div>
      <KitBtn
        prepend-icon="mdi:update"
        variant="tonal"
        color="primary"
        size="sm"
        :loading="isCheckingForUpdates"
        @click="checkForUpdates"
      >
        {{ t('settings.checkForUpdates') }}
      </KitBtn>
    </div>

    <div class="legal-card">
      <div class="card-header">
        <Icon icon="mdi:shield-file-outline" class="header-icon" />
        <h4 class="card-title">
          {{ t('settings.legalTitle', 'Правовая информация') }}
        </h4>
      </div>

      <div class="links-group">
        <button class="info-link-row" type="button" @click="router.push(AppRoutePaths.About)">
          <div class="row-left">
            <div class="row-icon-wrap">
              <Icon icon="mdi:information-outline" />
            </div>
            <span class="row-label">{{ t('settings.aboutApp', 'О сайте') }}</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron-icon" />
        </button>

        <div class="divider" />

        <button class="info-link-row" type="button" @click="router.push(AppRoutePaths.Privacy)">
          <div class="row-left">
            <div class="row-icon-wrap">
              <Icon icon="mdi:shield-account-outline" />
            </div>
            <span class="row-label">{{ t('settings.privacyPolicy', 'Политика конфиденциальности') }}</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron-icon" />
        </button>

        <div class="divider" />

        <button class="info-link-row" type="button" @click="router.push(AppRoutePaths.Copyright)">
          <div class="row-left">
            <div class="row-icon-wrap">
              <Icon icon="mdi:copyright" />
            </div>
            <span class="row-label">{{ t('settings.forCopyrightHolders', 'Для правообладателей') }}</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-info-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-update-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 14px;
  padding: 16px 20px;

  @include media-down(xs) {
    flex-direction: column;
    align-items: flex-start;
  }

  .update-info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .update-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .update-desc {
      margin: 0;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }
}

.legal-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon {
      font-size: 1.25rem;
      color: var(--fg-accent-color);
    }

    .card-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }
}

.links-group {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  overflow: hidden;
}

.divider {
  height: 1px;
  background: var(--border-secondary-color);
  margin: 0 16px;
}

.info-link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  outline: none;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--bg-hover-color);

    .chevron-icon {
      color: var(--fg-primary-color);
      transform: translateX(2px);
    }
  }

  .row-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .row-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
    color: var(--fg-accent-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    flex-shrink: 0;
  }

  .row-label {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .chevron-icon {
    font-size: 1.3rem;
    color: var(--fg-secondary-color);
    transition: all 0.2s ease;
  }
}
</style>
