<script setup lang="ts">
import type { VoiceLangMode } from '../../composables/use-analyzer-voice'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
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

const WAVE_MULTIPLIERS = [0.45, 0.78, 1.25, 1.65, 1.25, 0.78, 0.45]
const voiceLangOptions: VoiceLangMode[] = ['auto', 'zh', 'ru']

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

function getVoiceLangLabel(mode: VoiceLangMode): string {
  if (mode === 'zh') {
    return t('plugins.chinese-analyzer.voiceLangZh')
  }

  if (mode === 'ru') {
    return t('plugins.chinese-analyzer.voiceLangRu')
  }

  return t('plugins.chinese-analyzer.voiceLangAuto')
}

function onInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
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
    <div
      class="input-card"
      :class="{
        'is-analyzing': props.isAnalyzing,
        'is-recording': voice.isRecording.value || voice.isTranscribing.value,
      }"
    >
      <div class="input-card-top">
        <div class="lang-detect-pill" :class="`lang-${props.detectedLanguage}`">
          <Icon :icon="detectedBadgeIcon" class="pill-icon" />
          <span>{{ detectedBadgeText }}</span>
        </div>

        <div class="top-right-controls">
          <!-- Voice Recognition Language Selector -->
          <div class="voice-lang-switcher">
            <Icon icon="mdi:microphone" class="vl-icon" />
            <button
              v-for="mode in voiceLangOptions"
              :key="mode"
              type="button"
              class="vl-btn"
              :class="{ active: voice.voiceLanguage.value === mode }"
              :disabled="voice.isRecording.value || voice.isTranscribing.value"
              @click="voice.voiceLanguage.value = mode"
            >
              {{ getVoiceLangLabel(mode) }}
            </button>
          </div>

          <div class="input-hint-badges">
            <span class="hint-chip">中文</span>
            <Icon icon="mdi:swap-horizontal" class="swap-icon" />
            <span class="hint-chip">Русский</span>
          </div>
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
          :value="props.modelValue"
          class="sentence-textarea"
          rows="2"
          :placeholder="t('plugins.chinese-analyzer.inputPlaceholder')"
          :disabled="props.isAnalyzing"
          @input="onInput"
          @keydown="onKeydown"
        />

        <div class="input-actions">
          <button
            v-if="props.modelValue.trim()"
            type="button"
            class="clear-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.chinese-analyzer.clearInput')"
            @click="onClear"
          >
            <Icon icon="mdi:close" />
          </button>

          <!-- Voice Input Mic Button -->
          <button
            type="button"
            class="voice-mic-btn"
            :disabled="props.isAnalyzing"
            :title="t('plugins.chinese-analyzer.voiceStartTooltip')"
            @click="handleStartVoiceRecording"
          >
            <Icon icon="mdi:microphone" />
          </button>

          <button
            type="button"
            class="analyze-submit-btn"
            :disabled="!props.modelValue.trim() || props.isAnalyzing"
            @click="emit('analyze')"
          >
            <Icon
              :icon="props.isAnalyzing ? 'mdi:refresh' : 'mdi:auto-fix'"
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 100% 0%, rgba(var(--fg-accent-color-rgb), 0.12) 0%, transparent 55%),
    var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;

  &:focus-within,
  &.is-recording {
    border-color: var(--fg-accent-color);
    box-shadow:
      0 0 0 3px rgba(var(--fg-accent-color-rgb), 0.14),
      0 12px 30px rgba(0, 0, 0, 0.08);
  }

  &.is-analyzing {
    border-color: var(--fg-accent-color);
  }

  @include media-down(sm) {
    padding: 10px 12px;
    gap: 8px;
    border-radius: 14px;
    box-shadow: none;
  }
}

.input-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.top-right-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.voice-lang-switcher {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 3px 2px 7px;
  border-radius: 999px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  .vl-icon {
    font-size: 0.85rem;
    color: var(--fg-accent-color);
    margin-right: 2px;
  }

  .vl-btn {
    padding: 2px 7px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--fg-secondary-color);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.16s ease;

    &.active {
      background: var(--fg-accent-color);
      color: #ffffff;
    }
  }
}

.lang-detect-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s ease;

  .pill-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
  }

  &.lang-zh {
    background: rgba(var(--fg-accent-color-rgb), 0.12);
    color: var(--fg-accent-color);
    border-color: rgba(var(--fg-accent-color-rgb), 0.3);
  }

  &.lang-ru {
    background: rgba(38, 157, 105, 0.12);
    color: var(--fg-success-color);
    border-color: rgba(38, 157, 105, 0.3);

    .pill-icon {
      color: var(--fg-success-color);
    }
  }

  @include media-down(sm) {
    font-size: 0.7rem;
    padding: 2px 8px;
  }
}

.input-hint-badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: var(--fg-tertiary-color);

  @include media-down(sm) {
    display: none;
  }

  .hint-chip {
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .swap-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
  }
}

.textarea-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 15px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 6px 2px 2px;
    background: transparent;
    border: none;
    border-radius: 0;
  }
}

.sentence-textarea {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 1.12rem;
  font-weight: 500;
  line-height: 1.45;

  &::placeholder {
    color: var(--fg-tertiary-color);
    font-size: 0.94rem;
    font-weight: 400;
  }

  @include media-down(sm) {
    font-size: 0.98rem;
    line-height: 1.4;

    &::placeholder {
      font-size: 0.85rem;
    }
  }
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @include media-down(sm) {
    justify-content: flex-end;
    padding-top: 6px;
    border-top: 1px solid var(--border-secondary-color);
  }
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
    background: var(--bg-tertiary-color);
  }

  @include media-down(sm) {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--bg-primary-color);
  }
}

.voice-mic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.32);
  background: rgba(var(--fg-accent-color-rgb), 0.12);
  color: var(--fg-accent-color);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    background: var(--fg-accent-color);
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--fg-accent-color-rgb), 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @include media-down(sm) {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 1.1rem;
  }
}

.analyze-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, var(--fg-accent-color) 0%, #c94b1e 100%);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(var(--fg-accent-color-rgb), 0.3);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(var(--fg-accent-color-rgb), 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .submit-icon {
    font-size: 1.1rem;
  }

  @include media-down(sm) {
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 0.84rem;
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
  transition: transform 0.16s ease;

  &:hover {
    transform: scale(1.06);
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
