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

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)

  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="message-row" :class="[message.role]">
    <!-- Avatar -->
    <div class="avatar-col">
      <div class="avatar" :class="[message.role]">
        <Icon :icon="message.role === 'user' ? 'mdi:account' : 'mdi:robot-happy-outline'" />
      </div>
    </div>

    <!-- Message Bubble -->
    <div class="bubble-col">
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
              variant="tonal"
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

        <!-- Meta Footer -->
        <div class="bubble-meta">
          <Icon v-if="message.role === 'user'" icon="mdi:microphone" class="meta-mic-icon" />
          <span class="meta-time">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.message-row {
  display: flex;
  gap: 12px;
  width: 100%;
  margin-bottom: 18px;

  &.user {
    flex-direction: row-reverse;
  }
}

.avatar-col {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;

  &.user {
    background: var(--bg-accent-color, #3b82f6);
    color: #fff;
  }

  &.assistant {
    background: var(--bg-tertiary-color);
    color: var(--fg-accent-color);
    border: 1px solid var(--border-secondary-color);
  }
}

.bubble-col {
  max-width: 82%;
  min-width: 160px;
}

.bubble {
  padding: 14px 16px;
  border-radius: 16px;
  position: relative;
  word-break: break-word;

  &.user {
    background: var(--bg-accent-color, #3b82f6);
    color: #fff;
    border-bottom-right-radius: 4px;

    .message-text {
      color: #fff;
      font-size: 0.98rem;
      line-height: 1.5;
    }

    .meta-time {
      color: rgba(255, 255, 255, 0.7);
    }

    .meta-mic-icon {
      color: rgba(255, 255, 255, 0.7);
    }
  }

  &.assistant {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-bottom-left-radius: 4px;

    .message-text {
      color: var(--fg-primary-color);
      font-size: 1.02rem;
      font-weight: 500;
      line-height: 1.55;
    }

    .meta-time {
      color: var(--fg-tertiary-color);
    }
  }
}

.message-text {
  margin: 0;
}

.assistant-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.translation-block {
  margin-top: 10px;
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
    font-size: 1rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.bubble-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
  font-size: 0.72rem;
}
</style>
