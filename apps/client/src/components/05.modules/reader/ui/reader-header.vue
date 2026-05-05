<script setup lang="ts">
import { KitBtn } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()

function goBack() {
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <header class="reader-header" @click.stop>
    <KitBtn icon="mdi:arrow-left" variant="text" size="sm" @click="goBack" />
    <span class="book-title">{{ store.currentBook?.title }}</span>
    <div class="spacer" />

    <KitBtn
      :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
      variant="text"
      size="sm"
      @click="toggleTheme"
    />
    <KitBtn icon="mdi:format-list-bulleted" variant="text" size="sm" @click="store.tocOpen = true" />
  </header>
</template>

<style lang="scss" scoped>
.reader-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 16px;
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
}
</style>
