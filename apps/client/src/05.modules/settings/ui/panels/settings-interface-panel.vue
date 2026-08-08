<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThemesVariant, useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useTts } from '~/01.shared/composables/use-tts'
import { isTauri } from '~/01.shared/lib/env'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn, KitCheckbox, KitSelect, KitTooltip } from '~/02.kit'
import { usePushSettings } from '../../composables/use-push-settings'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const { theme } = useChangeTheme()
const { speak, stop, isPlaying, isLoading } = useTts()

const {
  pwaStore,
  pushDeckOptions,
  timeOptions,
  countOptions,
  pushTargetDeckModel,
  pushTimeStartModel,
  pushTimeEndModel,
  pushCountModel,
  savePushSettings,
  handlePushToggle,
  isPushLoading,
} = usePushSettings()

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

const voiceOptions = computed(() => [
  { label: 'Kore (Female)', value: 'Kore' },
  { label: 'Callirrhoe (Female)', value: 'Callirrhoe' },
  { label: 'Leda (Female)', value: 'Leda' },
  { label: 'Orus (Male)', value: 'Orus' },
  { label: 'Puck (Male)', value: 'Puck' },
  { label: 'Charon (Male)', value: 'Charon' },
  { label: 'Fenrir (Male)', value: 'Fenrir' },
])

const speedOptions = [
  { label: '0.75x', value: 0.75 },
  { label: '1.0x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
]

function previewVoice() {
  if (isPlaying.value || isLoading.value)
    stop()

  else
    speak(t('settings.previewVoiceText'), settingsStore.appLanguage || 'en')
}
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.interfaceTitle') }}
  </h2>

  <!-- Основные настройки -->
  <div class="settings-card lang-card">
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

    <div class="form-row mt-16">
      <div class="form-group">
        <KitCheckbox v-model="settingsStore.enableHoverRevealBg" :label="t('settings.hoverRevealBg')" />
      </div>
      <div v-if="isTauri" class="form-group">
        <KitCheckbox v-model="settingsStore.enableEruda" :label="t('settings.enableEruda')" />
      </div>
    </div>

    <div class="divider" />

    <h3 class="subsection-title">
      {{ t('reader.translationAndVoice') }}
    </h3>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>{{ t('reader.voiceSpeed') }}</label>
        <KitSelect v-model="settingsStore.ttsSpeed" :options="speedOptions" />
      </div>
    </div>

    <div class="form-group mt-16">
      <label>{{ t('reader.voice') }}</label>
      <div class="voice-select-row">
        <KitSelect v-model="settingsStore.ttsVoice" :options="voiceOptions" class="voice-select" />
        <KitTooltip :text="t('settings.previewVoice')" placement="top">
          <KitBtn
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:stop' : 'mdi:play')"
            class="preview-btn"
            :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
            variant="outlined"
            color="secondary"
            @click="previewVoice"
          />
        </KitTooltip>
      </div>
    </div>

    <div class="divider" />

    <div class="push-setting-row">
      <div class="push-info">
        <span class="push-title">
          <Icon icon="mdi:bell-ring-outline" class="push-icon" />
          {{ t('settings.pushNotifications') }}
        </span>
        <span class="push-desc">{{ t('settings.pushDesc') }}</span>
      </div>
      <KitBtn
        :variant="pwaStore.isPushSubscribed ? 'tonal' : 'outlined'"
        :color="pwaStore.isPushSubscribed ? 'success' : 'secondary'"
        class="push-btn"
        :disabled="isPushLoading"
        :icon="isPushLoading ? 'mdi:loading' : undefined"
        :class="{ 'is-loading': isPushLoading }"
        @click="handlePushToggle"
      >
        {{ pwaStore.isPushSubscribed ? t('settings.pushActive') : t('settings.pushEnable') }}
      </KitBtn>
    </div>

    <Transition name="fade">
      <div v-if="pwaStore.isPushSubscribed" class="push-details">
        <div class="form-group">
          <label>{{ t('settings.targetDeck') }}</label>
          <KitSelect v-model="pushTargetDeckModel" :options="pushDeckOptions" />
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>{{ t('settings.pushTimeStart') }}</label>
            <KitSelect v-model="pushTimeStartModel" :options="timeOptions" @update:model-value="savePushSettings" />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('settings.pushTimeEnd') }}</label>
            <KitSelect v-model="pushTimeEndModel" :options="timeOptions" @update:model-value="savePushSettings" />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('settings.pushCount') }}</label>
            <KitSelect v-model="pushCountModel" :options="countOptions" @update:model-value="savePushSettings" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}
.push-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  .push-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .push-title {
      font-weight: 500;
      color: var(--fg-primary-color);
      .push-icon {
        vertical-align: text-bottom;
        font-size: 1.1em;
        color: var(--fg-accent-color);
      }
    }
    .push-desc {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
  .push-btn {
    flex-shrink: 0;
    &.is-loading {
      :deep(.kit-btn-icon) {
        animation: spin 1s linear infinite;
      }
    }
  }
}
.push-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-row {
  display: flex;
  gap: 16px;
  @include media-down(sm) {
    flex-direction: column;
  }
  .flex-1 {
    flex: 1;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.subsection-title {
  margin-top: 0;
  font-size: 1.1rem;
  color: var(--fg-primary-color);
  margin-bottom: 16px;
}
.voice-select-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.voice-select {
  flex: 1;
  min-width: 0;
}
.preview-btn {
  padding: 0;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}
.mt-16 {
  margin-top: 16px;
}
.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 24px 0;
}
.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}
.pulse-animation {
  :deep(svg) {
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
