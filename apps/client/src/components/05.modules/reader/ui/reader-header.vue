<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
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

const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()

const dropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

function goBack() {
  router.push(AppRoutePaths.Home)
}

const currentThemeIcon = computed(() =>
  theme.value === ThemesVariant.Light ? 'mdi:weather-sunny' : 'mdi:weather-night',
)

function handleAnalyze(mode: 'sentences' | 'words' | 'all') {
  analysisStore.analyzeWholePage(mode)
  dropdownRef.value?.close()
}

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

const fontOptions = [
  { label: 'По умолчанию (Maple Mono)', value: '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif' },
  { label: 'Без засечек (Sans-serif)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'С засечками (Serif)', value: 'Georgia, \'Times New Roman\', serif' },
  { label: 'Рукописный (Cursive)', value: '\'Comic Sans MS\', cursive, sans-serif' },
]
</script>

<template>
  <header class="reader-header" @click.stop>
    <KitTooltip text="Вернуться назад" placement="bottom">
      <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    </KitTooltip>

    <span class="book-title">{{ readerStore.currentBook?.title }}</span>

    <div class="spacer" />

    <KitTooltip
      v-if="readerStore.currentBook?.type !== 'manga'"
      text="Параллельное чтение"
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

    <KitDropdown placement="bottom-end" width="240px">
      <template #activator="{ props: dropdownProps }">
        <KitBtn
          icon="mdi:text-box-search-outline"
          variant="text"
          size="sm"
          :disabled="analysisStore.isAnalyzingPage"
          :class="{ 'is-active-btn': dropdownProps.isOpen }"
        />
      </template>
      <div class="dropdown-menu-list">
        <button class="dropdown-item" @click="analysisStore.analyzeWholePage('sentences')">
          <Icon icon="mdi:text-short" />
          Все предложения
        </button>
        <button class="dropdown-item" @click="analysisStore.analyzeWholePage('words')">
          <Icon icon="mdi:format-text" />
          Все слова
        </button>
        <button class="dropdown-item" @click="analysisStore.analyzeWholePage('all')">
          <Icon icon="mdi:text-box-multiple-outline" />
          Предложения и слова
        </button>
      </div>
    </KitDropdown>

    <KitTooltip text="Оглавление" placement="bottom-end">
      <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="readerStore.tocOpen = true" />
    </KitTooltip>

    <KitDropdown ref="dropdownRef" placement="left" :width="340" :close-on-content-click="false">
      <template #activator="{ props: dropdownProps }">
        <KitBtn
          icon="mdi:cog-outline"
          variant="text"
          size="sm"
          title="Настройки"
          :class="{ 'is-active-btn': dropdownProps?.isOpen }"
        />
      </template>

      <div class="menu-content">
        <!-- Внешний вид и интерфейс -->
        <div class="menu-section">
          <div class="section-title">
            Внешний вид
          </div>
          <div class="menu-item" @click="toggleTheme">
            <div class="item-label">
              <Icon :icon="currentThemeIcon" class="item-icon" />
              <span>Оформление</span>
            </div>
            <span class="value-text">{{ theme === 'light' ? 'Светлая' : 'Темная' }}</span>
          </div>
        </div>

        <div class="divider" />

        <!-- Чтение и озвучка -->
        <div class="menu-section">
          <div class="section-title">
            Перевод и Озвучка
          </div>
          <div class="menu-item" @click="togglePriority">
            <div class="item-label">
              <Icon icon="mdi:translate" class="item-icon" />
              <span>Приоритет перевода</span>
            </div>
            <span class="value-text">{{ settingsStore.translationPriority === 'dict' ? 'Словарь' : 'Нейросеть' }}</span>
          </div>
          <div class="menu-item" @click="cycleTtsSpeed">
            <div class="item-label">
              <Icon icon="mdi:play-speed" class="item-icon" />
              <span>Скорость озвучки</span>
            </div>
            <span class="value-text">{{ settingsStore.ttsSpeed }}x</span>
          </div>
        </div>

        <div v-if="readerStore.currentBook?.type !== 'manga'" class="divider" />

        <!-- Отображение текста (Типографика) -->
        <div v-if="readerStore.currentBook?.type !== 'manga'" class="menu-section">
          <div class="section-title">
            Отображение текста
          </div>

          <div class="typography-controls">
            <div class="typography-row">
              <span class="typography-label">Размер</span>
              <div class="typography-stepper">
                <KitBtn icon="mdi:minus" size="xs" variant="outlined" color="secondary" @click="adjustFontSize(-0.1)" />
                <span class="stepper-value">{{ settingsStore.readerFontSize.toFixed(1) }}rem</span>
                <KitBtn icon="mdi:plus" size="xs" variant="outlined" color="secondary" @click="adjustFontSize(0.1)" />
              </div>
            </div>

            <div class="typography-row">
              <span class="typography-label">Интервал</span>
              <div class="typography-stepper">
                <KitBtn icon="mdi:minus" size="xs" variant="outlined" color="secondary" @click="adjustLineHeight(-0.1)" />
                <span class="stepper-value">{{ settingsStore.readerLineHeight.toFixed(1) }}</span>
                <KitBtn icon="mdi:plus" size="xs" variant="outlined" color="secondary" @click="adjustLineHeight(0.1)" />
              </div>
            </div>

            <div class="typography-row font-row">
              <span class="typography-label">Шрифт</span>
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
  padding: 4px 8px 8px;

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

  .typography-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &.font-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
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

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
  }

  &:hover svg {
    color: var(--fg-accent-color);
  }
}
</style>
