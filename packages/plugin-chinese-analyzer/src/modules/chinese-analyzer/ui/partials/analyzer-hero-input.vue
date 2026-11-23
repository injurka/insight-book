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
    <div class="composer">
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

      <!-- Text Input + Actions -->
      <template v-else>
        <label class="sr-only" :for="editorId">
          {{ t('plugins.chinese-analyzer.inputLabel') }}
        </label>
        <textarea
          :id="editorId"
          :value="props.modelValue"
          class="sentence-textarea"
          rows="2"
          :placeholder="t('plugins.chinese-analyzer.inputPlaceholder')"
          :disabled="props.isAnalyzing"
          @input="onInput"
          @keydown="onKeydown"
        />

        <div class="composer-footer">
          <button
            type="button"
            class="icon-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.chinese-analyzer.voiceStartTooltip')"
            :aria-label="t('plugins.chinese-analyzer.voiceStartTooltip')"
            @click="handleStartVoiceRecording"
          >
            <Icon icon="mdi:microphone" />
          </button>

          <span class="lang-hint">
            <Icon :icon="detectedBadgeIcon" class="hint-icon" />
            <span class="hint-text">{{ detectedBadgeText }}</span>
          </span>

          <button
            v-if="props.modelValue.trim()"
            type="button"
            class="icon-btn clear-btn"
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
            <span>
              {{ props.isAnalyzing ? t('plugins.chinese-analyzer.analyzingBtn') : t('plugins.chinese-analyzer.analyzeBtn') }}
            </span>
            <Icon
              :icon="props.isAnalyzing ? 'mdi:refresh' : 'mdi:arrow-right'"
              class="submit-icon"
              :class="{ spinning: props.isAnalyzing }"
            />
          </button>
        </div>
      </template>

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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Единая поверхность ввода: текст и действия в одном контейнере */
.composer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  background: var(--bg-primary-color);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-within {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.12);
  }

  @include media-down(sm) {
    border-radius: 16px;
  }
}

.sentence-textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 4.6rem;
  max-height: min(45vh, 16rem);
  padding: 16px 18px 6px;
  border: 0;
  outline: none;
  resize: none;
  overflow-y: auto;
  field-sizing: content;
  background: transparent;
  color: var(--fg-primary-color);
  caret-color: var(--fg-accent-color);
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.6;

  &::placeholder {
    color: var(--fg-tertiary-color);
    opacity: 1;
  }

  @include media-down(sm) {
    padding: 12px 14px 4px;
    font-size: 1rem;
  }
}

.composer-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 8px;

  @include media-down(sm) {
    padding: 4px 6px 6px;
  }
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 1.25rem;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }
}

.lang-hint {
  display: inline-flex;
  align-items: center;
  flex: 1 1 0;
  gap: 6px;
  min-width: 0;
  padding: 0 6px;
  color: var(--fg-tertiary-color);
  font-size: 0.78rem;
  line-height: 1.3;

  .hint-icon {
    flex: none;
    font-size: 1rem;
    color: var(--fg-accent-color);
  }

  .hint-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @include media-down(sm) {
    .hint-text {
      display: none;
    }
  }
}

.analyze-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: 8px;
  height: 40px;
  margin-inline-start: auto;
  padding: 0 16px 0 18px;
  border: 0;
  border-radius: 12px;
  background: var(--fg-primary-color);
  color: var(--bg-primary-color);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  &:active:not(:disabled) {
    opacity: 0.82;
  }

  &:disabled {
    background: var(--bg-tertiary-color);
    color: var(--fg-tertiary-color);
    cursor: default;
  }

  .submit-icon {
    flex: none;
    font-size: 1.15rem;
  }

  @include media-down(sm) {
    padding: 0 14px;
    font-size: 0.86rem;
  }
}

/* Active Voice Recording Capsule */
.voice-recording-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
  margin: 8px;
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
  margin: 8px;
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
  margin: 0 8px 8px;
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
