<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useAuthStore } from '~/shared/store/auth.store'
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

    <KitCheckbox v-model="settingsStore.autoAnalyzePage" :label="t('settings.autoAnalyzePage')" />
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
</style>
