<script setup lang="ts">
import type { TokenizedSentence } from '../../../../shared/lib/dialogue-tokenizer'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { KitTooltip } from '~/02.kit'
import { useTextSelection } from '~/04.features/analysis'
import { tokenizeDialogueText, tokenizeDialogueTextServer } from '../../../../shared/lib/dialogue-tokenizer'

interface Props {
  isCorrect?: boolean
  feedback?: string
  correctedSentence?: string
  correctedTranscription?: string
  autoExpandTranscriptions?: boolean
  baseSentId?: number
  targetLanguage: string
  isPlayingAudio: boolean
  isLoadingAudio: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoExpandTranscriptions: true,
  baseSentId: 5000,
})
const emit = defineEmits<{
  (e: 'playCorrection'): void
}>()

const { t } = useI18n()
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()
const analysisStore = useAnalysisStore()

const serverSentences = ref<TokenizedSentence[] | null>(null)
const manualShowTranscription = ref<boolean | null>(null)

const isTranscriptionVisible = computed(() => {
  if (!props.correctedTranscription) {
    return false
  }

  if (manualShowTranscription.value !== null) {
    return manualShowTranscription.value
  }

  return Boolean(props.autoExpandTranscriptions)
})
const tokenizedCorrectionSentences = computed(() => {
  if (serverSentences.value?.length) {
    return serverSentences.value
  }

  if (!props.correctedSentence) {
    return []
  }

  return tokenizeDialogueText(props.correctedSentence, props.targetLanguage, props.baseSentId)
})

watch(() => props.autoExpandTranscriptions, () => {
  manualShowTranscription.value = null
})
watch(() => [props.correctedSentence, props.targetLanguage, props.baseSentId], async () => {
  if (!props.correctedSentence) {
    serverSentences.value = []

    return
  }

  serverSentences.value = await tokenizeDialogueTextServer(props.correctedSentence, props.targetLanguage, props.baseSentId)
}, { immediate: true })

function toggleTranscription() {
  manualShowTranscription.value = !isTranscriptionVisible.value
}
function isWordActive(sentId: number, tokenIdx: number, isPunct: boolean): boolean {
  if (isPunct) {
    return false
  }

  return analysisStore.activeTokenId === `${sentId}-${tokenIdx}`
}
</script>

<template>
  <div class="feedback-card" :class="{ 'is-correct': isCorrect, 'needs-work': !isCorrect }">
    <div class="feedback-header">
      <div class="status-badge" :class="{ success: isCorrect, warning: !isCorrect }">
        <Icon :icon="isCorrect ? 'mdi:check-circle' : 'mdi:alert-circle-outline'" class="status-icon" />
        <span class="status-text">
          {{ isCorrect ? t('plugins.dialogue-trainer.perfectSpoken') : t('plugins.dialogue-trainer.needsImprovement') }}
        </span>
      </div>
    </div>

    <div v-if="correctedSentence && !isCorrect" class="correction-section">
      <span class="section-label">
        <Icon icon="mdi:auto-fix" />
        {{ t('plugins.dialogue-trainer.correctVariant') }}
      </span>
      <div
        class="corrected-text"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @click="onWordClick"
      >
        <span
          v-for="(sent, sentIdx) in tokenizedCorrectionSentences"
          :key="sent.sentId"
          class="sentence"
          :data-sent-id="sent.sentId"
          :data-raw-sent="encodeURIComponent(sent.rawSent)"
        >
          <template
            v-for="(tkn, tIdx) in sent.tokens"
            :key="tIdx"
          >
            <span
              class="word"
              :class="[
                tkn.isPunct ? 'is-punctuation' : '',
                { 'is-active': isWordActive(sent.sentId, tkn.tokenIdx, tkn.isPunct) },
              ]"
              :data-word="encodeURIComponent(tkn.word)"
              :data-pos="tkn.pos"
              :data-sent-id="sent.sentId"
              :data-token-idx="tkn.tokenIdx"
            >{{ tkn.word }}</span>{{ tkn.spacingClass === 'add-space' ? ' ' : '' }}
          </template>

          <span
            v-if="sentIdx === tokenizedCorrectionSentences.length - 1"
            class="sentence-inline-actions"
            @pointerdown.stop
            @click.stop
          >
            <KitTooltip :text="t('plugins.dialogue-trainer.listenCorrection')">
              <button
                type="button"
                class="sentence-action-btn"
                :class="{ 'is-playing': isPlayingAudio, 'is-loading': isLoadingAudio }"
                :aria-label="t('plugins.dialogue-trainer.listenCorrection')"
                @click.stop="emit('playCorrection')"
              >
                <Icon
                  :icon="isLoadingAudio ? 'mdi:loading' : (isPlayingAudio ? 'mdi:pause' : 'mdi:volume-high')"
                  :class="{ 'spin-icon': isLoadingAudio }"
                />
              </button>
            </KitTooltip>

            <KitTooltip
              v-if="correctedTranscription"
              :text="isTranscriptionVisible
                ? t('plugins.dialogue-trainer.hideTranscriptionSentence')
                : t('plugins.dialogue-trainer.transcriptionSentence')"
            >
              <button
                type="button"
                class="sentence-action-btn"
                :class="{ 'is-active': isTranscriptionVisible }"
                :aria-label="isTranscriptionVisible
                  ? t('plugins.dialogue-trainer.hideTranscriptionSentence')
                  : t('plugins.dialogue-trainer.transcriptionSentence')"
                @click.stop="toggleTranscription"
              >
                <Icon icon="mdi:alphabet-latin" />
              </button>
            </KitTooltip>
          </span>
        </span>
      </div>

      <transition name="transcription-fade">
        <div
          v-if="isTranscriptionVisible"
          class="corrected-transcription"
          @pointerdown.stop
        >
          <span class="transcription-badge">{{ targetLanguage === 'zh' ? 'PY' : 'IPA' }}</span>
          <span class="transcription-text">{{ correctedTranscription }}</span>
        </div>
      </transition>
    </div>

    <div v-if="feedback" class="analysis-section">
      <span class="section-label">
        <Icon icon="mdi:lightbulb-outline" />
        {{ t('plugins.dialogue-trainer.mistakeAnalysis') }}
      </span>
      <p class="feedback-text">
        {{ feedback }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.feedback-card {
  margin-bottom: 12px;
  padding: 6px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.is-correct {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.05);
  }

  &.needs-work {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.06);
  }
}

.feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;

  &.success {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(22, 163, 74);
  }

  &.warning {
    background: rgba(245, 158, 11, 0.15);
    color: rgb(217, 119, 6);
  }

  .status-icon {
    font-size: 1rem;
  }
}

.sentence-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
  vertical-align: middle;
  user-select: none;
}

.sentence-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.06));
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background-color: var(--bg-active-color, rgba(99, 102, 241, 0.15));
    color: var(--fg-accent-color);
    transform: scale(1.08);
  }

  &.is-playing,
  &.is-active {
    background-color: var(--fg-accent-color);
    color: #fff;
  }
}

.corrected-transcription {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  margin-top: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(var(--fg-accent-color-rgb), 0.08);
  border: 1px dashed rgba(var(--fg-accent-color-rgb), 0.28);
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  line-height: 1.45;
  max-width: 100%;

  .transcription-badge {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(var(--fg-accent-color-rgb), 0.16);
    color: var(--fg-accent-color);
    flex-shrink: 0;
    user-select: none;
  }

  .transcription-text {
    font-family: var(--app-font-family, 'Maple Mono CN', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    letter-spacing: 0.02em;
    color: var(--fg-primary-color);
    opacity: 0.88;
    overflow-wrap: break-word;
  }
}

.transcription-fade-enter-active,
.transcription-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.transcription-fade-enter-from,
.transcription-fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--fg-secondary-color);
  margin-bottom: 4px;
}

.corrected-text {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.45;
  user-select: text;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: normal;

  .sentence {
    display: inline;
    position: relative;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    overflow-wrap: break-word;
    word-break: normal;

    &:hover {
      background-color: var(--bg-hover-color);
    }
  }

  .word {
    cursor: pointer;
    padding: 1px 2px;
    border-radius: 4px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
    overflow-wrap: break-word;

    &:not(.is-punctuation):hover {
      background-color: rgba(var(--fg-accent-color-rgb), 0.18);
      color: var(--fg-accent-color);
    }

    &.is-active {
      background-color: var(--fg-accent-color);
      color: var(--bg-primary-color);
      font-weight: 700;
    }

    &.is-punctuation {
      cursor: default;
      padding: 0;
    }
  }
}

.feedback-text {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-secondary-color);
  line-height: 1.45;
  white-space: pre-line;
}
</style>
