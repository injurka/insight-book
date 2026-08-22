import type {
  InsightBookPluginApiFacade,
  PluginHttpRequestOptions,
  PluginLlmGeneratePayload,
} from '@injurka/insight-book-plugin-api'
import { getPluginApi as getGlobalPluginApi } from '@injurka/insight-book-plugin-api'
import type { Rule, RuleTest } from '../types'

let localPluginApi: InsightBookPluginApiFacade | null = null

export function setPluginApi(api: InsightBookPluginApiFacade) {
  localPluginApi = api
}

export function getPluginApi(): InsightBookPluginApiFacade | null {
  return localPluginApi ?? getGlobalPluginApi()
}

export async function pluginRequest<T = unknown>(
  endpoint: string,
  options?: PluginHttpRequestOptions,
): Promise<T> {
  const api = getPluginApi()
  if (api?.request) {
    return api.request<T>(endpoint, options)
  }

  // Fallback for standalone/testing environments
  const response = await fetch(endpoint, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function requestLlmGenerate<T = unknown>(params: PluginLlmGeneratePayload): Promise<T | null> {
  const api = getPluginApi()

  if (api?.llm?.generate) {
    const res = await api.llm.generate<T>({
      action: params.action || 'grammar_generate',
      prompt: params.prompt,
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      json: params.json ?? true,
      temperature: params.temperature ?? 0.3,
    })

    if (res.success) {
      if (params.json === false && typeof res.text === 'string') {
        return res.text as unknown as T
      }
      if (res.data !== undefined) {
        return res.data
      }
    }
    return null
  }

  // Fallback via general request
  const res = await pluginRequest<{ success: boolean, data?: T, text?: string }>('/api/llm/generate', {
    method: 'POST',
    body: {
      action: params.action || 'grammar_generate',
      prompt: params.prompt,
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      json: params.json ?? true,
      temperature: params.temperature ?? 0.3,
    },
    withLlm: true,
  })

  if (res.success) {
    if (params.json === false && typeof res.text === 'string') {
      return res.text as unknown as T
    }
    if (res.data !== undefined) {
      return res.data
    }
  }
  return null
}

export function buildGrammarSystemPrompt(language: string, targetLanguage: string): string {
  return `You are a linguistics professor and test designer for ${targetLanguage}-speaking students learning ${language}.
Your task is to generate high-quality polymorphic grammar test questions for a specific grammar rule.

CRITICAL INSTRUCTIONS:
1. Target Rule: Ensure every generated question specifically and accurately tests the given grammar rule.
2. Explanations & Translations: Write all instructions, translations, prompts, and explanations strictly in ${targetLanguage}.
3. Supported Question Types:
   - "multiple_choice": 4 options. Each option MUST be an object with "text", "isCorrect", and "feedback" (explaining why that specific option is right or wrong).
   - "cloze_input": A sentence with a "___ (base_word)" blank, "validAnswers" array of acceptable forms, and "hints" array.
   - "sentence_scramble": A sentence translated, split into shuffled "tokens", with "correctOrder".
   - "cloze_choice": A sentence with "___", 4 word options, and 1 "correctAnswer".

4. Formatting: Output STRICT RAW JSON ARRAY of question objects. Never use markdown (\`\`\`json).

JSON Schema:
[
  {
    "type": "multiple_choice",
    "question": "Question text or sentence with blank",
    "options": [
      { "text": "option 1", "isCorrect": true, "feedback": "Explanation why it is correct" },
      { "text": "option 2", "isCorrect": false, "feedback": "Explanation of the mistake" }
    ],
    "correctAnswer": "option 1",
    "explanation": "General rule explanation"
  },
  {
    "type": "cloze_input",
    "prompt": "Fill in the blank with the correct form:",
    "sentenceWithBlank": "Sentence with ___ (base_verb)",
    "validAnswers": ["correct_form"],
    "hints": ["Hint"],
    "explanation": "Explanation"
  },
  {
    "type": "sentence_scramble",
    "prompt": "Arrange the words in the correct order:",
    "translation": "Natural translation",
    "tokens": ["token1", "token2", "token3"],
    "correctOrder": ["token1", "token2", "token3"],
    "explanation": "Explanation"
  }
]
`
}

export function buildGrammarUserPrompt(rule: Rule, count = 3): string {
  return `Rule ID: ${rule.id}
Title: "${rule.title}"
Pattern / Formula: ${rule.pattern || 'N/A'}
Level: ${rule.level || 'all'}
Description: ${rule.description}
Examples:
${(rule.examples || []).map(ex => `- ${ex.sentence} (${ex.translation})`).join('\n')}

Generate ${count} diverse polymorphic test questions strictly following the JSON schema.`
}

export async function generateGrammarTestsViaLlm(rule: Rule, targetLang = 'ru', count = 3): Promise<RuleTest[]> {
  const language = rule.lang || 'en'
  const systemPrompt = buildGrammarSystemPrompt(language, targetLang)
  const userPrompt = buildGrammarUserPrompt(rule, count)

  const questions = await requestLlmGenerate<RuleTest[]>({
    action: 'generate_grammar_test',
    systemPrompt,
    prompt: userPrompt,
    json: true,
    temperature: 0.3,
  })

  if (Array.isArray(questions)) {
    return questions.map((q, idx) => ({
      ...q,
      id: q.id || `ai_${rule.id}_${Date.now()}_${idx}`,
      ruleId: rule.id,
    }))
  }
  return []
}

export function buildGrammarExplanationSystemPrompt(language: string, targetLanguage: string): string {
  return `You are an expert linguist, pedagogical author, and language teacher explaining ${language} grammar to ${targetLanguage}-speaking students.
Your task is to provide a comprehensive, deep, and crystal-clear masterclass lesson for a specific grammar rule.

STRICT TONE & FORMAT RULES:
1. NO GREETINGS OR FILLER: Never start with greetings, pleasantries, or introductory fluff (e.g. "Приветствую!", "Здравствуйте", "Сегодня мы разберем...", "В этом уроке..."). Start immediately with a clear, concise definition or core essence statement (e.g. "**Present Simple** — это ...").
2. NO EMOJIS: Do not use any emojis anywhere in the output (neither in headings nor in the body text).
3. STRUCTURE & MARKDOWN: Structure your explanation strictly in ${targetLanguage} using clean Markdown. Use headings (##, ###), tables for formulas and conjugations, bullet points, bold text for emphasis, and horizontal dividers (---) between major sections.

Include the following sections:
## Суть и концепция правила
- Глубокое объяснение логики правила, почему носители языка говорят именно так.
- В каких жизненных контекстах и ситуациях оно применяется.

## Схема и образование форм
- Наглядная таблица формул (утверждение, отрицание, вопрос).
- Особенности присоединения окончаний, вспомогательные глаголы, чередования.

## Примеры употребления
- 4-6 разнообразных примеров из реальной речи с точным переводом на ${targetLanguage}.
- Разбор каждого примера.

## Подводные камни и частые ошибки
- Типичные ошибки изучающих язык с разбором (Неправильно / Правильно).
- Сравнение с похожими временами или конструкциями (в чем ключевое отличие).

## Секреты запоминания и слова-маркеры
- Маркеры времени / сигнальные слова.
- Практические советы для легкого запоминания.`
}

export function buildGrammarExplanationUserPrompt(rule: Rule): string {
  return `Подготовь подробное и глубокое учебное объяснение грамматического правила:
ID правила: ${rule.id}
Язык: ${rule.lang || 'en'}
Название: "${rule.title}"
Паттерн / формула: ${rule.pattern || 'Не указана'}
Уровень: ${rule.level || 'all'}
Категория: ${rule.category}
Краткое описание: ${rule.description}
Базовые примеры:
${(rule.examples || []).map(ex => `- ${ex.sentence} (${ex.translation})`).join('\n')}

Требования к ответу:
- Не используй приветствия, вступительные фразы вежливости и вводные предложения (например, «Приветствую! Сегодня мы...»). Сразу начни с сути и определения правила.
- Не используй эмодзи.
- Используй разделители (---) между логическими блоками.
- Для формул и схем используй Markdown-таблицы.`
}

export async function generateRuleExplanationViaLlm(rule: Rule, targetLang = 'ru'): Promise<string> {
  const language = rule.lang || 'en'
  const systemPrompt = buildGrammarExplanationSystemPrompt(language, targetLang)
  const userPrompt = buildGrammarExplanationUserPrompt(rule)

  const text = await requestLlmGenerate<string>({
    action: 'explain_grammar_rule',
    systemPrompt,
    prompt: userPrompt,
    json: false,
    temperature: 0.4,
  })

  return text || ''
}
