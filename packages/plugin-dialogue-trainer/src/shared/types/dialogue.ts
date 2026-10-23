import type { TokenizedSentence } from '../lib/dialogue-tokenizer'

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

export interface DialogueSentenceReply {
  text: string
  translation: string
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
  replySentences?: DialogueSentenceReply[]
  audioBase64?: string
  sentenceAudios?: Record<number, string>
  tokenizedSentences?: TokenizedSentence[]
  isLoading?: boolean
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
  replySentences?: DialogueSentenceReply[]
}
