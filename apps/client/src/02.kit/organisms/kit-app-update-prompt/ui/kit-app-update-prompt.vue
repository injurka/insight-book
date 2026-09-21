<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useAppUpdateStore } from '~/01.shared/store/app-update.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

const appUpdateStore = useAppUpdateStore()
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
        <div
          class="prompt-icon"
          :class="{
            'is-downloading': isDownloading,
            'is-ready': !!downloadedFilePath && !isDownloading,
            'is-error': !!downloadError && !isDownloading,
          }"
        >
          <Icon
            v-if="downloadedFilePath"
            icon="mdi:check-circle-outline"
          />
          <Icon
            v-else-if="downloadError"
            icon="mdi:alert-circle-outline"
          />
          <Icon
            v-else
            icon="solar:download-square-bold"
          />
        </div>

        <div class="prompt-content-wrapper">
          <div class="prompt-message">
            <h4 class="prompt-title">
              <span v-if="downloadedFilePath">Обновление готово к установке</span>
              <span v-else-if="isDownloading">Загрузка обновления v{{ latestVersion }}</span>
              <span v-else-if="downloadError">Ошибка загрузки v{{ latestVersion }}</span>
              <span v-else>Доступно обновление v{{ latestVersion }}</span>
            </h4>

            <p class="prompt-description">
              <span v-if="downloadedFilePath">
                Файл обновления v{{ latestVersion }} успешно загружен.
              </span>
              <span v-else-if="downloadError">
                {{ downloadError }}. Вы можете повторить попытку или перейти к релизу.
              </span>
              <span v-else-if="isDownloading">
                Скачивание файла новой версии...
              </span>
              <span v-else>
                Доступна новая версия v{{ latestVersion }}. Скачать и установить прямо сейчас?
              </span>
            </p>

            <!-- Прогресс-бар во время загрузки -->
            <div v-if="isDownloading || (downloadedFilePath && downloadProgress === 100)" class="update-progress-container">
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
          </div>

          <div class="prompt-actions">
            <!-- Состояние 1: Загрузка завершена -->
            <template v-if="downloadedFilePath && !isDownloading">
              <KitBtn
                icon="mdi:cellphone-arrow-down"
                color="primary"
                @click="appUpdateStore.installApk()"
              >
                Установить
              </KitBtn>
              <KitBtn
                variant="outlined"
                color="secondary"
                @click="appUpdateStore.closePrompt()"
              >
                Закрыть
              </KitBtn>
            </template>

            <!-- Состояние 2: Идет загрузка -->
            <template v-else-if="isDownloading">
              <KitBtn
                variant="outlined"
                color="secondary"
                @click="appUpdateStore.closePrompt()"
              >
                Скрыть
              </KitBtn>
            </template>

            <!-- Состояние 3: Ошибка при загрузке -->
            <template v-else-if="downloadError">
              <KitBtn
                icon="mdi:refresh"
                color="primary"
                @click="appUpdateStore.startUpdate()"
              >
                Повторить
              </KitBtn>
              <KitBtn
                variant="outlined"
                color="secondary"
                icon="mdi:open-in-new"
                @click="appUpdateStore.openExternalRelease()"
              >
                В браузере
              </KitBtn>
              <KitBtn
                variant="text"
                color="secondary"
                @click="appUpdateStore.closePrompt()"
              >
                Закрыть
              </KitBtn>
            </template>

            <!-- Состояние 4: Исходное состояние предложения обновиться -->
            <template v-else>
              <KitBtn
                icon="mdi:download"
                color="primary"
                @click="appUpdateStore.startUpdate()"
              >
                Скачать
              </KitBtn>
              <KitBtn
                variant="outlined"
                color="secondary"
                @click="appUpdateStore.closePrompt()"
              >
                Позже
              </KitBtn>
            </template>
          </div>
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
  align-items: flex-start;
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
    flex-direction: column;
    right: 16px;
    left: 16px;
    bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
    width: auto;
    max-width: none;
    padding: 14px 16px;
  }
}

.prompt-icon {
  font-size: 2.2rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-downloading {
    color: var(--fg-primary-color);
  }

  &.is-ready {
    color: var(--fg-success-color);
  }

  &.is-error {
    color: var(--fg-error-color);
  }
}

.prompt-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--p-s, 12px);
  flex-grow: 1;
  width: 100%;
}

.prompt-message {
  flex-grow: 1;
}

.prompt-title {
  margin: 0 0 6px 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.prompt-description {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.update-progress-container {
  margin-top: 12px;
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
  gap: var(--p-xs, 8px);
  align-self: flex-end;

  @include media-down(xs) {
    width: 100%;
    flex-direction: column;
    align-self: stretch;

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
