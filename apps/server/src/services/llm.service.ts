import type { LlmAnalysis } from '../types'
import { LLM_API_KEY, LLM_API_URL, LLM_MODEL, TTS_API_KEY, TTS_MODEL } from '../config'
import { db } from '../db'

function hashSentence(sentence: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(sentence.trim())
  return hasher.digest('hex')
}

function getLangName(code: string): string {
  const map: Record<string, string> = { zh: 'китайского', ja: 'японского', en: 'английского' }
  return map[code.toLowerCase()] || 'иностранного'
}

function getSystemPrompt(language: string) {
  const langName = getLangName(language)
  return `Ты — экспертный лингвист и терпеливый преподаватель ${langName} языка для русскоязычных студентов.
Твоя задача — предоставить глубокий и понятный анализ текста (это может быть одно слово, фраза или целое предложение).
Твой ответ ДОЛЖЕН быть ТОЛЬКО валидным JSON объектом без каких-либо комментариев, объяснений или markdown-обёрток.

Вот важные инструкции для анализа:
1.  **Контекстуальный перевод**: Давай естественный, литературный перевод на русский, а не дословный.
2.  **Ключевая грамматика**: Выделяй только самые важные или интересные грамматические конструкции в предложении. Объясняй их просто и понятно.
3.  **Адаптивное поведение**:
    - Если на вход подано **одно слово**, в секции 'vocabulary' предоставь его основные значения с примерами использования для каждого. Поле 'usageInContext' в этом случае может быть пустым.
    - Если на вход подано **предложение**, поле 'usageInContext' должно объяснять роль и значение слова именно в этом предложении.

Строго следуй этой JSON-схеме (все ключи в camelCase):
{
  "transcription": "транскрипция (IPA для английского, пиньинь для китайского и т.д.) для всего текста",
  "translation": "Естественный и точный перевод на русский язык",
  "grammarRules": [
    {
      "pattern": "Грамматическая конструкция или правило, найденное в тексте",
      "explanation": "Простое и ясное объяснение правила для ученика",
      "example": "Краткий дополнительный пример использования этой конструкции"
    }
  ],
  "vocabulary": [
    {
      "word": "Слово из текста",
      "transcription": "Транскрипция конкретного слова",
      "meaning": "Основное значение или несколько ключевых значений слова",
      "usageInContext": "Объяснение, как слово используется и что означает именно в данном предложении/контексте. Если это идиома, объясни её здесь."
    }
  ]
}`
}

const BOOK_ANALYSIS_PROMPT = `Ты — литературный критик. Оцени предоставленный отрывок книги. Верни ТОЛЬКО JSON:
{
  "description": "краткое описание сюжета",
  "difficulty": "уровень сложности (например B2, HSK 4, JLPT N3)",
  "tags": ["тег1", "тег2"]
}`

function hashTtsText(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text.trim())
  return hasher.digest('hex')
}

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
      model: LLM_MODEL,
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
      model: LLM_MODEL,
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

export async function generateTts(text: string): Promise<string> {
  const normalizedText = text.trim()

  if (!normalizedText) {
    throw new Error('Текст не передан')
  }

  if (!TTS_API_KEY) {
    throw new Error('TTS_API_KEY не настроен')
  }

  const hash = hashTtsText(normalizedText)

  const cached = db.prepare(`
    SELECT analysis
    FROM llm_cache
    WHERE sentenceHash = ? AND sentence = 'AUDIO_CACHE'
  `).get(hash) as { analysis: string } | null

  if (cached) {
    return cached.analysis
  }

  const response = await fetch(`${LLM_API_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TTS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: normalizedText,
      voice: 'alloy',
      response_format: 'mp3',
      instructions: 'Читай в спокойной, ровной манере диктора аудиокниг, без излишней эмоциональности, с чёткой артикуляцией и умеренной скоростью.',
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`TTS API error ${response.status}: ${err}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  db.prepare(`
    INSERT OR REPLACE INTO tts_cache (textHash, text, audioBase64)
    VALUES (?, ?, ?)
  `).run(hash, normalizedText, base64)

  return base64
}
