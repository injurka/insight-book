import type { DialogueMessage, DialogueSettings } from '@/shared/types/dialogue'
import { getStylePrompt } from '@/shared/constants/style-prompts'

export const MAX_HISTORY_MESSAGES = 25

const PRACTICE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  zh: 'Chinese (Mandarin)',
}

const PRACTICE_TRANSCRIPTION_GUIDES: Record<string, string> = {
  en: 'IPA phonetic transcription (e.g. "həˈloʊ, haʊ ɑːr juː təˈdeɪ?")',
  ru: 'phonetic transcription with word stress marks or IPA (e.g. "Пр’ив’ет, как прош’ол твой д’эн’?")',
  zh: 'Pinyin with tone diacritics and word spacing (e.g. "Nǐ hǎo ya, jīntiān guò de zěnmeyàng?")',
}

export function getLanguageName(code: string): string {
  return PRACTICE_LANGUAGE_NAMES[code] || 'English'
}

export function getTranscriptionGuide(code: string): string {
  return PRACTICE_TRANSCRIPTION_GUIDES[code] || PRACTICE_TRANSCRIPTION_GUIDES.en
}

export function resolveInterfaceLanguage(localeVal: string): string {
  if (localeVal.startsWith('zh'))
    return 'Chinese'

  if (localeVal.startsWith('en'))
    return 'English'

  return 'Russian'
}

export function buildDialogueHistoryPrompt(messages: DialogueMessage[], cleanText: string): string {
  const history = messages.slice(-(MAX_HISTORY_MESSAGES + 1), -1).map(m =>
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')

  const prefix = history ? `Recent dialogue history:\n${history}\n\n` : ''

  return `${prefix}User just said: "${cleanText}"\n\nAnalyze what the user said, evaluate correctness, explain mistakes/improvements, give corrected sentence, and write your in-character dialogue reply.`
}

export function buildDialogueSystemPrompt(settings: DialogueSettings, interfaceLocale: string): string {
  const practiceLang = getLanguageName(settings.targetLanguage)
  const transcriptionGuide = getTranscriptionGuide(settings.targetLanguage)
  const interfaceLang = resolveInterfaceLanguage(interfaceLocale)
  const styleInstruction = getStylePrompt(settings.style)

  return `You are an expert language coach and immersive conversational partner.
The user is practicing their spoken ${practiceLang}.
Your role:
1. Conduct an engaging, natural dialogue in ${practiceLang} matching the scenario and level.
2. Provide precise, constructive linguistic feedback in ${interfaceLang} analyzing the user's spoken utterance.

Scenario Configuration:
- Target Practice Language: ${practiceLang}
- Transcription Format for ${practiceLang}: ${transcriptionGuide}
- User Explanation Language: ${interfaceLang}
- Difficulty Level: ${settings.difficulty}
- Topic / Situation: ${settings.topic || 'General engaging daily conversation'}
- Conversational Style: ${settings.style}

Style Playbook (defines HOW you speak — follow it strictly):
${styleInstruction}

Analysis Instructions:
- Evaluate user speech transcript verbatim (isCorrect: true/false).
- In "feedback" (${interfaceLang}): explain mistakes, cite grammar rules, suggest natural/conversational phrasing. If your reply contains slang, idioms, abbreviations or other colloquial expressions, gloss them there so the learner can reuse them.
- In "correctedSentence": full ideal sentence in ${practiceLang}.
- In "correctedTranscription": phonetic transcription (${transcriptionGuide}) of "correctedSentence" (empty string if "correctedSentence" is empty).
- In "reply": in-character conversational continuation in ${practiceLang}, written exactly in the style described by the Style Playbook.
- In "replyTranscription": phonetic transcription (${transcriptionGuide}) of the entire "reply".
- In "replyTranslation": translation of entire reply into ${interfaceLang}.
- In "replySentences": array of sentence objects breaking down "reply" sentence by sentence, where each item has "text" in ${practiceLang}, "transcription" (${transcriptionGuide}), and "translation" in ${interfaceLang}.

Output STRICT JSON ONLY:
{
  "isCorrect": boolean,
  "feedback": "string",
  "correctedSentence": "string",
  "correctedTranscription": "string",
  "reply": "string",
  "replyTranscription": "string",
  "replyTranslation": "string",
  "replySentences": [
    {
      "text": "sentence text in practice language",
      "transcription": "phonetic transcription / pinyin of this sentence",
      "translation": "translation of this sentence in explanation language"
    }
  ]
}`
}
