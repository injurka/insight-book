<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitTooltip } from '~/02.kit'

interface Props {
  isRecording: boolean
  isTranscribing: boolean
  durationSeconds: number
  audioLevel?: number
  isHandsFree?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  audioLevel: 0,
  isHandsFree: false,
  disabled: false,
})
const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop'): void
  (e: 'cancel'): void
  (e: 'toggleHandsFree'): void
}>()

const { t } = useI18n()

const WAVE_BAR_MULTIPLIERS = [0.45, 0.75, 1.25, 1.6, 1.25, 0.75, 0.45]

const formattedDuration = computed(() => {
  const m = Math.floor(props.durationSeconds / 60)
  const s = props.durationSeconds % 60

  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})
const waveBars = computed(() => {
  const lvl = props.audioLevel || 0
  const baseScale = Math.min(1.8, Math.max(0.35, lvl / 30))

  return WAVE_BAR_MULTIPLIERS.map(m => Math.min(2.0, Math.max(0.25, baseScale * m)))
})
</script>

<template>
  <div class="recorder-container" :class="{ 'is-active': isRecording || isTranscribing }">
    <!-- Active Recording Mode -->
    <div v-if="isRecording" class="active-recording-wrapper">
      <!-- Status Hint Badge for Hands-Free Mode -->
      <transition name="hint-slide">
        <div v-if="isHandsFree" class="handsfree-status-badge">
          <span class="live-dot" />
          <Icon icon="mdi:headset" class="headset-icon" />
          <span class="badge-text">{{ t('plugins.dialogue-trainer.silenceHint') }}</span>
          <button
            type="button"
            class="badge-toggle-btn"
            :title="t('plugins.dialogue-trainer.disableHandsFree')"
            @click="emit('toggleHandsFree')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
      </transition>

      <!-- Active Bar (clean horizontal row) -->
      <div class="active-recording-bar">
        <div class="recording-indicator">
          <span class="pulsing-dot" />
          <span class="timer-text">{{ formattedDuration }}</span>
          <span
            v-if="isHandsFree"
            class="handsfree-pill"
            :title="t('plugins.dialogue-trainer.handsFreeMode')"
          >
            AUTO
          </span>
        </div>

        <!-- Center: Dynamic Audio Wave -->
        <div class="sound-wave-center">
          <div class="sound-wave">
            <span
              v-for="(barHeight, idx) in waveBars"
              :key="idx"
              class="bar"
              :style="{ transform: `scaleY(${barHeight})` }"
            />
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="recording-actions">
          <KitTooltip :text="t('plugins.dialogue-trainer.recordingCancel')">
            <KitBtn
              size="sm"
              variant="tonal"
              icon="mdi:close"
              class="rec-btn cancel-btn"
              :aria-label="t('plugins.dialogue-trainer.recordingCancel')"
              @click="emit('cancel')"
            />
          </KitTooltip>

          <KitTooltip :text="t('plugins.dialogue-trainer.recordingDone')">
            <KitBtn
              size="sm"
              variant="solid"
              color="primary"
              icon="mdi:check"
              class="rec-btn finish-btn"
              :aria-label="t('plugins.dialogue-trainer.recordingDone')"
              @click="emit('stop')"
            />
          </KitTooltip>
        </div>
      </div>
    </div>

    <!-- Transcribing Mode -->
    <div v-else-if="isTranscribing" class="transcribing-bar">
      <Icon icon="mdi:loading" class="spin-icon" />
      <span class="transcribing-text">{{ t('plugins.dialogue-trainer.transcribing') }}</span>
    </div>

    <!-- Idle Mode: Mic Button + Hands-Free Toggle -->
    <div v-else class="idle-controls">
      <KitTooltip :text="t('plugins.dialogue-trainer.speakTooltip')">
        <KitBtn
          size="md"
          variant="tonal"
          color="primary"
          icon="mdi:microphone"
          :disabled="disabled"
          class="mic-btn"
          :aria-label="t('plugins.dialogue-trainer.speakTooltip')"
          @click="emit('start')"
        />
      </KitTooltip>

      <KitTooltip :text="t('plugins.dialogue-trainer.handsFreeTooltip')">
        <KitBtn
          size="md"
          :variant="isHandsFree ? 'solid' : 'tonal'"
          :color="isHandsFree ? 'accent' : undefined"
          :icon="isHandsFree ? 'mdi:headset' : 'mdi:headset-off'"
          :disabled="disabled"
          class="hands-free-btn"
          :aria-label="t('plugins.dialogue-trainer.handsFreeMode')"
          @click="emit('toggleHandsFree')"
        />
      </KitTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.recorder-container {
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-active {
    width: 100%;
  }
}

.idle-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-recording-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 580px;
  margin: 0 auto;
}

.handsfree-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 14px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.78rem;
  color: var(--fg-secondary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .headset-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .badge-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 340px;

    @media (max-width: 480px) {
      max-width: 220px;
    }
  }

  .badge-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }
  }
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
  animation: live-pulse 1.4s infinite ease-in-out;
}

@keyframes live-pulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}

.active-recording-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
  height: 52px;
  box-sizing: border-box;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 26px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  width: 100%;

  @media (max-width: 480px) {
    padding: 6px 10px;
    gap: 8px;
  }
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pulsing-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(239, 68, 68);
  flex-shrink: 0;
  animation: pulse-dot 1.2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
  }
}

.timer-text {
  font-size: 0.95rem;
  font-weight: 700;
  font-family: monospace;
  color: var(--fg-primary-color);
  letter-spacing: 0.5px;
}

.handsfree-pill {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.15);
  color: var(--fg-accent-color);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sound-wave-center {
  flex: 1;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sound-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3.5px;
  height: 24px;

  .bar {
    width: 3.5px;
    height: 18px;
    background: var(--fg-accent-color);
    border-radius: 2px;
    transform-origin: center;
    transition: transform 0.08s ease-out;
  }
}

.recording-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .rec-btn {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    border-radius: 50% !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;

    :deep(.kit-btn-icon) {
      margin: 0 !important;
      font-size: 1.15rem;
    }
  }
}

.transcribing-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--bg-secondary-color);
  border-radius: 24px;
  font-size: 0.88rem;
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  margin: 0 auto;

  .spin-icon {
    font-size: 1.1rem;
    animation: spin 1s linear infinite;
    color: var(--fg-accent-color);
  }
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.mic-btn,
.hands-free-btn {
  border-radius: 50% !important;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.hint-slide-enter-active,
.hint-slide-leave-active {
  transition: all 0.2s ease-out;
}

.hint-slide-enter-from,
.hint-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
