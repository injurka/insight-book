<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalyzerVoice } from '../../composables/use-analyzer-voice'

interface Props {
  modelValue: string
  isAnalyzing: boolean
  detectedLanguage: 'zh' | 'ru' | 'auto'
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
  if (props.detectedLanguage === 'zh') {
    return t('plugins.chinese-analyzer.detectedZh')
  }

  if (props.detectedLanguage === 'ru') {
    return t('plugins.chinese-analyzer.detectedRu')
  }

  return t('plugins.chinese-analyzer.detectedAuto')
})
const detectedBadgeIcon = computed(() => {
  if (props.detectedLanguage === 'zh') {
    return 'mdi:ideogram-cjk-variant'
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
          {{ t('plugins.chinese-analyzer.inputLabel') }}
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
          <span class="rec-hint">{{ t('plugins.chinese-analyzer.voiceListeningHint') }}</span>
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
            :title="t('plugins.chinese-analyzer.voiceCancelTooltip')"
            @click="voice.cancelRecording"
          >
            <Icon icon="mdi:close" />
          </button>

          <button
            type="button"
            class="rec-action-btn finish-rec-btn"
            :title="t('plugins.chinese-analyzer.voiceStopTooltip')"
            @click="handleFinishVoiceRecording"
          >
            <Icon icon="mdi:check" />
          </button>
        </div>
      </div>

      <!-- Speech Transcribing State -->
      <div v-else-if="voice.isTranscribing.value" class="voice-transcribing-bar">
        <Icon icon="mdi:loading" class="spinning transcribing-icon" />
        <span>{{ t('plugins.chinese-analyzer.voiceTranscribing') }}</span>
      </div>

      <!-- Normal Text + Voice Input Area -->
      <div v-else class="textarea-wrapper">
        <textarea
          :id="editorId"
          :value="props.modelValue"
          class="sentence-textarea"
          rows="3"
          :placeholder="t('plugins.chinese-analyzer.inputPlaceholder')"
          :disabled="props.isAnalyzing"
          @input="onInput"
          @keydown="onKeydown"
        />

        <div class="input-actions">
          <!-- Voice Input Mic Button -->
          <button
            type="button"
            class="voice-mic-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.chinese-analyzer.voiceStartTooltip')"
            :aria-label="t('plugins.chinese-analyzer.voiceStartTooltip')"
            @click="handleStartVoiceRecording"
          >
            <Icon icon="mdi:microphone" />
          </button>

          <button
            v-if="props.modelValue.trim()"
            type="button"
            class="clear-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.chinese-analyzer.clearInput')"
            :aria-label="t('plugins.chinese-analyzer.clearInput')"
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
              {{ props.isAnalyzing ? t('plugins.chinese-analyzer.analyzingBtn') : t('plugins.chinese-analyzer.analyzeBtn') }}
            </span>
          </button>
        </div>
      </div>

      <!-- Voice Error Notification -->
      <div v-if="voice.voiceErrorKey.value" class="voice-error-banner">
        <div class="ve-left">
          <Icon icon="mdi:alert-circle-outline" class="ve-icon" />
          <span>{{ t(`plugins.chinese-analyzer.${voice.voiceErrorKey.value}`) }}</span>
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
  font-size: 0.75rem;
  line-height: 1.4;

  .pill-icon {
    flex: none;
    font-size: 1rem;
    color: var(--fg-accent-color);
  }
}

.textarea-wrapper {
  display: grid;
  min-width: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: 17px;
  background: var(--bg-primary-color);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-within {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.12);
  }
}

.sentence-textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 7.5rem;
  min-width: 0;
  padding: 16px;
  border: 0;
  border-radius: 17px 17px 0 0;
  outline: none;
  resize: vertical;
  background: transparent;
  color: var(--fg-primary-color);
  caret-color: var(--fg-accent-color);
  font: inherit;
  font-size: 1rem;
  line-height: 1.6;

  @media (pointer: coarse) {
    resize: none;
  }

  &::placeholder {
    color: var(--fg-secondary-color);
    opacity: 1;
  }
}

.input-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--border-secondary-color);
  border-radius: 0 0 17px 17px;
  background: var(--bg-secondary-color);
}

.clear-btn,
.voice-mic-btn,
.analyze-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 11px;
  font: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
  }
}

.clear-btn,
.voice-mic-btn {
  width: 44px;
  flex: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 1.2rem;

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }
}

.analyze-submit-btn {
  max-width: 100%;
  margin-inline-start: auto;
  gap: 8px;
  padding: 6px 12px;
  background: var(--fg-primary-color);
  color: var(--bg-primary-color);
  font-size: 0.875rem;
  font-weight: 700;

  &:disabled {
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
  }

  &:active:not(:disabled) {
    opacity: 0.82;
  }

  .submit-icon {
    order: 1;
    flex: none;
    font-size: 1.15rem;
  }
}

/* Active Voice Recording Capsule */
.voice-recording-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1.5px solid var(--fg-accent-color);
  box-sizing: border-box;
  flex-wrap: wrap;

  @include media-down(sm) {
    min-height: 48px;
    padding: 8px 10px;
    border-radius: 11px;
  }
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
  transition: border-color 0.16s ease;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  &.cancel-rec-btn {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    color: var(--fg-secondary-color);
  }

  &.finish-rec-btn {
    background: var(--fg-accent-color);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(var(--fg-accent-color-rgb), 0.35);
  }
}

.voice-transcribing-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--fg-secondary-color);

  .transcribing-icon {
    font-size: 1.15rem;
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

  .ve-icon {
    font-size: 1rem;
    flex-shrink: 0;
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
