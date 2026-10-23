import type {
  DialogueMessage,
  DialogueSession,
  DialogueSettings,
  LlmDialogueAnalysisResponse,
} from '../../../shared/types/dialogue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { requestLlmGenerate } from '../../../shared/lib/api'
import { useDialogueStorage } from './use-dialogue-storage'
import { useDialogueTts } from './use-dialogue-tts'

const DEFAULT_SETTINGS: DialogueSettings = {
  targetLanguage: 'en',
  difficulty: 'adaptive',
  topic: '',
  style: 'adaptive',
  autoPlayAudio: true,
}

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
    zh: 'Chinese (Mandarin)',
  }

  return map[code] || 'English'
}

function resolveInterfaceLanguage(localeVal: string): string {
  if (localeVal.startsWith('zh'))
    return 'Chinese'

  if (localeVal.startsWith('en'))
    return 'English'

  return 'Russian'
}

function buildDialogueHistoryPrompt(messages: DialogueMessage[], cleanText: string): string {
  const history = messages.slice(-8, -1).map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')

  const prefix = history ? `Recent dialogue history:\n${history}\n\n` : ''

  return `${prefix}User just said: "${cleanText}"\n\nAnalyze what the user said, evaluate correctness, explain mistakes/improvements, give corrected sentence, and write your in-character dialogue reply.`
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
}

function removeFailedPlaceholder(session: DialogueSession, placeholder: DialogueMessage): void {
  const idx = session.messages.indexOf(placeholder)

  if (idx !== -1 && !placeholder.content) {
    session.messages.splice(idx, 1)
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

  function buildSystemPrompt(settings: DialogueSettings): string {
    const practiceLang = getLanguageName(settings.targetLanguage)
    const interfaceLang = resolveInterfaceLanguage(locale.value || 'ru')

    return `You are an expert language coach and immersive conversational partner.
The user is practicing their spoken ${practiceLang}.
Your role:
1. Conduct an engaging, natural dialogue in ${practiceLang} matching the scenario and level.
2. Provide precise, constructive linguistic feedback in ${interfaceLang} analyzing the user's spoken utterance.

Scenario Configuration:
- Target Practice Language: ${practiceLang}
- User Explanation Language: ${interfaceLang}
- Difficulty Level: ${settings.difficulty}
- Topic / Situation: ${settings.topic || 'General engaging daily conversation'}
- Conversational Style: ${settings.style}

Analysis Instructions:
- Evaluate user speech transcript verbatim (isCorrect: true/false).
- In "feedback" (${interfaceLang}): explain mistakes, cite grammar rules, suggest natural/conversational phrasing.
- In "correctedSentence": full ideal sentence in ${practiceLang}.
- In "reply": in-character conversational continuation in ${practiceLang}.
- In "replyTranslation": translation into ${interfaceLang}.

Output STRICT JSON ONLY:
{
  "isCorrect": boolean,
  "feedback": "string",
  "correctedSentence": "string",
  "reply": "string",
  "replyTranslation": "string"
}`
  }

  async function playAssistantVoice(message: DialogueMessage, session: DialogueSession, onEnded?: () => void): Promise<void> {
    if (!session.settings.autoPlayAudio) {
      onEnded?.()

      return
    }

    const audio = await tts.playAudio(
      message.id,
      message.content,
      session.settings.targetLanguage,
      undefined,
      undefined,
      onEnded,
    )

    if (audio) {
      message.audioBase64 = audio
      await storage.saveSession(session)
    }
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
      const prompt = `Start our dialogue in ${practiceLang}. Introduce scenario or greet user in character matching topic "${settings.topic || 'friendly encounter'}", style "${settings.style}", level "${settings.difficulty}". Return JSON with isCorrect: true, feedback: "", correctedSentence: "", reply: "greeting in ${practiceLang}", replyTranslation: "translation in ${interfaceLang}".`

      const res = await requestLlmGenerate<LlmDialogueAnalysisResponse>({
        systemPrompt: buildSystemPrompt(settings),
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
        systemPrompt: buildSystemPrompt(settings),
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
    deleteCurrentSession,
    updateSettings,
    removeSession: storage.removeSession,
  }
}
