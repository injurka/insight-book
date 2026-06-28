<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { usePronunciationCheck } from '../composables/use-pronunciation-check'

const props = withDefaults(
  defineProps<{
    word: string
    language: string
    variant?: 'button' | 'inline'
    btnColor?: 'primary' | 'secondary' | 'accent' | 'error' | 'success' | 'warning' | 'info'
    btnVariant?: 'solid' | 'outlined' | 'text' | 'subtle' | 'tonal'
    btnSize?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  {
    variant: 'button',
    btnColor: 'secondary',
    btnVariant: 'tonal',
    btnSize: 'sm',
  },
)

const check = usePronunciationCheck(() => props.word, () => props.language)
const {
  isRecording,
  isAnalyzingAudio,
  pronScore,
  pronHeardText,
  pronHeardPhonetic,
  pronMistakeAnalysis,
  userAudioUrl,
  isUserAudioPlaying,
  toggleRecording,
  playUserAudio,
} = check

const { t } = useI18n()

const pronScoreClass = computed(() => {
  if (pronScore.value === null)
    return ''
  if (pronScore.value >= 85)
    return 'is-success'
  if (pronScore.value >= 50)
    return 'is-warning'
  return 'is-error'
})

// Exposed for testing
defineExpose({
  check,
})
</script>

<template>
  <div class="pronunciation-check">
    <template v-if="variant === 'button'">
      <KitDropdown placement="bottom-end" width="280px" :close-on-content-click="false">
        <template #activator>
          <KitTooltip :text="isRecording ? 'Остановить запись' : t('pronunciation.check')">
            <KitBtn
              class="speak-btn"
              :icon="isAnalyzingAudio ? 'mdi:loading' : (isRecording ? 'mdi:stop' : 'mdi:microphone')"
              :color="isRecording ? 'error' : btnColor"
              :variant="btnVariant"
              :size="btnSize"
              :class="{
                'pulse-animation': isRecording,
                'spin-animation': isAnalyzingAudio,
              }"
              @click="toggleRecording(word, language)"
            />
          </KitTooltip>
        </template>

        <div v-if="pronScore !== null" style="padding: 8px;">
          <div class="pronunciation-result">
            <div class="pron-header">
              <span class="pron-score" :class="pronScoreClass">{{ pronScore }}%</span>
              <span class="pron-label">{{ t('pronunciation.accuracy') }}</span>

              <div style="flex-grow: 1;" />

              <KitTooltip :text="t('pronunciation.listenSelf')" placement="top">
                <KitBtn
                  v-if="userAudioUrl"
                  :icon="isUserAudioPlaying ? 'mdi:stop' : 'mdi:play'"
                  size="xs"
                  variant="tonal"
                  color="primary"
                  class="user-audio-btn"
                  @click.stop="playUserAudio"
                />
              </KitTooltip>
            </div>

            <div class="pron-details">
              <div class="pron-row">
                <span class="row-label">{{ t('pronunciation.heard') }}</span>
                <span class="row-value" :class="{ 'is-error': pronScore < 100 }">
                  <b>{{ pronHeardText || t('pronunciation.nothingRecognized') }}</b>
                  <span v-if="pronHeardPhonetic" class="transcription-hint">({{ pronHeardPhonetic }})</span>
                </span>
              </div>
              <div v-if="pronMistakeAnalysis" class="pron-row analysis-row">
                <span class="row-label">{{ t('pronunciation.analysis') }}</span>
                <span class="row-value" v-html="pronMistakeAnalysis" />
              </div>
            </div>
          </div>
        </div>
      </KitDropdown>
    </template>

    <template v-else-if="variant === 'inline'">
      <div v-if="pronScore !== null" class="pronunciation-result">
        <div class="pron-header">
          <span class="pron-score" :class="pronScoreClass">{{ pronScore }}%</span>
          <span class="pron-label">{{ t('pronunciation.accuracy') }}</span>

          <div style="flex-grow: 1;" />

          <KitTooltip :text="t('pronunciation.listenSelf')" placement="top">
            <KitBtn
              v-if="userAudioUrl"
              :icon="isUserAudioPlaying ? 'mdi:stop' : 'mdi:play'"
              size="xs"
              variant="tonal"
              color="primary"
              class="user-audio-btn"
              @click.stop="playUserAudio"
            />
          </KitTooltip>
        </div>

        <div class="pron-details">
          <div class="pron-row">
            <span class="row-label">{{ t('pronunciation.heard') }}</span>
            <span class="row-value" :class="{ 'is-error': pronScore < 100 }">
              <b>{{ pronHeardText || t('pronunciation.nothingRecognized') }}</b>
              <span v-if="pronHeardPhonetic" class="transcription-hint">({{ pronHeardPhonetic }})</span>
            </span>
          </div>
          <div v-if="pronMistakeAnalysis" class="pron-row analysis-row">
            <span class="row-label">{{ t('pronunciation.analysis') }}</span>
            <span class="row-value" v-html="pronMistakeAnalysis" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.pronunciation-check {
  display: inline-flex;
  align-items: center;
}

.pronunciation-result {
  background: var(--bg-secondary-color, rgba(var(--bg-secondary-color-rgb), 1));
  border: 1px solid var(--border-secondary-color, rgba(var(--border-secondary-color-rgb), 0.2));
  border-radius: 8px;
  padding: 12px;
  min-width: 250px;
}

.pron-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pron-score {
  font-weight: bold;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;

  &.is-success {
    background-color: rgba(var(--color-success-rgb, 40, 167, 69), 0.15);
    color: var(--color-success, #28a745);
  }

  &.is-warning {
    background-color: rgba(var(--color-warning-rgb, 255, 193, 7), 0.15);
    color: var(--color-warning, #ffc107);
  }

  &.is-error {
    background-color: rgba(var(--color-error-rgb, 220, 53, 69), 0.15);
    color: var(--color-error, #dc3545);
  }
}

.pron-label {
  font-size: 12px;
  color: var(--fg-secondary-color);
}

.pron-details {
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pron-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  font-size: 11px;
  color: var(--fg-muted-color, #8b949e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.row-value {
  color: var(--fg-primary-color);

  &.is-error {
    color: var(--color-error, #dc3545);
  }
}

.transcription-hint {
  font-size: 12px;
  color: var(--fg-secondary-color);
  margin-left: 4px;
  font-family: monospace;
}

.pulse-animation {
  animation: pulse 1.5s infinite;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--color-error-rgb, 220, 53, 69), 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--color-error-rgb, 220, 53, 69), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--color-error-rgb, 220, 53, 69), 0);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
