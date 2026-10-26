import type {
  DialogueMessage,
  DialogueSession,
  DialogueSettings,
  LlmDialogueAnalysisResponse,
} from '../../../shared/types/dialogue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { requestLlmGenerate, requestTtsAudio } from '../../../shared/lib/api'
import {
  buildDialogueHistoryPrompt,
  buildDialogueSystemPrompt,
  getLanguageName,
  resolveInterfaceLanguage,
} from '../../../shared/lib/dialogue-prompt'
import { splitTextIntoSentences } from '../../../shared/lib/dialogue-tokenizer'
import { useDialogueStorage } from './use-dialogue-storage'
import { useDialogueTts } from './use-dialogue-tts'

const DEFAULT_SETTINGS: DialogueSettings = {
  targetLanguage: 'en',
  difficulty: 'adaptive',
  topic: '',
  style: 'adaptive',
  autoPlayAudio: true,
  autoExpandTranslations: false,
}

function createAssistantPlaceholder(): DialogueMessage {
  return {
    id: `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isLoading: true,
  }
}

function populateAssistantMessage(message: DialogueMessage, res: LlmDialogueAnalysisResponse, fallbackContent = ''): void {
  message.content = res.reply || fallbackContent
  message.isCorrect = res.isCorrect
  message.feedback = res.feedback || ''
  message.correctedSentence = res.correctedSentence || fallbackContent
  message.replyTranslation = res.replyTranslation || ''
  message.replySentences = res.replySentences || []
}

function removeFailedPlaceholder(session: DialogueSession, placeholder: DialogueMessage): void {
  const idx = session.messages.indexOf(placeholder)

  if (idx !== -1 && !placeholder.content) {
    session.messages.splice(idx, 1)
  }
}

// Каждый ответ ИИ принадлежит предшествующей реплике пользователя: правка или
// удаление реплики делает ответ неактуальным, поэтому он удаляется вместе с ней.
function removeFollowingAssistantMessages(session: DialogueSession, fromIndex: number): void {
  while (session.messages[fromIndex]?.role === 'assistant') {
    session.messages.splice(fromIndex, 1)
  }
}

function updateSessionTitleIfEmpty(
  session: DialogueSession,
  defaultTopic = '',
  reply = '',
  defaultTitle = '',
): void {
  if (!session.title || session.title === defaultTitle) {
    session.title = defaultTopic.trim() || reply.substring(0, 30)
  }
}

export function useDialogueSession() {
  const { t, locale } = useI18n()
  const storage = useDialogueStorage()
  const tts = useDialogueTts()

  const currentSession = ref<DialogueSession | null>(null)
  const isGenerating = ref(false)
  const isAiStarting = ref(false)
  const currentError = ref<string | null>(null)

  const activeMessages = computed(() => currentSession.value?.messages || [])
  const currentSettings = computed(() => currentSession.value?.settings || DEFAULT_SETTINGS)

  function ensureActiveSession(): DialogueSession {
    if (!currentSession.value) {
      createNewSession()
    }

    return currentSession.value!
  }

  function createNewSession(settings: Partial<DialogueSettings> = {}): DialogueSession {
    const newSession: DialogueSession = {
      id: `dialogue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: settings.topic?.trim() || t('plugins.dialogue-trainer.newDialogue', 'Новый диалог'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings,
      },
      messages: [],
    }

    currentSession.value = newSession
    storage.saveSession(newSession)

    return newSession
  }

  function selectSession(session: DialogueSession) {
    tts.stopAudio()
    currentSession.value = session
    storage.activeSessionId.value = session.id
  }

  async function initSession(): Promise<void> {
    await storage.loadAllSessions()
    const activeId = storage.activeSessionId.value

    if (activeId) {
      const existing = storage.sessions.value.find(s => s.id === activeId)

      if (existing) {
        if (!['en', 'ru', 'zh'].includes(existing.settings.targetLanguage)) {
          existing.settings.targetLanguage = 'en'
        }

        currentSession.value = existing

        return
      }
    }

    if (storage.sessions.value.length > 0) {
      const first = storage.sessions.value[0]

      if (!['en', 'ru', 'zh'].includes(first.settings.targetLanguage)) {
        first.settings.targetLanguage = 'en'
      }

      currentSession.value = first
      storage.activeSessionId.value = first.id
    }
    else {
      createNewSession()
    }
  }

  async function playAssistantVoice(message: DialogueMessage, session: DialogueSession, onEnded?: () => void): Promise<void> {
    const language = session.settings.targetLanguage
    const sentences = (message.replySentences?.length
      ? message.replySentences.map(s => s.text)
      : splitTextIntoSentences(message.content, language))
      .map(s => s.trim())
      .filter(Boolean)

    if (!sentences.length) {
      onEnded?.()

      return
    }

    if (!message.sentenceAudios) {
      message.sentenceAudios = {}
    }

    // TTS per sentence: 3 sentences -> 3 requests -> wait for answers -> sequential play
    const hasMissingAudio = sentences.some((_, idx) => !message.sentenceAudios?.[idx])

    if (hasMissingAudio) {
      const audioResults = await Promise.all(sentences.map((sent, idx) => {
        if (message.sentenceAudios?.[idx]) {
          return Promise.resolve(message.sentenceAudios[idx])
        }

        return requestTtsAudio(sent)
      }))

      audioResults.forEach((audio, idx) => {
        if (audio) {
          message.sentenceAudios![idx] = audio
        }
      })

      await storage.saveSession(session)
    }

    if (!session.settings.autoPlayAudio) {
      onEnded?.()

      return
    }

    await tts.playSentencesSequential(
      message.id,
      sentences,
      language,
      message.sentenceAudios,
      async (idx, audio) => {
        if (!message.sentenceAudios) {
          message.sentenceAudios = {}
        }

        message.sentenceAudios[idx] = audio
        await storage.saveSession(session)
      },
      onEnded,
    )
  }

  async function playMessageSentence(message: DialogueMessage, sentenceIdx: number, text: string): Promise<void> {
    const session = currentSession.value
    const language = session?.settings.targetLanguage || 'en'
    const cached = message.sentenceAudios?.[sentenceIdx]

    await tts.playSentence(
      message.id,
      sentenceIdx,
      text,
      language,
      cached,
      async (audio) => {
        if (!message.sentenceAudios) {
          message.sentenceAudios = {}
        }

        message.sentenceAudios[sentenceIdx] = audio

        if (session) {
          await storage.saveSession(session)
        }
      },
    )
  }

  async function startAiConversation(onAudioFinished?: () => void): Promise<void> {
    const session = ensureActiveSession()
    const settings = session.settings
    const practiceLang = getLanguageName(settings.targetLanguage)
    const interfaceLang = resolveInterfaceLanguage(locale.value || 'ru')

    isAiStarting.value = true
    currentError.value = null

    const assistantPlaceholder = createAssistantPlaceholder()
    session.messages.push(assistantPlaceholder)

    try {
      const prompt = `Start our dialogue in ${practiceLang}. Introduce the scenario or greet the user in character, matching the topic "${settings.topic || 'friendly encounter'}" and the conversational style and level defined in the system prompt. Return JSON with isCorrect: true, feedback: "", correctedSentence: "", reply: "greeting in ${practiceLang}", replyTranslation: "translation in ${interfaceLang}".`

      const res = await requestLlmGenerate<LlmDialogueAnalysisResponse>({
        systemPrompt: buildDialogueSystemPrompt(settings, locale.value || 'ru'),
        prompt,
        temperature: 0.7,
      })

      if (!res?.reply) {
        throw new Error('Empty AI response')
      }

      populateAssistantMessage(assistantPlaceholder, res)
      session.updatedAt = Date.now()
      updateSessionTitleIfEmpty(
        session,
        settings.topic,
        res.reply,
        t('plugins.dialogue-trainer.newDialogue'),
      )

      await playAssistantVoice(assistantPlaceholder, session, onAudioFinished)
    }
    catch (err) {
      console.error('[DialogueSession] Failed to start AI conversation:', err)
      currentError.value = t('plugins.dialogue-trainer.generationFailed', 'Ошибка генерации ответа от нейросети')
      removeFailedPlaceholder(session, assistantPlaceholder)
    }
    finally {
      assistantPlaceholder.isLoading = false
      await storage.saveSession(session)
      isAiStarting.value = false
    }
  }

  async function sendUserMessage(text: string, onAudioFinished?: () => void): Promise<void> {
    const cleanText = text.trim()

    if (!cleanText || isGenerating.value) {
      return
    }

    const session = ensureActiveSession()
    const settings = session.settings

    const userMessage: DialogueMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)
    session.updatedAt = Date.now()

    if (session.messages.length === 1 && !settings.topic) {
      session.title = cleanText.substring(0, 35)
    }

    await storage.saveSession(session)

    isGenerating.value = true
    currentError.value = null

    const assistantPlaceholder = createAssistantPlaceholder()
    session.messages.push(assistantPlaceholder)

    try {
      const prompt = buildDialogueHistoryPrompt(session.messages, cleanText)
      const res = await requestLlmGenerate<LlmDialogueAnalysisResponse>({
        systemPrompt: buildDialogueSystemPrompt(settings, locale.value || 'ru'),
        prompt,
        temperature: 0.6,
      })

      if (!res?.reply) {
        throw new Error('Empty AI response')
      }

      populateAssistantMessage(assistantPlaceholder, res, cleanText)
      session.updatedAt = Date.now()
      await playAssistantVoice(assistantPlaceholder, session, onAudioFinished)
    }
    catch (err) {
      console.error('[DialogueSession] Failed to generate AI reply:', err)
      currentError.value = t('plugins.dialogue-trainer.generationFailed', 'Ошибка генерации ответа от нейросети')
      removeFailedPlaceholder(session, assistantPlaceholder)
    }
    finally {
      assistantPlaceholder.isLoading = false
      await storage.saveSession(session)
      isGenerating.value = false
    }
  }

  async function deleteUserMessage(messageId: string): Promise<void> {
    const session = currentSession.value

    if (!session || isGenerating.value) {
      return
    }

    const idx = session.messages.findIndex(msg => msg.id === messageId && msg.role === 'user')

    if (idx === -1) {
      return
    }

    tts.stopAudio()
    session.messages.splice(idx, 1)
    removeFollowingAssistantMessages(session, idx)
    session.updatedAt = Date.now()
    await storage.saveSession(session)
  }

  async function updateUserMessage(messageId: string, text: string): Promise<void> {
    const cleanText = text.trim()
    const session = currentSession.value

    if (!session || !cleanText || isGenerating.value) {
      return
    }

    const idx = session.messages.findIndex(msg => msg.id === messageId && msg.role === 'user')

    if (idx === -1) {
      return
    }

    const message = session.messages[idx]

    if (message.content === cleanText) {
      return
    }

    tts.stopAudio()
    message.content = cleanText
    message.tokenizedSentences = undefined
    removeFollowingAssistantMessages(session, idx + 1)
    session.updatedAt = Date.now()
    await storage.saveSession(session)
  }

  async function deleteCurrentSession(): Promise<void> {
    if (!currentSession.value) {
      return
    }

    tts.stopAudio()
    const id = currentSession.value.id
    await storage.removeSession(id)

    if (storage.sessions.value.length > 0) {
      currentSession.value = storage.sessions.value[0]
      storage.activeSessionId.value = storage.sessions.value[0].id
    }
    else {
      createNewSession()
    }
  }

  function updateSettings(newSettings: Partial<DialogueSettings>) {
    if (!currentSession.value) {
      return
    }

    currentSession.value.settings = {
      ...currentSession.value.settings,
      ...newSettings,
    }
    currentSession.value.updatedAt = Date.now()
    storage.saveSession(currentSession.value)
  }

  return {
    sessions: storage.sessions,
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
    deleteUserMessage,
    updateUserMessage,
    deleteCurrentSession,
    updateSettings,
    removeSession: storage.removeSession,
  }
}
