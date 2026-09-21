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
  <div class="settings-panel">
    <div v-if="isMobileApp" class="panel-section update-section">
      <h2 class="section-title">
        {{ t('settings.appUpdatesTitle') }}
      </h2>
      <p class="section-description">
        {{ t('settings.appUpdatesDescription') }}
      </p>
      <KitBtn
        prepend-icon="mdi:update"
        variant="tonal"
        :loading="isCheckingForUpdates"
        @click="checkForUpdates"
      >
        {{ t('settings.checkForUpdates') }}
      </KitBtn>
    </div>

    <div class="panel-section">
      <h2 class="section-title">
        Правовая информация
      </h2>

      <div class="link-list">
        <button class="info-link-btn" @click="router.push(AppRoutePaths.About)">
          <div class="btn-content">
            <Icon icon="mdi:information-outline" class="icon" />
            <span class="text">О сайте</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron" />
        </button>

        <button class="info-link-btn" @click="router.push(AppRoutePaths.Privacy)">
          <div class="btn-content">
            <Icon icon="mdi:shield-account-outline" class="icon" />
            <span class="text">Политика конфиденциальности</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron" />
        </button>

        <button class="info-link-btn" @click="router.push(AppRoutePaths.Copyright)">
          <div class="btn-content">
            <Icon icon="mdi:copyright" class="icon" />
            <span class="text">Для правообладателей</span>
          </div>
          <Icon icon="mdi:chevron-right" class="chevron" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 1.2rem;
  margin: 0;
  color: var(--fg-primary-color);
  font-weight: 600;
}

.update-section {
  align-items: flex-start;
}

.section-description {
  margin: 0;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-link-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  text-align: left;
  outline: none;

  &:hover {
    border-color: var(--border-accent-color);
    background: var(--bg-tertiary-color);
    box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
  }

  &:active {
    transform: translateY(0);
  }

  .btn-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon {
    font-size: 1.4rem;
    color: var(--fg-accent-color);
  }

  .text {
    font-size: 1rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .chevron {
    font-size: 1.4rem;
    color: var(--fg-secondary-color);
    transition: transform 0.2s ease;
  }

  &:hover .chevron {
    color: var(--fg-primary-color);
  }
}
</style>
