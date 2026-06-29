<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useFullscreen } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitDropdown, KitSelect, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { useTts } from '~/shared/composables/use-tts'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useReaderStore } from '../store/reader.store'

const props = withDefaults(defineProps<{
  isVisible?: boolean
}>(), {
  isVisible: true,
})

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()
const { speak, stop, isPlaying, isLoading } = useTts()

const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const pageAnalysisDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)
const parallelDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)
const settingsDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

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

function startParallelAnalysis() {
  parallelDropdownRef.value?.close()
  analysisStore.analyzeWholePage({
    sentences: true,
    words: false,
    ttsSentences: false,
    ttsWords: false,
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

function togglePriority() {
  settingsStore.translationPriority = settingsStore.translationPriority === 'dict' ? 'llm' : 'dict'
}

function cycleTtsSpeed() {
  const speeds = [0.75, 1, 1.25, 1.5]
  const idx = speeds.indexOf(settingsStore.ttsSpeed)
  settingsStore.ttsSpeed = speeds[(idx + 1) % speeds.length] || 1
}

function previewVoice() {
  if (isPlaying.value || isLoading.value) {
    stop()
  }
  else {
    speak(t('settings.previewVoiceText'), settingsStore.appLanguage || 'en')
  }
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

const voiceOptions = computed(() => [
  { label: 'Kore (Female)', value: 'Kore' },
  { label: 'Callirrhoe (Female)', value: 'Callirrhoe' },
  { label: 'Leda (Female)', value: 'Leda' },
  { label: 'Orus (Male)', value: 'Orus' },
  { label: 'Puck (Male)', value: 'Puck' },
  { label: 'Charon (Male)', value: 'Charon' },
  { label: 'Fenrir (Male)', value: 'Fenrir' },
])

const currentThemeIcon = computed(() => {
  switch (theme.value) {
    case ThemesVariant.Light: return 'mdi:weather-sunny'
    case ThemesVariant.Dark: return 'mdi:weather-night'
    case ThemesVariant.Sepia: return 'mdi:book-open-page-variant'
    case ThemesVariant.Green: return 'mdi:leaf'
    case ThemesVariant.Oled: return 'mdi:moon-waning-crescent'
    default: return 'mdi:weather-sunny'
  }
})

const currentThemeName = computed(() => {
  switch (theme.value) {
    case ThemesVariant.Light: return t('reader.light')
    case ThemesVariant.Dark: return t('reader.dark')
    case ThemesVariant.Sepia: return t('reader.sepia')
    case ThemesVariant.Green: return t('reader.green')
    case ThemesVariant.Oled: return t('reader.oled')
    default: return t('reader.light')
  }
})

watch(() => props.isVisible, (visible) => {
  if (!visible) {
    pageAnalysisDropdownRef.value?.close()
    settingsDropdownRef.value?.close()
    parallelDropdownRef.value?.close()
  }
})
</script>

<template>
  <header class="reader-header" :class="{ 'is-hidden': !isVisible }">
    <KitTooltip :text="t('reader.goBack')" placement="bottom">
      <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    </KitTooltip>

    <span class="book-title">{{ readerStore.currentBook?.title }}</span>

    <div class="spacer" />

    <KitDropdown ref="parallelDropdownRef" placement="bottom-end" width="300px" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitTooltip :text="t('reader.parallelReading')" placement="bottom">
          <KitBtn
            icon="mdi:view-split-vertical"
            variant="text"
            size="sm"
            :class="{ 'is-active-btn': settingsStore.parallelViewMode !== 'none' || dropdownProps?.isOpen }"
          />
        </KitTooltip>
      </template>

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
            <KitCheckbox :model-value="settingsStore.parallelBlurTranslation" style="pointer-events: none;" />
          </div>
        </div>

        <div v-if="settingsStore.parallelViewMode !== 'none'" class="divider" />

        <div v-if="settingsStore.parallelViewMode !== 'none'" class="menu-section">
          <div style="font-size: 0.8rem; color: var(--fg-secondary-color); padding: 4px 8px; line-height: 1.3;">
            {{ t('reader.parallelReadingHint') }}
          </div>
          <KitBtn
            color="primary"
            style="margin: 4px 8px 8px 8px;"
            :disabled="analysisStore.isManualPageAnalysisActive"
            @click="startParallelAnalysis"
          >
            <Icon icon="mdi:translate" style="margin-right: 6px;" />
            {{ analysisStore.isManualPageAnalysisActive ? t('reader.translatingPage') : t('reader.translateWholePage') }}
          </KitBtn>
        </div>
      </div>
    </KitDropdown>

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

    <KitDropdown ref="settingsDropdownRef" placement="bottom-end" :width="330" :close-on-content-click="false">
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
          <div class="menu-item" @click="toggleFullscreen">
            <div class="item-label">
              <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" class="item-icon" />
              <span>{{ t('reader.fullscreen') }}</span>
            </div>
            <KitCheckbox :model-value="isFullscreen" style="pointer-events: none;" />
          </div>
          <div class="menu-item" @click="toggleTheme">
            <div class="item-label">
              <Icon :icon="currentThemeIcon" class="item-icon" />
              <span>{{ t('reader.appearance') }}</span>
            </div>
            <span class="value-badge">{{ currentThemeName }}</span>
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
            <span class="value-badge">{{ settingsStore.translationPriority === 'dict' ? t('reader.dictionary') : t('reader.neuralNetwork') }}</span>
          </div>

          <div class="settings-row">
            <div class="item-label">
              <Icon icon="mdi:account" class="item-icon" />
              <span>{{ t('reader.voice') }}</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <KitSelect v-model="settingsStore.ttsVoice" :options="voiceOptions" size="xs" class="font-select" />
              <KitBtn
                :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:stop' : 'mdi:play')"
                :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
                variant="tonal"
                color="secondary"
                size="xs"
                style="min-height: 30px; width: 30px; padding: 0;"
                @click="previewVoice"
              />
            </div>
          </div>

          <div class="menu-item" @click="cycleTtsSpeed">
            <div class="item-label">
              <Icon icon="mdi:play-speed" class="item-icon" />
              <span>{{ t('reader.voiceSpeed') }}</span>
            </div>
            <span class="value-badge">{{ settingsStore.ttsSpeed }}x</span>
          </div>

          <div class="menu-item" @click="settingsStore.autoAnalyzePage = !settingsStore.autoAnalyzePage">
            <div class="item-label">
              <Icon icon="mdi:robot-outline" class="item-icon" />
              <span>{{ t('settings.autoAnalyzePage') }}</span>
            </div>
            <KitCheckbox v-model="settingsStore.autoAnalyzePage" style="pointer-events: none;" />
          </div>

          <div class="menu-item" @click="settingsStore.highlightSavedQuotes = !settingsStore.highlightSavedQuotes">
            <div class="item-label">
              <Icon icon="mdi:format-color-highlight" class="item-icon" />
              <span>{{ t('settings.highlightSavedQuotes') }}</span>
            </div>
            <KitCheckbox v-model="settingsStore.highlightSavedQuotes" style="pointer-events: none;" />
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
            <span class="value-badge">{{ settingsStore.mangaOcrDisplayMode === 'hover' ? t('reader.hover') : t('reader.popover') }}</span>
          </div>
        </div>

        <div v-if="readerStore.currentBook?.type !== 'manga'" class="menu-section">
          <div class="section-title">
            {{ t('reader.textDisplay') }}
          </div>

          <div class="settings-row">
            <div class="item-label">
              <Icon icon="mdi:format-size" class="item-icon" />
              <span>{{ t('reader.size') }}</span>
            </div>
            <div class="control-pill stepper-pill">
              <button class="stepper-btn" @click="adjustFontSize(-0.1)">
                <Icon icon="mdi:minus" />
              </button>
              <span class="stepper-value">{{ settingsStore.readerFontSize.toFixed(1) }}rem</span>
              <button class="stepper-btn" @click="adjustFontSize(0.1)">
                <Icon icon="mdi:plus" />
              </button>
            </div>
          </div>

          <div class="settings-row">
            <div class="item-label">
              <Icon icon="mdi:format-line-spacing" class="item-icon" />
              <span>{{ t('reader.lineHeight') }}</span>
            </div>
            <div class="control-pill stepper-pill">
              <button class="stepper-btn" @click="adjustLineHeight(-0.1)">
                <Icon icon="mdi:minus" />
              </button>
              <span class="stepper-value">{{ settingsStore.readerLineHeight.toFixed(1) }}</span>
              <button class="stepper-btn" @click="adjustLineHeight(0.1)">
                <Icon icon="mdi:plus" />
              </button>
            </div>
          </div>

          <div class="settings-row">
            <div class="item-label">
              <Icon icon="mdi:format-font" class="item-icon" />
              <span>{{ t('reader.font') }}</span>
            </div>
            <KitSelect v-model="settingsStore.readerFontFamily" :options="fontOptions" size="xs" class="font-select" />
          </div>
        </div>

        <div class="divider" />
      </div>
    </KitDropdown>
  </header>
</template>

<style lang="scss" scoped>
.reader-header {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(0);
  z-index: var(--z-header, 1100);

  background-color: rgba(var(--bg-secondary-color-rgb, 33, 38, 45), 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);

  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  width: calc(100% - 32px);
  max-width: 800px;
  margin: 0;

  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;

  &.is-hidden {
    transform: translateX(-50%) translateY(calc(-100% - 24px));
    opacity: 0;
    pointer-events: none;
  }

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

    .value-badge {
      background-color: rgba(128, 128, 128, 0.2);
      color: var(--fg-primary-color);
    }
  }
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-radius: 6px;

  .item-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    font-weight: 500;

    .item-icon {
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
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

.value-badge {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
  background-color: rgba(128, 128, 128, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  display: flex;
  align-items: center;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.control-pill {
  background-color: rgba(128, 128, 128, 0.1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
}

.stepper-pill {
  padding: 2px;
  gap: 2px;

  .stepper-btn {
    background: transparent;
    border: none;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background-color 0.2s,
      color 0.2s;

    &:hover {
      background-color: rgba(128, 128, 128, 0.15);
      color: var(--fg-primary-color);
    }
  }

  .stepper-value {
    min-width: 44px;
    text-align: center;
  }
}

.font-select {
  width: 150px;
  :deep(.kit-select-trigger) {
    background-color: rgba(128, 128, 128, 0.1);
    border: 1px solid transparent;
    padding: 4px 8px;
    height: auto;
    min-height: 30px;
    box-shadow: none;
    border-radius: 6px;

    .selected-label {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }

    .trigger-icon {
      font-size: 1rem;
      color: var(--fg-secondary-color);
    }

    &:hover {
      background-color: rgba(128, 128, 128, 0.2);
      .selected-label,
      .trigger-icon {
        color: var(--fg-primary-color);
      }
    }
  }
}

.check-icon {
  font-size: 1.2rem;
  color: var(--fg-accent-color);
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

.spin-animation {
  :deep(.kit-btn-icon) {
    animation: spin 1s linear infinite;
  }
}
.pulse-animation {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-accent-color) !important;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse-op {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
