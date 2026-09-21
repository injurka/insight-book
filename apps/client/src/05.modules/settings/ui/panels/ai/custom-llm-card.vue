<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { useCustomModels } from '../../../composables/use-custom-models'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const authStore = useAuthStore()
const { availableModels, isFetchingModels, fetchModels } = useCustomModels()
</script>

<template>
  <div v-if="authStore.isSingleMode" class="settings-card custom-llm-card">
    <div class="card-header">
      <Icon icon="mdi:robot-confused-outline" class="card-icon" />
      <div class="header-text">
        <h3 class="card-title">
          {{ t('settings.customLlmTitle', 'Пользовательская LLM') }}
        </h3>
        <p class="card-subtitle">
          {{ t('settings.customLlmSubtitle', 'Подключение локальных моделей или сторонних API') }}
        </p>
      </div>
    </div>

    <div class="llm-toggle">
      <KitCheckbox v-model="settingsStore.useCustomLlm" :label="t('settings.useCustomLlm')" />
    </div>

    <Transition name="fade">
      <div v-if="settingsStore.useCustomLlm" class="custom-llm-form">
        <p class="hint" v-html="t('settings.customLlmHint')" />

        <div class="form-row">
          <div class="form-group flex-2">
            <label>{{ t('settings.apiUrl') }}</label>
            <KitInput v-model="settingsStore.customLlmUrl" placeholder="http://localhost:11434/v1" />
          </div>

          <div class="form-group flex-1">
            <label>{{ t('settings.modelName') }}</label>
            <div class="model-input-group">
              <KitSelect
                v-if="availableModels.length > 0"
                v-model="settingsStore.customLlmModel"
                :options="availableModels"
                class="model-select"
              />
              <KitInput
                v-else
                v-model="settingsStore.customLlmModel"
                placeholder="llama3, qwen2..."
                class="model-input"
              />
              <KitTooltip :text="t('settings.fetchModelsTooltip', 'Загрузить список моделей')" placement="top">
                <KitBtn
                  variant="outlined"
                  color="secondary"
                  :icon="isFetchingModels ? 'mdi:loading' : 'mdi:refresh'"
                  :class="{ 'spin-animation': isFetchingModels }"
                  :disabled="isFetchingModels"
                  class="fetch-btn"
                  @click="fetchModels"
                />
              </KitTooltip>
            </div>
          </div>

          <div class="form-group flex-1">
            <label>{{ t('settings.apiKey') }}</label>
            <KitInput v-model="settingsStore.customLlmKey" placeholder="Любой ключ" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 14px;
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .card-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .card-title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .card-subtitle {
      margin: 0;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
}

.custom-llm-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-secondary-color);
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;

  :deep(code) {
    background: var(--bg-tertiary-color);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--fg-accent-color);
  }
}

.form-row {
  display: flex;
  gap: 16px;

  @include media-down(sm) {
    flex-direction: column;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }

  &.flex-2 {
    flex: 2;
  }

  &.flex-1 {
    flex: 1;
  }
}

.model-input-group {
  display: flex;
  gap: 8px;
  align-items: center;

  .model-select,
  .model-input {
    flex: 1;
    min-width: 0;
  }

  .fetch-btn {
    padding: 0;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
  }
}

.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
