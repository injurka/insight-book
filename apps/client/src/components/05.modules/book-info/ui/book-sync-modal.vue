<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn, KitCheckbox, KitDialog } from '~/components/01.kit'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useAppWakeLock } from '~/shared/composables/use-app-wake-lock'

const props = defineProps<{ bookId: number }>()
const visible = defineModel<boolean>('visible', { required: true })
const libraryStore = useLibraryStore()

const options = ref({
  cachePages: true,
  analyzeSentences: false,
})

const isRunning = computed(() => libraryStore.syncState === 'running')
const isFinished = computed(() => libraryStore.syncState === 'finished')
const hasError = computed(() => libraryStore.syncState === 'error')

useAppWakeLock(isRunning)

const syncStateIcon = computed(() => {
  if (hasError.value)
    return 'mdi:alert-circle-outline'
  if (isFinished.value)
    return 'mdi:check-circle-outline'
  return 'mdi:loading'
})

const syncStateClass = computed(() => {
  if (hasError.value)
    return 'is-error'
  if (isFinished.value)
    return 'is-success'
  return 'is-running'
})

function start() {
  libraryStore.startWholeBookSync(props.bookId, options.value)
}

function cancel() {
  libraryStore.cancelSync()
}

function close() {
  if (isRunning.value)
    return
  visible.value = false
}

watch(visible, (val) => {
  if (val && libraryStore.syncState !== 'running') {
    libraryStore.syncState = 'idle'
  }
})
</script>

<template>
  <KitDialog v-model:visible="visible" title="Синхронизация книги" icon="mdi:cloud-download-outline" :persistent="isRunning" :max-width="500">
    <div v-if="!isRunning && !isFinished" class="sync-setup">
      <div class="setup-header">
        <Icon icon="mdi:wifi-off" class="setup-icon" />
        <p>Выберите, что нужно загрузить для работы в оффлайн-режиме.</p>
      </div>

      <div class="sync-options">
        <div class="sync-option" :class="{ 'is-active': options.cachePages }" @click="options.cachePages = !options.cachePages">
          <div class="option-content">
            <Icon icon="mdi:file-document-multiple-outline" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">Кэшировать страницы</span>
              <span class="option-desc">Текст, стили и изображения</span>
            </div>
          </div>
          <KitCheckbox :model-value="options.cachePages" style="pointer-events: none;" />
        </div>

        <div class="sync-option" :class="{ 'is-active': options.analyzeSentences }" @click="options.analyzeSentences = !options.analyzeSentences">
          <div class="option-content">
            <Icon icon="mdi:brain" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">Глубокий анализ</span>
              <span class="option-desc">Предварительный ИИ перевод предложений</span>
            </div>
          </div>
          <KitCheckbox :model-value="options.analyzeSentences" style="pointer-events: none;" />
        </div>
      </div>

      <Transition name="fade">
        <div v-if="options.analyzeSentences" class="warning-box">
          <Icon icon="mdi:alert-outline" class="warning-icon" />
          <div class="warning-content">
            <strong>Внимание!</strong>
            <p>Процесс может занять много времени и активно расходовать лимиты API. Рекомендуется использовать с локальными моделями (Ollama).</p>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="isRunning || isFinished || hasError" class="sync-progress-view">
      <div class="progress-status-header" :class="syncStateClass">
        <Icon :icon="syncStateIcon" class="status-icon" :class="{ 'spin-animation': isRunning }" />
        <p class="current-task">
          {{ libraryStore.syncProgress.currentTask }}
        </p>
      </div>

      <div class="progress-bars-container">
        <div v-if="options.cachePages" class="progress-section">
          <div class="progress-info">
            <span class="label"><Icon icon="mdi:file-document-multiple-outline" /> Страницы</span>
            <span class="value">{{ libraryStore.syncProgress.pagesDone }} / {{ libraryStore.syncProgress.pagesTotal }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill pages-fill"
              :style="{ width: `${libraryStore.syncProgress.pagesTotal > 0 ? (libraryStore.syncProgress.pagesDone / libraryStore.syncProgress.pagesTotal) * 100 : 0}%` }"
            />
          </div>
        </div>

        <div v-if="options.analyzeSentences && libraryStore.syncProgress.sentencesTotal > 0" class="progress-section">
          <div class="progress-info">
            <span class="label"><Icon icon="mdi:brain" /> Предложения</span>
            <span class="value">{{ libraryStore.syncProgress.sentencesDone }} / {{ libraryStore.syncProgress.sentencesTotal }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill sentences-fill"
              :style="{ width: `${(libraryStore.syncProgress.sentencesDone / libraryStore.syncProgress.sentencesTotal) * 100}%` }"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <KitBtn v-if="!isRunning && !isFinished" variant="tonal" @click="close">
        Отмена
      </KitBtn>
      <KitBtn v-if="!isRunning && !isFinished" color="primary" @click="start">
        Начать
      </KitBtn>

      <KitBtn v-if="isRunning" color="error" variant="outlined" @click="cancel">
        Остановить
      </KitBtn>
      <KitBtn v-if="isFinished || hasError" color="primary" @click="close">
        Закрыть
      </KitBtn>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.sync-setup {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .setup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
    padding: 16px;
    border-radius: 12px;

    .setup-icon {
      font-size: 2rem;
      color: var(--fg-accent-color);
    }

    p {
      margin: 0;
      font-size: 0.95rem;
      color: var(--fg-primary-color);
      line-height: 1.4;
    }
  }

  .sync-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sync-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-primary-color);
    }

    &.is-active {
      border-color: var(--fg-accent-color);
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
    }

    .option-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .option-icon {
      font-size: 1.8rem;
      color: var(--fg-secondary-color);
      transition: color 0.2s ease;
    }

    &.is-active .option-icon {
      color: var(--fg-accent-color);
    }

    .option-texts {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .option-title {
        font-weight: 600;
        font-size: 1rem;
        color: var(--fg-primary-color);
      }

      .option-desc {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }

  .warning-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.15);
    border: 1px solid rgba(var(--border-warning-color-rgb, 227, 179, 65), 0.3);
    padding: 16px;
    border-radius: 12px;

    .warning-icon {
      font-size: 1.5rem;
      color: var(--fg-warning-color);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .warning-content {
      display: flex;
      flex-direction: column;
      gap: 4px;

      strong {
        color: var(--fg-warning-color);
        font-size: 0.95rem;
      }

      p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
        line-height: 1.4;
      }
    }
  }
}

.sync-progress-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;

  .progress-status-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;

    .status-icon {
      font-size: 3rem;
      color: var(--fg-accent-color);

      &.spin-animation {
        animation: spin 1.5s linear infinite;
      }
    }

    &.is-success .status-icon {
      color: var(--fg-success-color);
    }

    &.is-error .status-icon {
      color: var(--fg-error-color);
    }

    .current-task {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      font-variant-numeric: tabular-nums;
    }
  }

  .progress-bars-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);
  }

  .progress-section {
    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.95rem;
      font-weight: 500;

      .label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--fg-primary-color);

        svg {
          color: var(--fg-secondary-color);
          font-size: 1.1rem;
        }
      }

      .value {
        color: var(--fg-secondary-color);
        font-variant-numeric: tabular-nums;
      }
    }

    .progress-bar {
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;

        &.pages-fill {
          background-color: var(--fg-accent-color);
        }

        &.sentences-fill {
          background-color: var(--fg-accent-color);
        }
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
