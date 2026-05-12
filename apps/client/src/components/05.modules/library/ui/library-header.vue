<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'

interface Props {
  langOptions: Array<{ label: string, value: string }>
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'upload', file: File): void
}>()

const search = defineModel<string>('search', { required: true })
const lang = defineModel<string>('lang', { required: true })

const router = useRouter()
const { theme, toggleTheme } = useChangeTheme()
const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('upload', target.files[0])
    target.value = ''
  }
}

function openDictionary() {
  router.push(AppRoutePaths.Dictionary)
}

function openSettings() {
  router.push(AppRoutePaths.Settings)
}
</script>

<template>
  <header class="library-header">
    <div class="header-top">
      <div class="header-title">
        <h1>Insight Book</h1>
        <p>Ваша умная библиотека для изучения языков</p>
      </div>

      <!-- Верхние иконки действий (Тема и Память) -->
      <div class="top-actions">
        <KitTooltip text="Управление памятью" placement="bottom">
          <KitBtn
            icon="mdi:database-outline"
            variant="text"
            aria-label="Память и Оффлайн"
            @click="openSettings"
          />
        </KitTooltip>

        <KitTooltip text="Переключить тему" placement="bottom-end">
          <KitBtn
            :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
            variant="text"
            aria-label="Переключить тему"
            @click="toggleTheme"
          />
        </KitTooltip>
      </div>
    </div>

    <div class="header-bottom">
      <div class="filters">
        <KitInput v-model="search" placeholder="Поиск книг..." size="md" />
        <KitSelect v-model="lang" :options="langOptions" size="md" aria-label="Выбор языка" />
      </div>

      <div class="header-actions">
        <KitBtn icon="mdi:book-alphabet" variant="outlined" color="secondary" @click="openDictionary">
          Мой словарь
        </KitBtn>
        <KitBtn icon="mdi:upload" color="primary" @click="fileInput?.click()">
          Загрузить
        </KitBtn>
        <input
          ref="fileInput"
          type="file"
          accept=".epub,.cbz,.zip"
          style="display: none"
          @change="onFileChange"
        >
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.library-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 16px;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .header-title {
      h1 {
        font-size: 2.2rem;
        margin: 0 0 8px 0;
        color: var(--fg-primary-color);
      }
      p {
        margin: 0;
        color: var(--fg-secondary-color);
        font-size: 1rem;
      }
    }

    .top-actions {
      display: flex;
      gap: 4px;
    }
  }

  .header-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;

    .filters {
      display: flex;
      gap: 12px;
      flex-grow: 1;
      max-width: 500px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    @include media-down(sm) {
      flex-direction: column;
      align-items: stretch;

      .filters {
        max-width: 100%;
      }

      .header-actions {
        width: 100% !important;

        .kit-btn {
          flex: 1;
        }
      }
    }
  }
}
</style>
