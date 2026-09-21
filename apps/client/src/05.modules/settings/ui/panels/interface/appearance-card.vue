<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThemesVariant, useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { isTauri } from '~/01.shared/lib/env'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const { theme } = useChangeTheme()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

const themeOptions = computed(() => [
  { label: t('reader.system'), value: ThemesVariant.System },
  { label: t('reader.light'), value: ThemesVariant.Light },
  { label: t('reader.dark'), value: ThemesVariant.Dark },
  { label: t('reader.sepia'), value: ThemesVariant.Sepia },
  { label: t('reader.green'), value: ThemesVariant.Green },
  { label: t('reader.oled'), value: ThemesVariant.Oled },
])
</script>

<template>
  <div class="settings-card appearance-card">
    <div class="card-header">
      <Icon icon="mdi:palette-outline" class="card-icon" />
      <h3 class="card-title">
        {{ t('settings.appearanceTitle') }}
      </h3>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>{{ t('settings.appLanguage') }}</label>
        <KitSelect v-model="settingsStore.appLanguage" :options="appLangOptions" />
      </div>
      <div class="form-group flex-1">
        <label>{{ t('globalActions.theme') }}</label>
        <KitSelect v-model="theme" :options="themeOptions" />
      </div>
    </div>

    <div class="checkboxes-row">
      <div class="form-group">
        <KitCheckbox v-model="settingsStore.enableHoverRevealBg" :label="t('settings.hoverRevealBg')" />
      </div>
      <div v-if="isTauri" class="form-group">
        <KitCheckbox v-model="settingsStore.enableEruda" :label="t('settings.enableEruda')" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 14px;
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .card-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
  }

  .card-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.form-row {
  display: flex;
  gap: 20px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    &.flex-1 {
      flex: 1;
      min-width: 0;
    }
  }
}

.checkboxes-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
