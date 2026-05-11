<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useReaderStore } from '../store/reader.store'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()

function goBack() {
  router.push(AppRoutePaths.Home)
}
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
        <KitTooltip text="Проанализировать страницу" placement="bottom">
          <KitBtn
            icon="mdi:text-box-search-outline"
            variant="text"
            size="sm"
            :disabled="analysisStore.isAnalyzingPage"
            :class="{ 'is-active-btn': dropdownProps.isOpen }"
          />
        </KitTooltip>
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

    <KitTooltip text="Переключить тему" placement="bottom">
      <KitBtn
        :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
        variant="text"
        aria-label="Переключить тему"
        @click="toggleTheme"
      />
    </KitTooltip>

    <KitTooltip text="Оглавление" placement="bottom-end">
      <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="readerStore.tocOpen = true" />
    </KitTooltip>
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
  }

  .spacer {
    flex-grow: 1;
  }

  .desktop-only {
    @include media-down(md) {
      display: none !important;
    }
  }

  .is-active-btn {
    color: var(--fg-accent-color) !important;
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
  padding: 10px 12px;
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
