<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

type AutoAnalysisOptionKey
  = | 'autoAnalyzeSentences'
    | 'autoAnalyzeWords'
    | 'autoAnalyzeTtsSentences'
    | 'autoAnalyzeTtsWords'

interface AutoAnalysisOption {
  key: AutoAnalysisOptionKey
  icon: string
  title: string
}

const optionGroups = computed<AutoAnalysisOption[][]>(() => [
  [
    { key: 'autoAnalyzeSentences', icon: 'mdi:brain', title: t('bookInfo.deepAnalysis') },
    { key: 'autoAnalyzeWords', icon: 'mdi:format-text', title: t('bookInfo.analyzeWords') },
  ],
  [
    { key: 'autoAnalyzeTtsSentences', icon: 'mdi:headphones', title: t('bookInfo.cacheTtsSentences') },
    { key: 'autoAnalyzeTtsWords', icon: 'mdi:headphones', title: t('bookInfo.cacheTtsWords') },
  ],
])

function isOptionEnabled(key: AutoAnalysisOptionKey) {
  return settingsStore.autoAnalyzePage && settingsStore[key]
}

function toggleOption(key: AutoAnalysisOptionKey) {
  const wasEnabled = isOptionEnabled(key)

  settingsStore.autoAnalyzePage = true
  settingsStore[key] = !wasEnabled
}
</script>

<template>
  <div class="auto-analysis-options" :class="{ 'is-disabled': !settingsStore.autoAnalyzePage }">
    <div v-for="(group, groupIndex) in optionGroups" :key="groupIndex" class="options-group">
      <div
        v-for="option in group"
        :key="option.key"
        class="option-card"
        :class="{ 'is-active': isOptionEnabled(option.key) }"
        role="checkbox"
        :aria-checked="isOptionEnabled(option.key)"
        tabindex="0"
        @click="toggleOption(option.key)"
        @keydown.enter.self.prevent="toggleOption(option.key)"
        @keydown.space.self.prevent="toggleOption(option.key)"
      >
        <div class="option-content">
          <Icon :icon="option.icon" class="option-icon" />
          <div class="option-texts">
            <span class="option-title">{{ option.title }}</span>
          </div>
        </div>
        <KitCheckbox
          :model-value="isOptionEnabled(option.key)"
          @click.stop="toggleOption(option.key)"
          @update:model-value="toggleOption(option.key)"
        />
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
    opacity: 0.65;
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

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

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
