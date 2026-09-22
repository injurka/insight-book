<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTts } from '~/01.shared/composables/use-tts'
import { TTS_VOICE_OPTIONS } from '~/01.shared/constants/tts'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const { speak, stop, isPlaying, isLoading } = useTts()

const voiceOptions = computed(() => [...TTS_VOICE_OPTIONS])

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
  <div class="settings-card tts-settings-card">
    <div class="card-header">
      <Icon icon="mdi:volume-high" class="card-icon" />
      <h3 class="card-title">
        {{ t('reader.translationAndVoice') }}
      </h3>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>{{ t('reader.voiceSpeed') }}</label>
        <KitSelect v-model="settingsStore.ttsSpeed" :options="speedOptions" />
      </div>
      <div class="form-group flex-1">
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
    </div>

    <div class="form-row fallback-row">
      <div class="form-group flex-1">
        <KitCheckbox
          v-model="settingsStore.fallbackToWebSpeech"
          :label="t('settings.fallbackToWebSpeech')"
        />
        <span class="setting-desc">{{ t('settings.fallbackToWebSpeechDesc') }}</span>
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

  &.fallback-row {
    margin-top: -4px;
  }
}

.voice-select-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .voice-select {
    flex: 1;
  }

  .preview-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    padding: 0;
  }
}

.setting-desc {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin-top: -4px;
  margin-left: 28px;
  line-height: 1.4;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

.pulse-animation {
  animation: pulse 1.5s ease-in-out infinite;
  color: var(--fg-accent-color) !important;
  border-color: var(--border-accent-color) !important;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
</style>
