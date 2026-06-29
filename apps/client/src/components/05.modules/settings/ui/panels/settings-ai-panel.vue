<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useCustomModels } from '../../composables/use-custom-models'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const authStore = useAuthStore()
const { availableModels, isFetchingModels, fetchModels } = useCustomModels()
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.aiTitle') }}
  </h2>
  <div class="settings-card llm-card">
    <template v-if="authStore.isSingleMode">
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
              <div style="display: flex; gap: 8px; align-items: center;">
                <KitSelect
                  v-if="availableModels.length > 0"
                  v-model="settingsStore.customLlmModel"
                  :options="availableModels"
                  style="flex: 1; min-width: 0;"
                />
                <KitInput
                  v-else
                  v-model="settingsStore.customLlmModel"
                  placeholder="llama3, qwen2..."
                  style="flex: 1; min-width: 0;"
                />
                <KitTooltip text="Загрузить список моделей" placement="top">
                  <KitBtn
                    variant="outlined"
                    color="secondary"
                    :icon="isFetchingModels ? 'mdi:loading' : 'mdi:refresh'"
                    :class="{ 'spin-animation': isFetchingModels }"
                    :disabled="isFetchingModels"
                    style="padding: 0; width: 38px; height: 38px; flex-shrink: 0;"
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
    </template>

    <div class="llm-toggle">
      <KitCheckbox v-model="settingsStore.autoAnalyzePage" :label="t('settings.autoAnalyzePage')" />
    </div>

    <Transition name="fade">
      <div v-if="settingsStore.autoAnalyzePage" class="custom-llm-form">
        <div class="sync-options">
          <div class="sync-option-group">
            <div class="sync-option-half" :class="{ 'is-active': settingsStore.autoAnalyzeSentences }" @click="settingsStore.autoAnalyzeSentences = !settingsStore.autoAnalyzeSentences">
              <div class="option-content">
                <Icon icon="mdi:brain" class="option-icon" />
                <div class="option-texts">
                  <span class="option-title">{{ t('bookInfo.deepAnalysis') }}</span>
                </div>
              </div>
              <KitCheckbox :model-value="settingsStore.autoAnalyzeSentences" style="pointer-events: none;" />
            </div>

            <div class="sync-option-half" :class="{ 'is-active': settingsStore.autoAnalyzeWords }" @click="settingsStore.autoAnalyzeWords = !settingsStore.autoAnalyzeWords">
              <div class="option-content">
                <Icon icon="mdi:format-text" class="option-icon" />
                <div class="option-texts">
                  <span class="option-title">{{ t('bookInfo.analyzeWords') }}</span>
                </div>
              </div>
              <KitCheckbox :model-value="settingsStore.autoAnalyzeWords" style="pointer-events: none;" />
            </div>
          </div>

          <div class="sync-option-group">
            <div class="sync-option-half" :class="{ 'is-active': settingsStore.autoAnalyzeTtsSentences }" @click="settingsStore.autoAnalyzeTtsSentences = !settingsStore.autoAnalyzeTtsSentences">
              <div class="option-content">
                <Icon icon="mdi:headphones" class="option-icon" />
                <div class="option-texts">
                  <span class="option-title">{{ t('bookInfo.cacheTtsSentences') }}</span>
                </div>
              </div>
              <KitCheckbox :model-value="settingsStore.autoAnalyzeTtsSentences" style="pointer-events: none;" />
            </div>

            <div class="sync-option-half" :class="{ 'is-active': settingsStore.autoAnalyzeTtsWords }" @click="settingsStore.autoAnalyzeTtsWords = !settingsStore.autoAnalyzeTtsWords">
              <div class="option-content">
                <Icon icon="mdi:headphones" class="option-icon" />
                <div class="option-texts">
                  <span class="option-title">{{ t('bookInfo.cacheTtsWords') }}</span>
                </div>
              </div>
              <KitCheckbox :model-value="settingsStore.autoAnalyzeTtsWords" style="pointer-events: none;" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}
.llm-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  .custom-llm-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
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
.sync-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sync-option-group {
  display: flex;
  gap: 12px;
  @include media-down(sm) {
    flex-direction: column;
  }
}
.sync-option-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-primary-color);
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

    .option-icon {
      color: var(--fg-accent-color);
    }
  }

  .option-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .option-icon {
    font-size: 1.6rem;
    color: var(--fg-secondary-color);
    transition: color 0.2s ease;
  }

  .option-texts {
    display: flex;
    flex-direction: column;

    .option-title {
      font-weight: 500;
      font-size: 0.95rem;
      color: var(--fg-primary-color);
    }
  }
}
.sync-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-primary-color);
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
</style>
