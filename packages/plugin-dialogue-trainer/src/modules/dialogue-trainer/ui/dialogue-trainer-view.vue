<script setup lang="ts">
import type { DialogueMessage, DialogueSession, DialogueSettings } from '../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/02.kit'
import { useDialogueRecorder } from '../composables/use-dialogue-recorder'
import { useDialogueSession } from '../composables/use-dialogue-session'
import DialogueHeader from './partials/dialogue-header.vue'
import DialogueHistoryDrawer from './partials/dialogue-history-drawer.vue'
import DialogueMessageItem from './partials/dialogue-message-item.vue'
import DialogueRecorder from './partials/dialogue-recorder.vue'
import DialogueSetupModal from './partials/dialogue-setup-modal.vue'

const { t } = useI18n()
const {
  sessions,
  currentSession,
  activeMessages,
  currentSettings,
  isGenerating,
  isAiStarting,
  currentError,
  tts,
  initSession,
  createNewSession,
  selectSession,
  sendUserMessage,
  startAiConversation,
  playMessageSentence,
  deleteCurrentSession,
  updateSettings,
  removeSession,
} = useDialogueSession()
const recorder = useDialogueRecorder()

const chatContainerRef = ref<HTMLElement | null>(null)
const textInput = ref('')
const isSetupModalOpen = ref(false)
const isHistoryDrawerOpen = ref(false)
const isConfirmDeleteDialogOpen = ref(false)
const isHandsFreeMode = ref(false)
const playingCorrectionId = ref<string | null>(null)
let handsFreeRestartTimer: ReturnType<typeof setTimeout> | null = null

// Auto-scroll chat to bottom
watch(() => [activeMessages.value.length, isGenerating.value, isAiStarting.value], async () => {
  await nextTick()

  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
})

function clearHandsFreeTimer() {
  if (handsFreeRestartTimer) {
    clearTimeout(handsFreeRestartTimer)
    handsFreeRestartTimer = null
  }
}
function handleAudioFinished() {
  if (isHandsFreeMode.value && !recorder.isRecording.value && !isGenerating.value) {
    clearHandsFreeTimer()
    handsFreeRestartTimer = setTimeout(() => {
      handsFreeRestartTimer = null

      if (isHandsFreeMode.value && !recorder.isRecording.value && !isGenerating.value) {
        handleStartRecording()
      }
    }, 450)
  }
}
async function handleSendMessage() {
  const text = textInput.value.trim()

  if (!text || isGenerating.value) {
    return
  }

  clearHandsFreeTimer()
  isHandsFreeMode.value = false
  textInput.value = ''
  await sendUserMessage(text, handleAudioFinished)
}
async function handleStartRecording() {
  clearHandsFreeTimer()
  tts.stopAudio()
  await recorder.startRecording(async () => {
    if (recorder.isRecording.value && isHandsFreeMode.value) {
      await handleStopRecording()
    }
  }, 1600)
}
async function handleStopRecording() {
  clearHandsFreeTimer()
  const language = currentSettings.value.targetLanguage
  const transcribedText = await recorder.stopRecording(language)

  if (transcribedText) {
    await sendUserMessage(transcribedText, handleAudioFinished)
  }
  else if (isHandsFreeMode.value) {
    isHandsFreeMode.value = false
  }
}
async function handleToggleHandsFree() {
  clearHandsFreeTimer()
  isHandsFreeMode.value = !isHandsFreeMode.value

  if (isHandsFreeMode.value && !recorder.isRecording.value && !isGenerating.value) {
    await handleStartRecording()
  }
}
function handleCancelRecording() {
  clearHandsFreeTimer()
  recorder.cancelRecording()
  isHandsFreeMode.value = false
}
function handleOpenSettings() {
  isSetupModalOpen.value = true
}
function handleOpenHistory() {
  isHistoryDrawerOpen.value = true
}
function handleNewDialogue() {
  createNewSession()
  isSetupModalOpen.value = true
}
function handleDeleteDialogue() {
  isConfirmDeleteDialogOpen.value = true
}
async function confirmDeleteCurrentSession() {
  isConfirmDeleteDialogOpen.value = false
  await deleteCurrentSession()
}
function handleApplySettings(newSettings: DialogueSettings) {
  updateSettings(newSettings)
}
function handleToggleAutoExpandTranslations() {
  updateSettings({
    autoExpandTranslations: !currentSettings.value.autoExpandTranslations,
  })
}
function handleSelectSession(session: DialogueSession) {
  selectSession(session)
}
async function handleDeleteSessionFromHistory(id: string) {
  await removeSession(id)
}
async function handlePlayReply(msg: DialogueMessage) {
  playingCorrectionId.value = null
  const audio = await tts.playAudio(
    msg.id,
    msg.content,
    currentSettings.value.targetLanguage,
    msg.audioBase64,
    undefined,
    handleAudioFinished,
  )

  if (audio && !msg.audioBase64 && currentSession.value) {
    msg.audioBase64 = audio
  }
}
async function handlePlayCorrection(msg: DialogueMessage) {
  if (!msg.correctedSentence) {
    return
  }

  playingCorrectionId.value = msg.id
  await tts.playAudio(`corr_${msg.id}`, msg.correctedSentence, currentSettings.value.targetLanguage)
}
async function handlePlaySentence(msg: DialogueMessage, idx: number, text: string) {
  playingCorrectionId.value = null
  await playMessageSentence(msg, idx, text)
}

onMounted(async () => {
  await initSession()
})
onUnmounted(() => {
  clearHandsFreeTimer()
  tts.stopAudio()
  recorder.cancelRecording()
  isHandsFreeMode.value = false
})
</script>

<template>
  <div class="dialogue-trainer-page">
    <!-- Header -->
    <DialogueHeader
      :settings="currentSettings"
      :has-messages="activeMessages.length > 0"
      :volume="tts.volume.value"
      @update:volume="tts.setVolume"
      @open-settings="handleOpenSettings"
      @open-history="handleOpenHistory"
      @new-dialogue="handleNewDialogue"
      @delete-dialogue="handleDeleteDialogue"
      @toggle-auto-expand-translations="handleToggleAutoExpandTranslations"
    />

    <!-- Chat Messages Scroll Container -->
    <div ref="chatContainerRef" class="chat-container">
      <!-- Empty State -->
      <div v-if="activeMessages.length === 0" class="empty-state">
        <div class="empty-card">
          <div class="empty-icon-wrapper">
            <Icon icon="mdi:account-voice" class="empty-hero-icon" />
          </div>
          <h2 class="empty-title">
            {{ t('plugins.dialogue-trainer.emptyChatTitle') }}
          </h2>
          <p class="empty-subtitle">
            {{ t('plugins.dialogue-trainer.emptyChatSubtitle') }}
          </p>

          <div class="empty-divider" />

          <p class="empty-ai-prompt">
            {{ t('plugins.dialogue-trainer.emptyChatAiStart') }}
          </p>
          <KitBtn
            variant="solid"
            color="primary"
            icon="mdi:robot-happy"
            size="md"
            :loading="isAiStarting"
            class="ai-start-btn"
            @click="startAiConversation(handleAudioFinished)"
          >
            {{ t('plugins.dialogue-trainer.aiStartBtn') }}
          </KitBtn>
        </div>
      </div>

      <!-- Messages Stream -->
      <div v-else class="messages-list">
        <DialogueMessageItem
          v-for="msg in activeMessages"
          :key="msg.id"
          :message="msg"
          :target-language="currentSettings.targetLanguage"
          :auto-expand-translations="Boolean(currentSettings.autoExpandTranslations)"
          :is-playing-reply="tts.currentPlayingId.value === msg.id && tts.isPlaying.value"
          :is-playing-correction="tts.currentPlayingId.value === `corr_${msg.id}` && tts.isPlaying.value"
          :is-loading-audio="tts.isLoadingAudio.value"
          :is-sentence-playing="tts.isSentencePlaying"
          :is-sentence-loading="tts.isSentenceLoading"
          @play-reply="handlePlayReply(msg)"
          @play-correction="handlePlayCorrection(msg)"
          @play-sentence="(idx, text) => handlePlaySentence(msg, idx, text)"
        />

        <!-- Error Notification -->
        <div v-if="currentError || recorder.errorMessage.value" class="error-banner">
          <Icon icon="mdi:alert-circle-outline" />
          <span>{{ currentError || (recorder.errorMessage.value ? t(`plugins.dialogue-trainer.${recorder.errorMessage.value}`) : '') }}</span>
        </div>
      </div>
    </div>

    <!-- Bottom Input Bar -->
    <footer class="input-footer">
      <div class="input-bar" :class="{ 'is-recording': recorder.isRecording.value || recorder.isTranscribing.value }">
        <!-- Voice Recorder when Active or Transcribing -->
        <DialogueRecorder
          v-if="recorder.isRecording.value || recorder.isTranscribing.value"
          :is-recording="recorder.isRecording.value"
          :is-transcribing="recorder.isTranscribing.value"
          :duration-seconds="recorder.recordingDuration.value"
          :audio-level="recorder.currentAudioLevel.value"
          :is-hands-free="isHandsFreeMode"
          :disabled="isGenerating || isAiStarting"
          @start="handleStartRecording"
          @stop="handleStopRecording"
          @cancel="handleCancelRecording"
          @toggle-hands-free="handleToggleHandsFree"
        />

        <!-- Idle Chat Input Capsule (Unified, Spacious & Mobile-Aesthetic) -->
        <div v-else class="chat-input-capsule">
          <KitTooltip :text="t('plugins.dialogue-trainer.handsFreeTooltip')">
            <button
              type="button"
              class="capsule-btn handsfree-btn"
              :class="{ active: isHandsFreeMode }"
              :disabled="isGenerating || isAiStarting"
              :aria-label="t('plugins.dialogue-trainer.handsFreeMode')"
              @click="handleToggleHandsFree"
            >
              <Icon :icon="isHandsFreeMode ? 'mdi:headset' : 'mdi:headset-off'" />
            </button>
          </KitTooltip>

          <input
            v-model="textInput"
            type="text"
            class="capsule-input"
            :placeholder="t('plugins.dialogue-trainer.inputPlaceholder')"
            :disabled="isGenerating || isAiStarting"
            @keyup.enter="handleSendMessage"
          >

          <transition name="btn-swap" mode="out-in">
            <button
              v-if="textInput.trim()"
              key="send"
              type="button"
              class="capsule-btn action-send-btn"
              :disabled="isGenerating || isAiStarting"
              :aria-label="t('plugins.dialogue-trainer.send')"
              @click="handleSendMessage"
            >
              <Icon icon="mdi:send" />
            </button>

            <button
              v-else
              key="mic"
              type="button"
              class="capsule-btn action-mic-btn"
              :disabled="isGenerating || isAiStarting"
              :aria-label="t('plugins.dialogue-trainer.speakTooltip')"
              @click="handleStartRecording"
            >
              <Icon icon="mdi:microphone" />
            </button>
          </transition>
        </div>
      </div>
    </footer>

    <!-- Modals -->
    <DialogueSetupModal
      v-model:visible="isSetupModalOpen"
      :settings="currentSettings"
      @start="handleApplySettings"
    />

    <DialogueHistoryDrawer
      v-model:visible="isHistoryDrawerOpen"
      :sessions="sessions"
      :active-session-id="currentSession?.id ?? null"
      @select="handleSelectSession"
      @delete="handleDeleteSessionFromHistory"
      @new="handleNewDialogue"
    />

    <KitDialog
      v-model:visible="isConfirmDeleteDialogOpen"
      :title="t('plugins.dialogue-trainer.deleteSession')"
      icon="mdi:delete-alert-outline"
      :max-width="420"
      :minimizable="false"
    >
      <div class="confirm-delete-body">
        <p>{{ t('plugins.dialogue-trainer.confirmDeleteSession') }}</p>
        <div class="confirm-delete-actions">
          <KitBtn variant="tonal" @click="isConfirmDeleteDialogOpen = false">
            {{ t('plugins.dialogue-trainer.cancel') }}
          </KitBtn>
          <KitBtn color="error" variant="solid" @click="confirmDeleteCurrentSession">
            {{ t('plugins.dialogue-trainer.deleteSession') }}
          </KitBtn>
        </div>
      </div>
    </KitDialog>
  </div>
</template>

<style lang="scss" scoped>
.dialogue-trainer-page {
  display: flex;
  flex-direction: column;
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  overflow: hidden;
}

.chat-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px max(24px, env(safe-area-inset-right, 0px)) 20px max(24px, env(safe-area-inset-left, 0px));

  @media (max-width: 600px) {
    padding: 14px max(12px, env(safe-area-inset-right, 0px)) 14px max(12px, env(safe-area-inset-left, 0px));
  }
}

.messages-list {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80%;
  padding: 20px;
}

.empty-card {
  max-width: 520px;
  text-align: center;
  padding: 36px 28px;
  border-radius: 20px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--bg-tertiary-color);
  color: var(--fg-accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.empty-hero-icon {
  font-size: 2rem;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.empty-subtitle {
  margin: 0;
  font-size: 0.92rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.empty-divider {
  height: 1px;
  background: var(--border-secondary-color);
  margin: 24px 0;
}

.empty-ai-prompt {
  margin: 0 0 12px;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.ai-start-btn {
  margin: 0 auto;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-top: 10px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgb(239, 68, 68);
  font-size: 0.88rem;
}

.input-footer {
  min-height: 67px;
  padding: 10px max(16px, env(safe-area-inset-right, 0px))
    max(14px, calc(10px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))))
    max(16px, env(safe-area-inset-left, 0px));
  background: var(--bg-primary-color);
  border-top: 1px solid var(--border-secondary-color);

  @media (max-width: 600px) {
    padding: 8px max(16px, env(safe-area-inset-right, 0px))
      max(12px, calc(8px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))))
      max(16px, env(safe-area-inset-left, 0px));
  }
}

.input-bar {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-input-capsule {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 860px;
  height: 50px;
  padding: 4px 6px 4px 8px;
  box-sizing: border-box;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus-within {
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 2px rgba(var(--fg-accent-color-rgb), 0.15);
  }

  @media (max-width: 600px) {
    height: 46px;
    padding: 3px 5px 3px 6px;
    gap: 6px;
  }
}

.capsule-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 8px;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
  font-family: inherit;

  &::placeholder {
    color: var(--fg-tertiary-color);
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    font-size: 0.88rem;

    &::placeholder {
      font-size: 0.84rem;
    }
  }
}

.capsule-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.18s ease-in-out;
  flex-shrink: 0;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.handsfree-btn {
    width: 38px;
    height: 38px;
    background: transparent;
    color: var(--fg-secondary-color);
    font-size: 1.15rem;

    &:hover:not(:disabled) {
      background: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
    }

    &.active {
      background: rgba(var(--fg-accent-color-rgb), 0.15);
      color: var(--fg-accent-color);
    }

    @media (max-width: 600px) {
      width: 36px;
      height: 36px;
      font-size: 1.05rem;
    }
  }

  &.action-mic-btn {
    width: 38px;
    height: 38px;
    background: var(--bg-tertiary-color);
    color: var(--fg-accent-color);
    font-size: 1.2rem;

    &:hover:not(:disabled) {
      background: var(--fg-accent-color);
      color: #ffffff;
      transform: scale(1.05);
    }

    @media (max-width: 600px) {
      width: 36px;
      height: 36px;
      font-size: 1.1rem;
    }
  }

  &.action-send-btn {
    width: 38px;
    height: 38px;
    background: var(--fg-accent-color);
    color: #ffffff;
    font-size: 1.1rem;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: scale(1.05);
    }

    @media (max-width: 600px) {
      width: 36px;
      height: 36px;
      font-size: 1.05rem;
    }
  }
}

.btn-swap-enter-active,
.btn-swap-leave-active {
  transition: all 0.14s ease-out;
}

.btn-swap-enter-from,
.btn-swap-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.confirm-delete-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;

  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.45;
  }
}

.confirm-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
