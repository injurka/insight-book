<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyzerVoice } from '../../composables/use-analyzer-voice'

interface Props {
  modelValue: string
  isAnalyzing: boolean
  detectedLanguage: 'ru' | 'zh' | 'en' | 'auto'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'analyze': [customInput?: string]
}>()

const { t } = useI18n()
const voice = useAnalyzerVoice()
const editorId = useId()

const WAVE_MULTIPLIERS = [0.45, 0.78, 1.25, 1.65, 1.25, 0.78, 0.45]

const showEditor = computed(() => !voice.isRecording.value && !voice.isTranscribing.value)
const detectedBadgeText = computed(() => {
  if (props.detectedLanguage === 'ru') {
    return t('plugins.russian-analyzer.detectedRu')
  }

  if (props.detectedLanguage === 'zh') {
    return t('plugins.russian-analyzer.detectedZh')
  }

  if (props.detectedLanguage === 'en') {
    return t('plugins.russian-analyzer.detectedEn')
  }

  return t('plugins.russian-analyzer.detectedAuto')
})
const detectedBadgeIcon = computed(() => {
  if (props.detectedLanguage === 'ru') {
    return 'mdi:alphabet-cyrillic'
  }

  return 'mdi:translate'
})
const formattedDuration = computed(() => {
  const mins = Math.floor(voice.recordingDuration.value / 60)
  const secs = voice.recordingDuration.value % 60

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})
const waveBarStyles = computed(() => {
  const baseScale = Math.min(1.85, Math.max(0.32, voice.audioLevel.value / 28))

  return WAVE_MULTIPLIERS.map((mult) => {
    const scaleY = Math.min(2.1, Math.max(0.25, Number((baseScale * mult).toFixed(2))))

    return {
      transform: `scaleY(${scaleY})`,
    }
  })
})

function onInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    emit('analyze')
  }
}
function onClear(): void {
  emit('update:modelValue', '')
}
async function handleFinishVoiceRecording(): Promise<void> {
  const transcribed = await voice.stopRecording()

  if (transcribed) {
    emit('update:modelValue', transcribed)
    emit('analyze', transcribed)
  }
}
async function handleStartVoiceRecording(): Promise<void> {
  if (props.isAnalyzing || voice.isTranscribing.value) {
    return
  }

  await voice.startRecording(() => {
    if (voice.isRecording.value) {
      void handleFinishVoiceRecording()
    }
  })
}
</script>

<template>
  <section class="hero-input-section">
    <div class="input-card">
      <div class="input-card-top">
        <component :is="showEditor ? 'label' : 'span'" class="editor-label" :for="showEditor ? editorId : undefined">
          {{ t('plugins.russian-analyzer.inputLabel') }}
        </component>
        <div class="lang-detect-pill">
          <Icon :icon="detectedBadgeIcon" class="pill-icon" />
          <span>{{ detectedBadgeText }}</span>
        </div>
      </div>

      <!-- Active Voice Recording Bar -->
      <div v-if="voice.isRecording.value" class="voice-recording-bar">
        <div class="rec-status-left">
          <span class="rec-pulse-dot" />
          <span class="rec-timer">{{ formattedDuration }}</span>
          <span class="rec-hint">{{ t('plugins.russian-analyzer.voiceListeningHint') }}</span>
        </div>

        <div class="rec-wave-bars">
          <span
            v-for="(barStyle, idx) in waveBarStyles"
            :key="idx"
            class="wave-bar"
            :style="barStyle"
          />
        </div>

        <div class="rec-actions-right">
          <button
            type="button"
            class="rec-action-btn cancel-rec-btn"
            :title="t('plugins.russian-analyzer.voiceCancelTooltip')"
            @click="voice.cancelRecording"
          >
            <Icon icon="mdi:close" />
          </button>

          <button
            type="button"
            class="rec-action-btn finish-rec-btn"
            :title="t('plugins.russian-analyzer.voiceStopTooltip')"
            @click="handleFinishVoiceRecording"
          >
            <Icon icon="mdi:check" />
          </button>
        </div>
      </div>

      <!-- Speech Transcribing State -->
      <div v-else-if="voice.isTranscribing.value" class="voice-transcribing-bar">
        <Icon icon="mdi:loading" class="spinning transcribing-icon" />
        <span>{{ t('plugins.russian-analyzer.voiceTranscribing') }}</span>
      </div>

      <!-- Normal Text + Voice Input Area -->
      <div v-else class="textarea-wrapper">
        <textarea
          :id="editorId"
          :value="props.modelValue"
          class="sentence-textarea"
          rows="3"
          :placeholder="t('plugins.russian-analyzer.inputPlaceholder')"
          :disabled="props.isAnalyzing"
          @input="onInput"
          @keydown="onKeydown"
        />

        <div class="input-actions">
          <button
            type="button"
            class="voice-mic-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.russian-analyzer.voiceStartTooltip')"
            :aria-label="t('plugins.russian-analyzer.voiceStartTooltip')"
            @click="handleStartVoiceRecording"
          >
            <Icon icon="mdi:microphone" />
          </button>

          <button
            v-if="props.modelValue.trim()"
            type="button"
            class="clear-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.russian-analyzer.clearInput')"
            :aria-label="t('plugins.russian-analyzer.clearInput')"
            @click="onClear"
          >
            <Icon icon="mdi:close" />
          </button>

          <button
            type="button"
            class="analyze-submit-btn"
            :disabled="!props.modelValue.trim() || props.isAnalyzing"
            @click="emit('analyze')"
          >
            <Icon
              :icon="props.isAnalyzing ? 'mdi:refresh' : 'mdi:arrow-right'"
              class="submit-icon"
              :class="{ spinning: props.isAnalyzing }"
            />
            <span>
              {{ props.isAnalyzing ? t('plugins.russian-analyzer.analyzingBtn') : t('plugins.russian-analyzer.analyzeBtn') }}
            </span>
          </button>
        </div>
      </div>

      <!-- Voice Error Notification -->
      <div v-if="voice.voiceErrorKey.value" class="voice-error-banner">
        <div class="ve-left">
          <Icon icon="mdi:alert-circle-outline" class="ve-icon" />
          <span>{{ t(`plugins.russian-analyzer.${voice.voiceErrorKey.value}`) }}</span>
        </div>
        <button
          type="button"
          class="ve-close"
          @click="voice.voiceErrorKey.value = null"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.hero-input-section {
  width: 100%;
}

.input-card {
  display: grid;
  gap: 14px;
  padding: clamp(12px, 3vw, 22px);
  border: 1px solid var(--border-secondary-color);
  border-radius: 24px;
  background: var(--bg-secondary-color);

  @include media-down(sm) {
    gap: 10px;
    border-radius: 16px;
  }
}

.input-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  column-gap: 12px;
  row-gap: 4px;
}

.editor-label {
  color: var(--fg-primary-color);
  font-size: 0.92rem;
  font-weight: 700;
}

.lang-detect-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
  font-weight: 600;

  .pill-icon {
    font-size: 1rem;
    color: var(--fg-accent-color);
  }
}

.textarea-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus-within {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.14);
  }

  @include media-down(sm) {
    padding: 10px 12px;
    border-radius: 13px;
  }
}

.sentence-textarea {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 1.08rem;
  font-weight: 500;
  line-height: 1.5;

  &::placeholder {
    color: var(--fg-tertiary-color);
    font-size: 0.92rem;
    font-weight: 400;
  }

  @include media-down(sm) {
    font-size: 0.96rem;
    line-height: 1.42;

    &::placeholder {
      font-size: 0.84rem;
    }
  }
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
}

.clear-btn,
.voice-mic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 1.15rem;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.voice-mic-btn {
  margin-right: auto;
  color: var(--fg-accent-color);
  background: rgba(var(--fg-accent-color-rgb), 0.1);
  border-color: rgba(var(--fg-accent-color-rgb), 0.3);

  &:hover:not(:disabled) {
    background: var(--fg-accent-color);
    color: #ffffff;
  }
}

.analyze-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 38px;
  padding: 0 18px;
  border-radius: 11px;
  border: none;
  background: var(--fg-accent-color);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    filter 0.18s ease,
    opacity 0.18s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .submit-icon {
    font-size: 1.1rem;
  }
}

.voice-recording-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1.5px solid var(--fg-accent-color);
  box-sizing: border-box;
  flex-wrap: wrap;
}

.rec-status-left {
  display: flex;
  align-items: center;
  gap: 8px;

  .rec-pulse-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    animation: rec-pulse 1.2s infinite ease-in-out;
  }

  .rec-timer {
    font-family: monospace;
    font-size: 0.94rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .rec-hint {
    font-size: 0.84rem;
    color: var(--fg-secondary-color);

    @include media-down(sm) {
      display: none;
    }
  }
}

.rec-wave-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  flex: 1;

  .wave-bar {
    width: 3.5px;
    height: 16px;
    border-radius: 999px;
    background: var(--fg-accent-color);
    transform-origin: center;
    transition: transform 0.08s ease-out;
  }
}

.rec-actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  font-size: 1.05rem;
  cursor: pointer;

  &.cancel-rec-btn {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
  }

  &.finish-rec-btn {
    background: var(--fg-accent-color);
    color: #ffffff;
  }
}

.voice-transcribing-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 58px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg-secondary-color);

  .transcribing-icon {
    font-size: 1.2rem;
    color: var(--fg-accent-color);
  }
}

.voice-error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.28);
  color: #ef4444;
  font-size: 0.8rem;

  .ve-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .ve-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    padding: 2px;
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes rec-pulse {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.25);
    opacity: 1;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.55);
  }
}
</style>
