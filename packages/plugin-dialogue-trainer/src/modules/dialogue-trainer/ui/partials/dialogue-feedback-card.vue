<script setup lang="ts">
import type { TokenizedSentence } from '../../../../shared/lib/dialogue-tokenizer'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitTooltip } from '~/02.kit'
import { useTextSelection } from '~/04.features/analysis'
import { tokenizeDialogueText, tokenizeDialogueTextServer } from '../../../../shared/lib/dialogue-tokenizer'

interface Props {
  isCorrect?: boolean
  feedback?: string
  correctedSentence?: string
  targetLanguage: string
  isPlayingAudio: boolean
  isLoadingAudio: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'playCorrection'): void
}>()

const { t } = useI18n()
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const serverSentences = ref<TokenizedSentence[] | null>(null)

const tokenizedCorrectionSentences = computed(() => {
  if (serverSentences.value?.length) {
    return serverSentences.value
  }

  if (!props.correctedSentence) {
    return []
  }

  return tokenizeDialogueText(props.correctedSentence, props.targetLanguage, 5000)
})

watch(() => [props.correctedSentence, props.targetLanguage], async () => {
  if (!props.correctedSentence) {
    serverSentences.value = []

    return
  }

  serverSentences.value = await tokenizeDialogueTextServer(props.correctedSentence, props.targetLanguage, 5000)
}, { immediate: true })
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
              :class="[tkn.isPunct ? 'is-punctuation' : '']"
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
          </span>
        </span>
      </div>
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

  &.is-playing {
    background-color: var(--fg-accent-color);
    color: #fff;
  }
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
    overflow-wrap: break-word;
    word-break: normal;
  }

  .word {
    cursor: pointer;
    overflow-wrap: break-word;

    &.is-punctuation {
      cursor: default;
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
