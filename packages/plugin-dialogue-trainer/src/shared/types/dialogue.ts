export type DialogueDifficulty = 'adaptive' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1'

export type DialogueStyle = 'adaptive' | 'friendly' | 'casual' | 'formal' | 'humorous' | 'tutor'

export type PracticeLanguageCode = 'en' | 'ru' | 'zh'

export interface DialogueSettings {
  targetLanguage: PracticeLanguageCode
  difficulty: DialogueDifficulty
  topic: string
  style: DialogueStyle
  autoPlayAudio: boolean
}

export interface DialogueMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isCorrect?: boolean
  feedback?: string
  correctedSentence?: string
  replyTranslation?: string
  audioBase64?: string
}

export interface DialogueSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  settings: DialogueSettings
  messages: DialogueMessage[]
}

export interface LlmDialogueAnalysisResponse {
  isCorrect: boolean
  feedback: string
  correctedSentence: string
  reply: string
  replyTranslation: string
}
