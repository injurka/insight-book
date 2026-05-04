import type { GeminiAnalysis } from '../types'
import { GEMINI_API_KEY, GEMINI_API_URL } from '../config'
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

export async function analyzeSentence(sentence: string): Promise<GeminiAnalysis> {
  const hash = hashSentence(sentence)

  const cached = db.prepare(`SELECT analysis FROM llm_cache WHERE sentenceHash = ?`).get(hash) as { analysis: string } | null
  if (cached) {
    return JSON.parse(cached.analysis) as GeminiAnalysis
  }

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY не настроен')
  }

  const response = await fetch(`${GEMINI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
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

  // Сохраняем в кэш
  db.prepare(`
    INSERT OR REPLACE INTO llm_cache (sentenceHash, sentence, analysis)
    VALUES (?, ?, ?)
  `).run(hash, sentence, JSON.stringify(analysis))

  return analysis
}
