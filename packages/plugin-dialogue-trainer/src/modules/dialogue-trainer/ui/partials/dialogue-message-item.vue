<script setup lang="ts">
import type { TokenizedSentence } from '../../../../shared/lib/dialogue-tokenizer'
import type { DialogueMessage } from '../../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTextSelection } from '~/04.features/analysis'
import { tokenizeDialogueText, tokenizeDialogueTextServer } from '../../../../shared/lib/dialogue-tokenizer'
import DialogueFeedbackCard from './dialogue-feedback-card.vue'

interface Props {
  message: DialogueMessage
  targetLanguage: string
  isPlayingReply: boolean
  isPlayingCorrection: boolean
  isLoadingAudio: boolean
  isSentencePlaying?: (msgId: string, idx: number) => boolean
  isSentenceLoading?: (msgId: string, idx: number) => boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'playCorrection'): void
  (e: 'playSentence', sentenceIdx: number, text: string): void
}>()

const { t } = useI18n()
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const visibleTranslations = ref<Record<number, boolean>>({})
const serverSentences = ref<TokenizedSentence[] | null>(null)

// Tokenize text into sentences and words for click/long-press interactions
const tokenizedSentences = computed(() => {
  if (serverSentences.value?.length) {
    return serverSentences.value
  }

  if (!props.message.content) {
    return []
  }

  return tokenizeDialogueText(props.message.content, props.targetLanguage, 1000)
})

watch(() => [props.message.content, props.targetLanguage], async () => {
  if (props.message.tokenizedSentences?.length) {
    serverSentences.value = props.message.tokenizedSentences

    return
  }

  if (!props.message.content) {
    serverSentences.value = []

    return
  }

  serverSentences.value = await tokenizeDialogueTextServer(props.message.content, props.targetLanguage, 1000)
}, { immediate: true })

function checkSentencePlaying(idx: number): boolean {
  if (props.isSentencePlaying) {
    return props.isSentencePlaying(props.message.id, idx)
  }

  return props.isPlayingReply
}

function checkSentenceLoading(idx: number): boolean {
  if (props.isSentenceLoading) {
    return props.isSentenceLoading(props.message.id, idx)
  }

  return false
}

function toggleSentenceTranslation(idx: number) {
  visibleTranslations.value[idx] = !visibleTranslations.value[idx]
}

function hasTranslation(idx: number): boolean {
  if (props.message.replySentences?.[idx]?.translation) {
    return true
  }

  if (tokenizedSentences.value.length === 1 && props.message.replyTranslation) {
    return true
  }

  return Boolean(props.message.replyTranslation)
}

function getSentenceTranslation(idx: number): string {
  if (props.message.replySentences?.[idx]?.translation) {
    return props.message.replySentences[idx].translation
  }

  return props.message.replyTranslation || ''
}
</script>

<template>
  <div class="message-row" :class="[message.role]">
    <!-- Message Bubble -->
    <div
      class="bubble"
      :class="[
        message.role,
        { 'is-loading': message.isLoading },
      ]"
    >
      <!-- Feedback Card for Assistant Messages -->
      <DialogueFeedbackCard
        v-if="message.role === 'assistant' && (message.feedback || message.correctedSentence || message.isCorrect !== undefined)"
        :is-correct="message.isCorrect"
        :feedback="message.feedback"
        :corrected-sentence="message.correctedSentence"
        :target-language="targetLanguage"
        :is-playing-audio="isPlayingCorrection"
        :is-loading-audio="isLoadingAudio"
        @play-correction="emit('playCorrection')"
      />

      <!-- In-bubble Loading Placeholder (before content arrives) -->
      <div v-if="message.isLoading && !message.content" class="bubble-loading-placeholder">
        <span class="pulse-dot dot-1" />
        <span class="pulse-dot dot-2" />
        <span class="pulse-dot dot-3" />
        <span class="loading-label">{{ t('plugins.dialogue-trainer.analyzing', 'Анализирую ответ...') }}</span>
      </div>

      <!-- Dialogue Content -->
      <div v-else class="dialogue-content">
        <div
          class="message-text"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @click="onWordClick"
        >
          <div
            v-for="sentence in tokenizedSentences"
            :key="sentence.sentId"
            class="sentence-wrapper"
          >
            <span
              class="sentence"
              :data-sent-id="sentence.sentId"
              :data-raw-sent="encodeURIComponent(sentence.rawSent)"
            >
              <template
                v-for="(token, tIdx) in sentence.tokens"
                :key="tIdx"
              >
                <span
                  class="word"
                  :class="[token.isPunct ? 'is-punctuation' : '']"
                  :data-word="encodeURIComponent(token.word)"
                  :data-pos="token.pos"
                  :data-sent-id="sentence.sentId"
                  :data-token-idx="token.tokenIdx"
                >{{ token.word }}</span>{{ token.spacingClass === 'add-space' ? ' ' : '' }}
              </template>

              <!-- Sentence Actions at end of sentence (Audio & Translate icons without text) -->
              <span v-if="message.role === 'assistant'" class="sentence-inline-actions">
                <button
                  type="button"
                  class="sentence-action-btn audio-btn"
                  :class="{ 'is-playing': checkSentencePlaying(sentence.index) }"
                  :disabled="checkSentenceLoading(sentence.index)"
                  :aria-label="t('plugins.dialogue-trainer.listenSentence', 'Озвучить предложение')"
                  @pointerdown.stop
                  @click.stop="emit('playSentence', sentence.index, sentence.rawSent)"
                >
                  <Icon
                    :icon="checkSentenceLoading(sentence.index)
                      ? 'mdi:loading'
                      : (checkSentencePlaying(sentence.index) ? 'mdi:pause' : 'mdi:volume-high')"
                    :class="{ 'spin-icon': checkSentenceLoading(sentence.index), 'pulse-icon': checkSentencePlaying(sentence.index) }"
                  />
                </button>

                <button
                  v-if="hasTranslation(sentence.index)"
                  type="button"
                  class="sentence-action-btn translate-btn"
                  :class="{ 'is-active': visibleTranslations[sentence.index] }"
                  :aria-label="t('plugins.dialogue-trainer.translateSentence', 'Перевести предложение')"
                  @pointerdown.stop
                  @click.stop="toggleSentenceTranslation(sentence.index)"
                >
                  <Icon :icon="visibleTranslations[sentence.index] ? 'mdi:translate-off' : 'mdi:translate'" />
                </button>
              </span>
            </span>

            <!-- Sentence translation box under each sentence -->
            <transition name="sentence-fade">
              <div
                v-if="message.role === 'assistant' && visibleTranslations[sentence.index]"
                class="sentence-translation-box"
                @pointerdown.stop
              >
                <Icon icon="mdi:format-quote-close" class="quote-icon" />
                <span class="translation-text">{{ getSentenceTranslation(sentence.index) }}</span>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-row {
  display: flex;
  width: 100%;
  margin-bottom: 12px;

  &.user {
    justify-content: flex-end;

    .bubble {
      max-width: 86%;
      background: rgba(var(--fg-accent-color-rgb), 0.12);
      border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);
      border-radius: 18px 18px 4px 18px;

      .message-text {
        color: var(--fg-primary-color);
        font-size: 0.98rem;
        font-weight: 500;
        line-height: 1.55;
      }
    }
  }

  &.assistant {
    justify-content: flex-start;

    .bubble {
      max-width: 90%;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: 18px 18px 18px 4px;
      position: relative;
      overflow: hidden;

      &.is-loading {
        border-color: rgba(var(--fg-accent-color-rgb), 0.35);

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(var(--fg-accent-color-rgb), 0.3),
            var(--fg-accent-color),
            rgba(var(--fg-accent-color-rgb), 0.3),
            transparent
          );
          animation: scan 1.8s infinite ease-in-out;
        }
      }
    }
  }
}

.bubble {
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: border-color 0.2s ease;
}

.bubble-loading-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  color: var(--fg-muted-color);
  font-size: 0.88rem;

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fg-accent-color);
    animation: bounce 1.4s infinite ease-in-out both;

    &.dot-1 {
      animation-delay: -0.32s;
    }
    &.dot-2 {
      animation-delay: -0.16s;
    }
  }

  .loading-label {
    margin-left: 4px;
    font-style: italic;
  }
}

.dialogue-content {
  display: flex;
  flex-direction: column;
}

.message-text {
  font-size: 0.98rem;
  line-height: 1.55;
  color: var(--fg-primary-color);
  user-select: text;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: normal;
}

.sentence-wrapper {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: normal;
}

.sentence {
  position: relative;
  border-radius: 4px;
  transition: background-color 0.15s ease;
  overflow-wrap: break-word;
  word-break: normal;

  &:hover {
    background-color: rgba(var(--fg-accent-color-rgb), 0.04);
  }
}

.word {
  cursor: pointer;
  border-radius: 3px;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:hover:not(.is-punctuation) {
    background-color: rgba(var(--fg-accent-color-rgb), 0.18);
    color: var(--fg-accent-color);
  }

  &.is-punctuation {
    cursor: default;
  }
}

.sentence-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
  vertical-align: middle;
  user-select: none;
  white-space: nowrap;
}

.sentence-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: rgba(var(--bg-tertiary-color-rgb), 0.4);
  color: var(--fg-secondary-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.3;

  &:hover {
    opacity: 1;
    background: rgba(var(--fg-accent-color-rgb), 0.2);
    color: var(--fg-accent-color);
  }

  &.is-playing {
    background: var(--fg-accent-color);
    color: var(--bg-primary-color);
  }

  &.is-active {
    background: var(--fg-accent-color);
    color: var(--bg-primary-color);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.sentence-translation-box {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 0 8px 0;
  padding: 6px 10px;
  background: rgba(var(--fg-accent-color-rgb), 0.08);
  border-left: 3px solid var(--fg-accent-color);
  border-radius: 0 8px 8px 0;
  color: var(--fg-secondary-color);
  font-size: 0.88rem;
  line-height: 1.45;

  .quote-icon {
    font-size: 14px;
    margin-top: 2px;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .translation-text {
    font-style: italic;
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

.pulse-icon {
  animation: pulse 1.2s infinite ease-in-out;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
  }
}

@keyframes scan {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.sentence-fade-enter-active,
.sentence-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.sentence-fade-enter-from,
.sentence-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
