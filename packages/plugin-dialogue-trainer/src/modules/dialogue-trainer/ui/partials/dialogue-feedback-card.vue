<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitTooltip } from '~/02.kit'
import { useTextSelection } from '~/04.features/analysis'
import { tokenizeDialogueText } from '../../../../shared/lib/dialogue-tokenizer'

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

const tokenizedCorrectionSentences = computed(() => {
  if (!props.correctedSentence) {
    return []
  }

  return tokenizeDialogueText(props.correctedSentence, props.targetLanguage, 5000)
})
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

      <KitTooltip v-if="correctedSentence" :text="t('plugins.dialogue-trainer.listenCorrection')">
        <KitBtn
          size="xs"
          variant="tonal"
          :icon="isPlayingAudio ? 'mdi:pause' : 'mdi:volume-high'"
          :loading="isLoadingAudio"
          :aria-label="t('plugins.dialogue-trainer.listenCorrection')"
          class="play-correction-btn"
          @click="emit('playCorrection')"
        />
      </KitTooltip>
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
          v-for="sent in tokenizedCorrectionSentences"
          :key="sent.sentId"
          class="sentence"
          :data-sent-id="sent.sentId"
          :data-raw-sent="encodeURIComponent(sent.rawSent)"
        >
          <span
            v-for="(tkn, tIdx) in sent.tokens"
            :key="tIdx"
            class="word"
            :class="[tkn.isPunct ? 'is-punctuation' : tkn.spacingClass]"
            :data-word="encodeURIComponent(tkn.word)"
            :data-pos="tkn.pos"
            :data-sent-id="sent.sentId"
            :data-token-idx="tkn.tokenIdx"
          >{{ tkn.word }}</span>
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

.play-correction-btn {
  width: 26px !important;
  height: 26px !important;
  min-width: 26px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0;

  :deep(.kit-btn-icon) {
    margin: 0 !important;
    font-size: 0.95rem;
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

  .sentence {
    position: relative;
    border-radius: 4px;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.04);
    }
  }

  .word {
    cursor: pointer;
    border-radius: 3px;
    transition: background-color 0.12s ease, color 0.12s ease;

    &:hover:not(.is-punctuation) {
      background-color: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.18);
      color: var(--fg-accent-color);
    }

    &.is-punctuation {
      cursor: default;
    }

    &.add-space {
      padding-right: 0.25em;
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
