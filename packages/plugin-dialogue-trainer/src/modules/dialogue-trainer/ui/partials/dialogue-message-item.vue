<script setup lang="ts">
import type { DialogueMessage } from '../../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'
import DialogueFeedbackCard from './dialogue-feedback-card.vue'

interface Props {
  message: DialogueMessage
  targetLanguage: string
  isPlayingReply: boolean
  isPlayingCorrection: boolean
  isLoadingAudio: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'playReply'): void
  (e: 'playCorrection'): void
}>()

const { t } = useI18n()
const showTranslation = ref(false)
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
        <p class="message-text">
          {{ message.content }}
        </p>

        <!-- Assistant Action Buttons (Audio + Translation) -->
        <div v-if="message.role === 'assistant'" class="assistant-actions">
          <KitBtn
            size="xs"
            variant="text"
            :icon="isPlayingReply ? 'mdi:pause' : 'mdi:volume-high'"
            :loading="isLoadingAudio && isPlayingReply"
            :color="isPlayingReply ? 'primary' : undefined"
            class="audio-btn"
            :aria-label="t('plugins.dialogue-trainer.listenReply')"
            @click="emit('playReply')"
          >
            {{ t('plugins.dialogue-trainer.listenReply') }}
          </KitBtn>

          <KitBtn
            v-if="message.replyTranslation"
            size="xs"
            variant="text"
            :icon="showTranslation ? 'mdi:translate-off' : 'mdi:translate'"
            class="translation-btn"
            @click="showTranslation = !showTranslation"
          >
            {{ showTranslation ? t('plugins.dialogue-trainer.hideTranslation') : t('plugins.dialogue-trainer.showTranslation') }}
          </KitBtn>
        </div>

        <!-- Translation Drawer -->
        <div v-if="showTranslation && message.replyTranslation" class="translation-block">
          <Icon icon="mdi:format-quote-close" class="quote-icon" />
          <span class="translation-text">{{ message.replyTranslation }}</span>
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
      background: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.12);
      border: 1px solid rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.25);
      border-radius: 18px 18px 4px 18px;

      .message-text {
        color: var(--fg-primary-color);
        font-size: 0.98rem;
        font-weight: 500;
        line-height: 1.5;
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
        border-color: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.35);

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
            rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.3),
            var(--fg-accent-color),
            rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.3),
            transparent
          );
          background-size: 200% 100%;
          animation: border-pulse-stream 1.6s linear infinite;
          z-index: 10;
        }
      }

      .message-text {
        color: var(--fg-primary-color);
        font-size: 1.02rem;
        font-weight: 500;
        line-height: 1.55;
      }
    }
  }
}

@keyframes border-pulse-stream {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.bubble-loading-placeholder {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fg-accent-color);
    animation: typing-dot 1.4s infinite ease-in-out;

    &.dot-1 {
      animation-delay: 0s;
    }
    &.dot-2 {
      animation-delay: 0.2s;
    }
    &.dot-3 {
      animation-delay: 0.4s;
    }
  }

  .loading-label {
    margin-left: 6px;
    font-size: 0.84rem;
    color: var(--fg-secondary-color);
  }
}

@keyframes typing-dot {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.bubble {
  padding: 12px;
  position: relative;
  word-break: break-word;
}

.message-text {
  margin: 0;
}

.assistant-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.translation-block {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-tertiary-color);
  border-left: 3px solid var(--fg-accent-color);
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: flex-start;
  gap: 6px;

  .quote-icon {
    font-size: 0.9rem;
    color: var(--fg-accent-color);
    margin-top: 2px;
    flex-shrink: 0;
  }

  .translation-text {
    line-height: 1.45;
  }
}

.audio-btn,
.translation-btn {
  font-size: 0.78rem !important;
  padding: 2px 6px !important;
  height: 26px !important;
}
</style>
