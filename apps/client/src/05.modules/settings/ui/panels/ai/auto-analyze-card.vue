<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import AutoAnalysisOptions from '~/04.features/analysis/ui/auto-analysis-options.vue'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const networkStore = useNetworkStore()
const toast = useToast()

function toggleAutoAnalyzePage() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  settingsStore.autoAnalyzePage = !settingsStore.autoAnalyzePage
}
</script>

<template>
  <div class="settings-card auto-analyze-card">
    <div class="card-header">
      <Icon icon="mdi:auto-fix" class="card-icon" />
      <div class="header-text">
        <h3 class="card-title">
          {{ t('settings.autoAnalyzeTitle', 'Фоновый анализ текста') }}
        </h3>
        <p class="card-subtitle">
          {{ t('settings.autoAnalyzeSubtitle', 'Автоматическая подготовка перевода и разбора страниц') }}
        </p>
      </div>
    </div>

    <div
      class="llm-toggle"
      :class="{ 'is-disabled': networkStore.effectiveOffline }"
      @click="toggleAutoAnalyzePage"
    >
      <KitCheckbox
        :model-value="settingsStore.autoAnalyzePage"
        :label="t('settings.autoAnalyzePage')"
        style="pointer-events: none;"
      />
    </div>

    <div class="analysis-options-wrap" :class="{ 'is-disabled': !settingsStore.autoAnalyzePage }">
      <p class="hint" v-html="t('settings.autoAnalyzePageDesc')" />
      <AutoAnalysisOptions />
    </div>
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

.llm-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.analysis-options-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-secondary-color);
  transition:
    opacity 0.25s ease,
    filter 0.25s ease;

  &.is-disabled {
    opacity: 0.45;
    filter: grayscale(0.3);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;

    :deep(b) {
      color: var(--fg-primary-color);
    }
  }
}
</style>
