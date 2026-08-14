<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import AutoAnalysisOptions from '~/04.features/analysis/ui/auto-analysis-options.vue'
import { useCustomModels } from '../../composables/use-custom-models'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const authStore = useAuthStore()
const networkStore = useNetworkStore()
const toast = useToast()
const { availableModels, isFetchingModels, fetchModels } = useCustomModels()

function toggleAutoAnalyzePage() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  settingsStore.autoAnalyzePage = !settingsStore.autoAnalyzePage
}
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

    <div class="llm-toggle" :class="{ 'is-disabled': networkStore.effectiveOffline }" @click="toggleAutoAnalyzePage">
      <KitCheckbox :model-value="settingsStore.autoAnalyzePage" :label="t('settings.autoAnalyzePage')" style="pointer-events: none;" />
    </div>

    <div class="custom-llm-form" :class="{ 'is-disabled': !settingsStore.autoAnalyzePage }">
      <p class="hint" v-html="t('settings.autoAnalyzePageDesc')" />
      <AutoAnalysisOptions />
    </div>
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
  .llm-toggle.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .custom-llm-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
    transition:
      opacity 0.25s ease,
      filter 0.25s ease;

    &.is-disabled {
      opacity: 0.45;
      pointer-events: none;
      filter: grayscale(0.3);
    }
  }
  .hint {
    margin: 0 0 4px 0;
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
