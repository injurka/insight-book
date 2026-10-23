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
    <div class="bubble" :class="[message.role]">
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

      <!-- Dialogue Content -->
      <div class="dialogue-content">
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

      .message-text {
        color: var(--fg-primary-color);
        font-size: 1.02rem;
        font-weight: 500;
        line-height: 1.55;
      }
    }
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
