<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppUpdateStore } from '~/01.shared/store/app-update.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

type UpdateStatus = 'available' | 'downloading' | 'ready' | 'error'

const appUpdateStore = useAppUpdateStore()
const { t } = useI18n()
const {
  hasUpdate,
  latestVersion,
  isDownloading,
  downloadProgress,
  downloadedBytes,
  totalBytes,
  downloadedFilePath,
  downloadError,
} = storeToRefs(appUpdateStore)

const status = computed<UpdateStatus>(() => {
  if (downloadedFilePath.value && !isDownloading.value)
    return 'ready'
  if (isDownloading.value)
    return 'downloading'
  if (downloadError.value)
    return 'error'

  return 'available'
})

const statusIcon = computed(() => {
  if (status.value === 'ready')
    return 'mdi:check-circle-outline'
  if (status.value === 'error')
    return 'mdi:alert-circle-outline'

  return 'solar:download-square-bold'
})

const title = computed(() => {
  const version = latestVersion.value ?? ''
  switch (status.value) {
    case 'ready':
      return t('appUpdate.readyTitle')
    case 'downloading':
      return t('appUpdate.downloadingTitle', { version })
    case 'error':
      return t('appUpdate.errorTitle', { version })
    default:
      return t('appUpdate.availableTitle', { version })
  }
})

const description = computed(() => {
  const version = latestVersion.value ?? ''
  switch (status.value) {
    case 'ready':
      return t('appUpdate.readyDesc', { version })
    case 'downloading':
      return t('appUpdate.downloadingDesc')
    case 'error':
      return t('appUpdate.errorDesc', { error: downloadError.value ?? '' })
    default:
      return t('appUpdate.availableDesc', { version })
  }
})

const showProgress = computed(() =>
  isDownloading.value || (!!downloadedFilePath.value && downloadProgress.value === 100))

function formatBytes(bytes: number): string {
  if (bytes <= 0)
    return '0 MB'
  const mb = bytes / (1024 * 1024)

  return `${mb.toFixed(1)} MB`
}

const progressDetails = computed(() => {
  if (!isDownloading.value && !downloadedFilePath.value)
    return null
  const current = formatBytes(downloadedBytes.value)
  if (totalBytes.value && totalBytes.value > 0) {
    const total = formatBytes(totalBytes.value)

    return `${current} / ${total}`
  }

  return current
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="hasUpdate"
        class="app-update-prompt"
        role="alert"
      >
        <div class="prompt-message">
          <div class="prompt-header">
            <div
              class="prompt-icon"
              :class="{
                'is-downloading': status === 'downloading',
                'is-ready': status === 'ready',
                'is-error': status === 'error',
              }"
            >
              <Icon :icon="statusIcon" />
            </div>

            <h4 class="prompt-title">
              {{ title }}
            </h4>
          </div>

          <p class="prompt-description">
            {{ description }}
          </p>
        </div>

        <!-- Прогресс-бар во время загрузки -->
        <div v-if="showProgress" class="update-progress-container">
          <div class="update-progress-track">
            <div
              class="update-progress-fill"
              :style="{ width: `${downloadProgress}%` }"
            />
          </div>
          <div class="update-progress-meta">
            <span class="update-progress-percentage">{{ downloadProgress }}%</span>
            <span v-if="progressDetails" class="update-progress-bytes">{{ progressDetails }}</span>
          </div>
        </div>

        <div class="prompt-actions">
          <!-- Состояние 1: Загрузка завершена -->
          <template v-if="status === 'ready'">
            <KitBtn
              icon="mdi:cellphone-arrow-down"
              color="primary"
              @click="appUpdateStore.installApk()"
            >
              {{ t('appUpdate.installBtn') }}
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="appUpdateStore.closePrompt()"
            >
              {{ t('appUpdate.closeBtn') }}
            </KitBtn>
          </template>

          <!-- Состояние 2: Идет загрузка -->
          <template v-else-if="status === 'downloading'">
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="appUpdateStore.closePrompt()"
            >
              {{ t('appUpdate.hideBtn') }}
            </KitBtn>
          </template>

          <!-- Состояние 3: Ошибка при загрузке -->
          <template v-else-if="status === 'error'">
            <KitBtn
              icon="mdi:refresh"
              color="primary"
              @click="appUpdateStore.startUpdate()"
            >
              {{ t('appUpdate.retryBtn') }}
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              icon="mdi:open-in-new"
              @click="appUpdateStore.openExternalRelease()"
            >
              {{ t('appUpdate.openInBrowserBtn') }}
            </KitBtn>
            <KitBtn
              variant="text"
              color="secondary"
              @click="appUpdateStore.closePrompt()"
            >
              {{ t('appUpdate.closeBtn') }}
            </KitBtn>
          </template>

          <!-- Состояние 4: Исходное состояние предложения обновиться -->
          <template v-else>
            <KitBtn
              icon="mdi:download"
              color="primary"
              @click="appUpdateStore.startUpdate()"
            >
              {{ t('appUpdate.downloadBtn') }}
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="appUpdateStore.closePrompt()"
            >
              {{ t('appUpdate.laterBtn') }}
            </KitBtn>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.app-update-prompt {
  position: fixed;
  right: var(--p-l, 20px);
  bottom: var(--p-l, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--p-m, 16px);
  padding: 16px 20px;
  border: 1px solid var(--border-primary-color);
  border-radius: 14px;
  z-index: 10001;
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: 0 12px 36px var(--bg-overlay-primary-color);
  width: 480px;
  max-width: calc(100vw - 32px);
  backdrop-filter: blur(12px);

  @include media-down(sm) {
    right: 16px;
    left: 16px;
    bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
    width: auto;
    max-width: none;
    padding: 14px 16px;
    gap: var(--p-s, 12px);
  }
}

.prompt-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: var(--p-s, 12px);
}

.prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-accent-color);
  font-size: 1.35rem;
  flex-shrink: 0;

  &.is-downloading {
    color: var(--fg-primary-color);
  }

  &.is-ready {
    color: var(--fg-success-color);
  }

  &.is-error {
    color: var(--fg-error-color);
  }

  @include media-down(sm) {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    font-size: 1.2rem;
  }
}

.prompt-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg-primary-color);
}

.prompt-description {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.update-progress-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.update-progress-track {
  width: 100%;
  height: 8px;
  background-color: var(--bg-tertiary-color);
  border-radius: var(--r-full);
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background-color: var(--fg-accent-color);
  border-radius: var(--r-full);
  transition: width 0.25s ease-out;
}

.update-progress-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  font-weight: 500;
}

.update-progress-percentage {
  color: var(--fg-primary-color);
  font-weight: 600;
}

.prompt-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-xs, 8px);

  @include media-down(xs) {
    flex-direction: column;
    width: 100%;

    :deep(.kit-btn) {
      width: 100%;
      justify-content: center;
    }
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
