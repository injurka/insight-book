<script setup lang="ts">
import { KitBtn } from '~/components/01.kit'
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
    <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    <span class="book-title">{{ readerStore.currentBook?.title }}</span>
    <div class="spacer" />

    <KitBtn
      v-if="readerStore.currentBook?.type !== 'manga'"
      icon="mdi:view-split-vertical"
      variant="text"
      size="sm"
      title="Параллельное чтение"
      class="desktop-only"
      :class="{ 'is-active-btn': readerStore.isParallelView }"
      @click="readerStore.isParallelView = !readerStore.isParallelView"
    />
    <KitBtn
      icon="mdi:text-box-search-outline"
      variant="text"
      size="sm"
      title="Проанализировать всю страницу"
      :disabled="analysisStore.isAnalyzingPage"
      @click="analysisStore.analyzeWholePage"
    />
    <KitBtn
      :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
      variant="text"
      aria-label="Переключить тему"
      @click="toggleTheme"
    />
    <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="readerStore.tocOpen = true" />
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
</style>
