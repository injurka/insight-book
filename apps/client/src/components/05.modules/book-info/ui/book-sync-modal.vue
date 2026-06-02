<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KitBtn, KitCheckbox, KitDialog } from '~/components/01.kit'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'

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
      <p>Выберите, что нужно загрузить для работы в оффлайн-режиме:</p>

      <div class="checkbox-group">
        <KitCheckbox v-model="options.cachePages" label="Кэшировать страницы (Текст и изображения)" />
        <KitCheckbox v-model="options.analyzeSentences" label="Глубокий анализ (LLM перевод всех предложений)" />
      </div>

      <p v-if="options.analyzeSentences" class="warning-text">
        Внимание: процесс может занять много времени и активно расходовать лимиты API.
        Рекомендуется использовать этот режим только с локальными LLM (например, Ollama).
      </p>
    </div>

    <div v-if="isRunning || isFinished || hasError" class="sync-progress-view">
      <p class="current-task">
        {{ libraryStore.syncProgress.currentTask }}
      </p>

      <div v-if="options.cachePages" class="progress-section">
        <div class="progress-info">
          <span>Страницы</span>
          <span>{{ libraryStore.syncProgress.pagesDone }} / {{ libraryStore.syncProgress.pagesTotal }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${libraryStore.syncProgress.pagesTotal > 0 ? (libraryStore.syncProgress.pagesDone / libraryStore.syncProgress.pagesTotal) * 100 : 0}%` }"
          />
        </div>
      </div>

      <div v-if="options.analyzeSentences && libraryStore.syncProgress.sentencesTotal > 0" class="progress-section">
        <div class="progress-info">
          <span>Предложения</span>
          <span>{{ libraryStore.syncProgress.sentencesDone }} / {{ libraryStore.syncProgress.sentencesTotal }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${(libraryStore.syncProgress.sentencesDone / libraryStore.syncProgress.sentencesTotal) * 100}%` }"
          />
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
  gap: 16px;

  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-secondary-color);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);

    :deep(.kit-checkbox) {
      .checkbox-label {
        font-weight: 500;
      }
    }
  }

  .warning-text {
    font-size: 0.85rem;
    color: var(--fg-warning-color);
    background: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.1);
    padding: 12px;
    border-radius: 8px;
    line-height: 1.4;
  }
}

.sync-progress-view {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .current-task {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    text-align: center;
  }

  .progress-section {
    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }

    .progress-bar {
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        transition: width 0.3s ease;
      }
    }
  }
}
</style>
