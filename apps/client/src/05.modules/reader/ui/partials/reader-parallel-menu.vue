<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn, KitCheckbox } from '~/02.kit'
import { useReaderStore } from '../../store/reader.store'

const emit = defineEmits<{
  startAnalysis: []
}>()

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

function startParallelAnalysis() {
  analysisStore.analyzeWholePage({
    sentences: true,
    words: false,
    ttsSentences: false,
    ttsWords: false,
  }, false)
  emit('startAnalysis')
}
</script>

<template>
  <div class="menu-content">
    <div class="menu-section">
      <div class="section-title">
        {{ t('reader.parallelReading') }}
      </div>

      <div class="menu-item" @click="settingsStore.parallelViewMode = 'none'">
        <div class="item-label">
          <Icon icon="mdi:cancel" class="item-icon" />
          <span>{{ t('reader.parallelReadingOff') }}</span>
        </div>
        <Icon v-if="settingsStore.parallelViewMode === 'none'" icon="mdi:check" class="check-icon" />
      </div>

      <div class="menu-item" :class="{ 'desktop-only': readerStore.currentBook?.type !== 'manga' }" @click="settingsStore.parallelViewMode = 'split'">
        <div class="item-label">
          <Icon icon="mdi:view-split-vertical" class="item-icon" />
          <span>{{ t('reader.parallelReadingSplit') }}</span>
        </div>
        <Icon v-if="settingsStore.parallelViewMode === 'split' || (readerStore.currentBook?.type === 'manga' && settingsStore.parallelViewMode !== 'none')" icon="mdi:check" class="check-icon" />
      </div>

      <div v-if="readerStore.currentBook?.type !== 'manga'" class="menu-item" @click="settingsStore.parallelViewMode = 'interleaved'">
        <div class="item-label">
          <Icon icon="mdi:format-list-text" class="item-icon" />
          <span>{{ t('reader.parallelReadingInterleaved') }}</span>
        </div>
        <Icon v-if="settingsStore.parallelViewMode === 'interleaved'" icon="mdi:check" class="check-icon" />
      </div>
    </div>

    <div v-if="settingsStore.parallelViewMode !== 'none'" class="divider" />

    <div v-if="settingsStore.parallelViewMode !== 'none'" class="menu-section">
      <div class="menu-item" @click="settingsStore.parallelBlurTranslation = !settingsStore.parallelBlurTranslation">
        <div class="item-label">
          <Icon icon="mdi:blur" class="item-icon" />
          <span>{{ t('reader.parallelReadingBlur') }}</span>
        </div>
        <KitCheckbox :model-value="settingsStore.parallelBlurTranslation" class="readonly-checkbox" />
      </div>
      <div class="menu-item" @click="settingsStore.parallelShowGrammar = !settingsStore.parallelShowGrammar">
        <div class="item-label">
          <Icon icon="mdi:book-open-page-variant-outline" class="item-icon" />
          <span>{{ t('reader.parallelReadingShowGrammar') }}</span>
        </div>
        <KitCheckbox :model-value="settingsStore.parallelShowGrammar" class="readonly-checkbox" />
      </div>
    </div>

    <template v-if="settingsStore.parallelViewMode === 'interleaved'">
      <div class="divider" />

      <div class="menu-section">
        <div class="hint-text">
          {{ t('reader.parallelReadingHint', 'Для отображения текста необходимо перевести все предложения на странице.') }}
        </div>
        <KitBtn
          color="primary"
          class="action-btn"
          :disabled="analysisStore.isManualPageAnalysisActive"
          @click="startParallelAnalysis"
        >
          <Icon icon="mdi:translate" class="btn-icon" />
          {{ analysisStore.isManualPageAnalysisActive ? t('reader.translatingPage', 'Перевод...') : t('reader.translatePage', 'Перевести страницу') }}
        </KitBtn>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.menu-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--fg-muted-color);
  font-weight: 600;
  padding: 4px 8px;
  letter-spacing: 0.5px;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;

  &:hover {
    background-color: var(--bg-hover-color);

    .item-icon {
      color: var(--fg-accent-color);
    }
  }
}

.item-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
  font-weight: 500;
}

.item-icon {
  font-size: 1.2rem;
  color: var(--fg-secondary-color);
  transition: color 0.2s;
}

.check-icon {
  font-size: 1.2rem;
  color: var(--fg-accent-color);
}

.divider {
  height: 1px;
  background-color: var(--border-primary-color);
  margin: 0 4px;
}

.readonly-checkbox {
  pointer-events: none;
}

.hint-text {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  padding: 4px 8px;
  line-height: 1.3;
}

.action-btn {
  margin: 4px 8px 8px 8px;

  :deep(.btn-icon) {
    margin-right: 6px;
  }
}

.desktop-only {
  @include media-down(md) {
    display: none !important;
  }
}
</style>
