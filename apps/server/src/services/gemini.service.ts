import type { GeminiAnalysis } from '../types'
import { LLM_API_KEY, LLM_API_URL } from '../config'
import { db } from '../db'

function hashSentence(sentence: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(sentence.trim())
  return hasher.digest('hex')
}

const SYSTEM_PROMPT = `Ты — экспертный преподаватель китайского языка.
Проанализируй предложение и верни ТОЛЬКО валидный JSON без markdown-обёрток, без \`\`\`json, без пояснений.
Схема ответа строго (все ключи в camelCase):
{
  "translation": "перевод на русский",
  "grammarRules": [
    { "pattern": "грамматическая конструкция", "explanation": "объяснение", "example": "пример" }
  ],
  "vocabulary": [
    { "word": "слово", "pinyin": "пиньинь", "meaning": "значение", "usageInContext": "использование в предложении" }
  ]
}`

const BOOK_ANALYSIS_PROMPT = `Ты — литературный критик и преподаватель китайского языка.
Прочитай этот начальный отрывок из китайской книги и верни ТОЛЬКО валидный JSON без markdown-обёрток.
Схема ответа:
{
  "description": "Саммари или аннотация книги на русском (3-4 предложения)",
  "difficulty": "Оценка сложности словаря и грамматики (например: HSK 3, HSK 5 и т.д. от 1 до 9)",
  "tags": ["жанр", "тег1", "тег2"]
}`

export async function analyzeSentence(sentence: string): Promise<GeminiAnalysis> {
  const hash = hashSentence(sentence)

  const cached = db.prepare(`SELECT analysis FROM llm_cache WHERE sentenceHash = ?`).get(hash) as { analysis: string } | null
  if (cached) {
    return JSON.parse(cached.analysis) as GeminiAnalysis
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Предложение: ${sentence}` },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices[0].message.content
  const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  const analysis = JSON.parse(cleanJson) as GeminiAnalysis

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
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices[0].message.content
  const cleanJson = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  return JSON.parse(cleanJson)
}
