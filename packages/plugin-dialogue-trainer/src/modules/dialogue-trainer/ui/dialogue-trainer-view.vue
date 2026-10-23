<script setup lang="ts">
import type { DialogueMessage, DialogueSession, DialogueSettings } from '../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitInput } from '~/02.kit'
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
      @open-settings="handleOpenSettings"
      @open-history="handleOpenHistory"
      @new-dialogue="handleNewDialogue"
      @delete-dialogue="handleDeleteDialogue"
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
          :is-playing-reply="tts.currentPlayingId.value === msg.id && tts.isPlaying.value"
          :is-playing-correction="tts.currentPlayingId.value === `corr_${msg.id}` && tts.isPlaying.value"
          :is-loading-audio="tts.isLoadingAudio.value"
          @play-reply="handlePlayReply(msg)"
          @play-correction="handlePlayCorrection(msg)"
        />

        <!-- Loading / Analyzing Indicator -->
        <div v-if="isGenerating || isAiStarting" class="typing-indicator-row">
          <div class="assistant-avatar">
            <Icon icon="mdi:robot-happy-outline" />
          </div>
          <div class="typing-bubble">
            <span class="dot dot-1" />
            <span class="dot dot-2" />
            <span class="dot dot-3" />
            <span class="typing-text">
              {{ isAiStarting ? t('plugins.dialogue-trainer.analyzing') : t('plugins.dialogue-trainer.analyzing') }}
            </span>
          </div>
        </div>

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
        <!-- Voice Recorder -->
        <DialogueRecorder
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

        <!-- Text Input (when not recording) -->
        <div v-if="!recorder.isRecording.value" class="text-input-wrapper">
          <KitInput
            v-model="textInput"
            :placeholder="t('plugins.dialogue-trainer.inputPlaceholder')"
            size="md"
            :disabled="isGenerating || isAiStarting || recorder.isTranscribing.value"
            class="chat-text-input"
            @keyup.enter="handleSendMessage"
          />

          <KitBtn
            size="md"
            variant="solid"
            color="primary"
            icon="mdi:send"
            :disabled="!textInput.trim() || isGenerating || isAiStarting || recorder.isTranscribing.value"
            class="send-btn"
            :aria-label="t('plugins.dialogue-trainer.send')"
            @click="handleSendMessage"
          />
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
  height: 100dvh;
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

.typing-indicator-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.assistant-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.typing-bubble {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  border-bottom-left-radius: 4px;

  .dot {
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

  .typing-text {
    margin-left: 6px;
    font-size: 0.82rem;
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
  padding: 12px max(20px, env(safe-area-inset-right, 0px))
    max(16px, calc(14px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))))
    max(20px, env(safe-area-inset-left, 0px));
  background: var(--bg-primary-color);
  border-top: 1px solid var(--border-secondary-color);

  @media (max-width: 600px) {
    padding: 10px max(12px, env(safe-area-inset-right, 0px))
      max(14px, calc(10px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))))
      max(12px, env(safe-area-inset-left, 0px));
  }
}

.input-bar {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  &.is-recording {
    justify-content: center;
  }
}

.text-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.chat-text-input {
  flex: 1;
}

.send-btn {
  border-radius: 50% !important;
  width: 44px;
  height: 44px;
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
