<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
</script>

<template>
  <div class="auto-analysis-options" :class="{ 'is-disabled': !settingsStore.autoAnalyzePage }">
    <div class="options-group">
      <div
        class="option-card"
        :class="{ 'is-active': settingsStore.autoAnalyzeSentences && settingsStore.autoAnalyzePage }"
        @click="settingsStore.autoAnalyzePage && (settingsStore.autoAnalyzeSentences = !settingsStore.autoAnalyzeSentences)"
      >
        <div class="option-content">
          <Icon icon="mdi:brain" class="option-icon" />
          <div class="option-texts">
            <span class="option-title">{{ t('bookInfo.deepAnalysis') }}</span>
          </div>
        </div>
        <KitCheckbox :model-value="settingsStore.autoAnalyzeSentences && settingsStore.autoAnalyzePage" style="pointer-events: none;" />
      </div>

      <div
        class="option-card"
        :class="{ 'is-active': settingsStore.autoAnalyzeWords && settingsStore.autoAnalyzePage }"
        @click="settingsStore.autoAnalyzePage && (settingsStore.autoAnalyzeWords = !settingsStore.autoAnalyzeWords)"
      >
        <div class="option-content">
          <Icon icon="mdi:format-text" class="option-icon" />
          <div class="option-texts">
            <span class="option-title">{{ t('bookInfo.analyzeWords') }}</span>
          </div>
        </div>
        <KitCheckbox :model-value="settingsStore.autoAnalyzeWords && settingsStore.autoAnalyzePage" style="pointer-events: none;" />
      </div>
    </div>

    <div class="options-group">
      <div
        class="option-card"
        :class="{ 'is-active': settingsStore.autoAnalyzeTtsSentences && settingsStore.autoAnalyzePage }"
        @click="settingsStore.autoAnalyzePage && (settingsStore.autoAnalyzeTtsSentences = !settingsStore.autoAnalyzeTtsSentences)"
      >
        <div class="option-content">
          <Icon icon="mdi:headphones" class="option-icon" />
          <div class="option-texts">
            <span class="option-title">{{ t('bookInfo.cacheTtsSentences') }}</span>
          </div>
        </div>
        <KitCheckbox :model-value="settingsStore.autoAnalyzeTtsSentences && settingsStore.autoAnalyzePage" style="pointer-events: none;" />
      </div>

      <div
        class="option-card"
        :class="{ 'is-active': settingsStore.autoAnalyzeTtsWords && settingsStore.autoAnalyzePage }"
        @click="settingsStore.autoAnalyzePage && (settingsStore.autoAnalyzeTtsWords = !settingsStore.autoAnalyzeTtsWords)"
      >
        <div class="option-content">
          <Icon icon="mdi:headphones" class="option-icon" />
          <div class="option-texts">
            <span class="option-title">{{ t('bookInfo.cacheTtsWords') }}</span>
          </div>
        </div>
        <KitCheckbox :model-value="settingsStore.autoAnalyzeTtsWords && settingsStore.autoAnalyzePage" style="pointer-events: none;" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auto-analysis-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition:
    opacity 0.25s ease,
    filter 0.25s ease;

  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
    filter: grayscale(0.3);
  }
}

.options-group {
  display: flex;
  gap: 12px;

  @include media-down(sm) {
    flex-direction: column;
  }
}

.option-card {
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
</style>
