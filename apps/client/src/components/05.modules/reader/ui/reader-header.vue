<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitDropdown, KitSelect, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useReaderStore } from '../store/reader.store'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()

const pageAnalysisDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

const pageActionOpts = reactive({
  sentences: true,
  words: false,
  ttsSentences: false,
  ttsWords: false,
})

function startPageAnalysis() {
  pageAnalysisDropdownRef.value?.close()
  analysisStore.analyzeWholePage({
    sentences: pageActionOpts.sentences,
    words: pageActionOpts.words,
    ttsSentences: pageActionOpts.ttsSentences,
    ttsWords: pageActionOpts.ttsWords,
  }, false)
}

function goBack() {
  if (readerStore.currentBook?.id) {
    router.push(AppRoutePaths.Book.Info(readerStore.currentBook.id))
  }
  else {
    router.push(AppRoutePaths.Home)
  }
}

const currentThemeIcon = computed(() =>
  theme.value === ThemesVariant.Light ? 'mdi:weather-sunny' : 'mdi:weather-night',
)

function togglePriority() {
  settingsStore.translationPriority = settingsStore.translationPriority === 'dict' ? 'llm' : 'dict'
}

function cycleTtsSpeed() {
  const speeds = [0.75, 1, 1.25]
  const idx = speeds.indexOf(settingsStore.ttsSpeed)
  settingsStore.ttsSpeed = speeds[(idx + 1) % speeds.length]
}

function adjustFontSize(delta: number) {
  const newSize = settingsStore.readerFontSize + delta
  if (newSize >= 0.8 && newSize <= 3.0) {
    settingsStore.readerFontSize = Number(newSize.toFixed(1))
  }
}

function adjustLineHeight(delta: number) {
  const newHeight = settingsStore.readerLineHeight + delta
  if (newHeight >= 1.0 && newHeight <= 3.0) {
    settingsStore.readerLineHeight = Number(newHeight.toFixed(1))
  }
}

const fontOptions = computed(() => [
  { label: t('reader.fontDefault'), value: '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif' },
  { label: t('reader.fontSans'), value: 'system-ui, -apple-system, sans-serif' },
  { label: t('reader.fontSerif'), value: 'Georgia, \'Times New Roman\', serif' },
  { label: t('reader.fontCursive'), value: '\'Comic Sans MS\', cursive, sans-serif' },
])
</script>

<template>
  <header class="reader-header">
    <KitTooltip :text="t('reader.goBack')" placement="bottom">
      <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    </KitTooltip>

    <span class="book-title">{{ readerStore.currentBook?.title }}</span>

    <div class="spacer" />

    <KitTooltip
      v-if="readerStore.currentBook?.type !== 'manga'"
      :text="t('reader.parallelReading')"
      placement="bottom"
      class="desktop-only"
    >
      <KitBtn
        icon="mdi:view-split-vertical"
        variant="text"
        size="sm"
        :class="{ 'is-active-btn': readerStore.isParallelView }"
        @click="readerStore.isParallelView = !readerStore.isParallelView"
      />
    </KitTooltip>

    <KitDropdown ref="pageAnalysisDropdownRef" placement="bottom-end" width="260px" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitTooltip :text="t('reader.analyzePage')" placement="bottom">
          <div class="analyze-btn-wrapper" @click.stop="analysisStore.isManualPageAnalysisActive ? analysisStore.isPageAnalysisModalOpen = true : dropdownProps.toggle()">
            <KitBtn
              icon="mdi:text-box-search-outline"
              variant="text"
              size="sm"
              :class="{ 'is-active-btn': dropdownProps.isOpen || analysisStore.isManualPageAnalysisActive }"
            />
            <span v-if="analysisStore.isManualPageAnalysisActive" class="blinking-dot" />
          </div>
        </KitTooltip>
      </template>

      <div class="menu-content">
        <div class="menu-section">
          <div class="section-title">
            {{ t('reader.selectOptions') }}
          </div>

          <div class="settings-group">
            <div style="font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
              <Icon icon="mdi:robot-outline" class="item-icon" /> {{ t('reader.textAnalysis') }}
            </div>
            <KitCheckbox v-model="pageActionOpts.sentences" :label="t('bookInfo.sentences')" />
            <KitCheckbox v-model="pageActionOpts.words" :label="t('analysis.words')" />
          </div>

          <div class="divider" />

          <div class="settings-group">
            <div style="font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
              <Icon icon="mdi:headphones" class="item-icon" /> {{ t('reader.voiceTts') }}
            </div>
            <KitCheckbox v-model="pageActionOpts.ttsSentences" :label="t('bookInfo.sentences')" />
            <KitCheckbox v-model="pageActionOpts.ttsWords" :label="t('analysis.words')" />
          </div>

          <KitBtn style="width: 100%; margin-top: 8px;" color="primary" @click="startPageAnalysis">
            {{ t('reader.startAnalysis') }}
          </KitBtn>
        </div>
      </div>
    </KitDropdown>

    <KitTooltip :text="t('bookInfo.tableOfContents')" placement="bottom-end">
      <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="readerStore.tocOpen = true" />
    </KitTooltip>

    <KitDropdown placement="left" :width="340" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitBtn
          icon="mdi:cog-outline"
          variant="text"
          size="sm"
          :title="t('settings.title')"
          :class="{ 'is-active-btn': dropdownProps?.isOpen }"
        />
      </template>

      <div class="menu-content">
        <div class="menu-section">
          <div class="section-title">
            {{ t('settings.interfaceTitle') }}
          </div>
          <div class="menu-item" @click="toggleTheme">
            <div class="item-label">
              <Icon :icon="currentThemeIcon" class="item-icon" />
              <span>{{ t('reader.appearance') }}</span>
            </div>
            <span class="value-text">{{ theme === 'light' ? t('reader.light') : t('reader.dark') }}</span>
          </div>
        </div>

        <div class="divider" />

        <div class="menu-section">
          <div class="section-title">
            {{ t('reader.translationAndVoice') }}
          </div>
          <div class="menu-item" @click="togglePriority">
            <div class="item-label">
              <Icon icon="mdi:translate" class="item-icon" />
              <span>{{ t('reader.translationPriority') }}</span>
            </div>
            <span class="value-text">{{ settingsStore.translationPriority === 'dict' ? t('reader.dictionary') : t('reader.neuralNetwork') }}</span>
          </div>
          <div class="menu-item" @click="cycleTtsSpeed">
            <div class="item-label">
              <Icon icon="mdi:play-speed" class="item-icon" />
              <span>{{ t('reader.voiceSpeed') }}</span>
            </div>
            <span class="value-text">{{ settingsStore.ttsSpeed }}x</span>
          </div>

          <div class="menu-item" @click="settingsStore.autoAnalyzePage = !settingsStore.autoAnalyzePage">
            <div class="item-label">
              <Icon icon="mdi:robot-outline" class="item-icon" />
              <span>{{ t('settings.autoAnalyzePage') }}</span>
            </div>
            <KitCheckbox v-model="settingsStore.autoAnalyzePage" style="pointer-events: none;" />
          </div>
        </div>

        <div v-if="readerStore.currentBook?.type !== 'manga'" class="divider" />

        <div v-if="readerStore.currentBook?.type === 'manga'" class="menu-section">
          <div class="section-title">
            {{ t('reader.textDisplayManga') }}
          </div>
          <div class="menu-item" @click="settingsStore.mangaOcrDisplayMode = settingsStore.mangaOcrDisplayMode === 'hover' ? 'popover' : 'hover'">
            <div class="item-label">
              <Icon icon="mdi:message-text-outline" class="item-icon" />
              <span>{{ t('reader.translationMode') }}</span>
            </div>
            <span class="value-text">{{ settingsStore.mangaOcrDisplayMode === 'hover' ? t('reader.hover') : t('reader.popover') }}</span>
          </div>
        </div>

        <div v-if="readerStore.currentBook?.type !== 'manga'" class="menu-section">
          <div class="section-title">
            {{ t('reader.textDisplay') }}
          </div>

          <div class="typography-controls">
            <div class="typography-row">
              <span class="typography-label">{{ t('reader.size') }}</span>
              <div class="typography-stepper">
                <KitBtn icon="mdi:minus" size="xs" variant="outlined" color="secondary" @click="adjustFontSize(-0.1)" />
                <span class="stepper-value">{{ settingsStore.readerFontSize.toFixed(1) }}rem</span>
                <KitBtn icon="mdi:plus" size="xs" variant="outlined" color="secondary" @click="adjustFontSize(0.1)" />
              </div>
            </div>

            <div class="typography-row">
              <span class="typography-label">{{ t('reader.lineHeight') }}</span>
              <div class="typography-stepper">
                <KitBtn icon="mdi:minus" size="xs" variant="outlined" color="secondary" @click="adjustLineHeight(-0.1)" />
                <span class="stepper-value">{{ settingsStore.readerLineHeight.toFixed(1) }}</span>
                <KitBtn icon="mdi:plus" size="xs" variant="outlined" color="secondary" @click="adjustLineHeight(0.1)" />
              </div>
            </div>

            <div class="typography-row font-row">
              <span class="typography-label">{{ t('reader.font') }}</span>
              <KitSelect v-model="settingsStore.readerFontFamily" :options="fontOptions" size="sm" class="font-select" />
            </div>
          </div>
        </div>

        <div class="divider" />
      </div>
    </KitDropdown>
  </header>
</template>

<style lang="scss" scoped>
.reader-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 8px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;

  .book-title {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--fg-secondary-color);
    flex-shrink: 1;
    min-width: 0;
    margin-left: 8px;
  }

  .spacer {
    flex-grow: 1;
  }

  .is-active-btn {
    color: var(--fg-accent-color) !important;
  }
}

.analyze-btn-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.blinking-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background-color: var(--fg-accent-color);
  border-radius: 50%;
  box-shadow: 0 0 4px var(--fg-accent-color);
  animation: pulse-dot 1.5s infinite;
  pointer-events: none;
}

@keyframes pulse-dot {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.desktop-only {
  @include media-down(md) {
    display: none !important;
  }
}

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
  height: 21px;
}

.item-icon {
  font-size: 1.2rem;
  color: var(--fg-secondary-color);
  transition: color 0.2s;
}

.value-text {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  display: flex;
  height: 21px;
  align-items: center;
}

.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 0 4px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;

  :deep(.kit-checkbox) {
    .checkbox-box {
      margin-left: 2px;
    }

    .checkbox-label {
      margin-left: 6px;
      font-weight: 500;
    }
  }
}

.typography-controls {
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  :deep(.kit-select-trigger) {
    background-color: transparent;
    border: none;
    padding: 0;
  }

  .typography-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &.font-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;

      .kit-select-trigger {
        background-color: var(--bg-tertiary-color) !important;
        padding: 0;

        &:hover {
          border-color: transparent !important;
        }

        &.is-open {
          border-color: transparent !important;
        }
      }
    }
  }

  .typography-label {
    font-size: 0.9rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .typography-stepper {
    display: flex;
    align-items: center;
    gap: 8px;

    .stepper-value {
      font-size: 0.85rem;
      width: 44px;
      text-align: center;
      color: var(--fg-secondary-color);
    }
  }

  .font-select {
    width: 100%;
  }
}
</style>
