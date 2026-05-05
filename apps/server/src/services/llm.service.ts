import type { LlmAnalysis } from '../types'
import { LLM_API_KEY, LLM_API_URL } from '../config'
import { db } from '../db'

function hashSentence(sentence: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(sentence.trim())
  return hasher.digest('hex')
}

function getLangName(code: string): string {
  const map: Record<string, string> = { zh: 'китайского', ja: 'японского', en: 'английского', de: 'немецкого', fr: 'французского', es: 'французского' }
  return map[code.toLowerCase()] || 'иностранного'
}

function getSystemPrompt(language: string) {
  return `Ты — экспертный преподаватель ${getLangName(language)} языка.
Проанализируй предоставленный текст (это может быть одно слово, фраза или целое предложение) и верни ТОЛЬКО валидный JSON без markdown-обёрток, без \`\`\`json, без пояснений.
Схема ответа строго (все ключи в camelCase):
{
  "transcription": "транскрипция (пиньинь, ромадзи, IPA и т.д.) всего переданного текста",
  "translation": "перевод на русский",
  "grammarRules": [
    { "pattern": "грамматическая конструкция", "explanation": "объяснение", "example": "пример" }
  ],
  "vocabulary": [
    { "word": "слово", "transcription": "транскрипция", "meaning": "значение", "usageInContext": "использование в тексте" }
  ]
}`
}

const BOOK_ANALYSIS_PROMPT = `Ты — литературный критик. Оцени предоставленный отрывок книги. Верни ТОЛЬКО JSON:
{
  "description": "краткое описание сюжета",
  "difficulty": "уровень сложности (например B2, HSK 4, JLPT N3)",
  "tags": ["тег1", "тег2"]
}`

export async function analyzeSentence(sentence: string, language: string): Promise<LlmAnalysis> {
  const hash = hashSentence(sentence)

  const cached = db.prepare(`SELECT analysis FROM llm_cache WHERE sentenceHash = ?`).get(hash) as { analysis: string } | null
  if (cached) {
    return JSON.parse(cached.analysis) as LlmAnalysis
  }

  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY не настроен')
  }

  const response = await fetch(`${LLM_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite-preview',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getSystemPrompt(language) },
        { role: 'user', content: `Текст: ${sentence}` },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices[0].message.content
  const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  const analysis = JSON.parse(cleanJson) as LlmAnalysis

  db.prepare(`
    INSERT OR REPLACE INTO llm_cache (sentenceHash, sentence, analysis)
    VALUES (?, ?, ?)
  `).run(hash, sentence, JSON.stringify(analysis))

  return analysis
}

export async function analyzeBookExcerpt(excerpt: string): Promise<{ description: string, difficulty: string, tags: string[] }> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY не настроен')
  }

  const response = await fetch(`${LLM_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite-preview',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BOOK_ANALYSIS_PROMPT },
        { role: 'user', content: `Отрывок книги:\n\n${excerpt}` },
      ],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices[0].message.content
  const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return JSON.parse(cleanJson)
}
