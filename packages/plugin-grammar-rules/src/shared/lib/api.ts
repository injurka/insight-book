import type { Rule, RuleTest } from '../types'

export interface CustomLlmConfig {
  url: string
  key: string
  model: string
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem('insight_token')
  }
  catch {
    return null
  }
}

function getStoredTargetLang(): string {
  try {
    const saved = localStorage.getItem('global-app-language')
    return saved ? saved.replace(/^"|"$/g, '') : 'ru'
  }
  catch {
    return 'ru'
  }
}

function getStoredCustomLlm(): CustomLlmConfig | null {
  try {
    const raw = localStorage.getItem('custom_llm_config')
    return raw ? JSON.parse(raw) : null
  }
  catch {
    return null
  }
}

export async function pluginRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<T> {
  const token = getStoredToken()
  const targetLang = getStoredTargetLang()
  const customLlm = getStoredCustomLlm()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (customLlm) {
    headers['X-Custom-Llm-Url'] = customLlm.url
    headers['X-Custom-Llm-Key'] = customLlm.key
    headers['X-Custom-Llm-Model'] = customLlm.model
  }

  const url = endpoint.startsWith('http') ? new URL(endpoint) : new URL(endpoint, window.location.origin)
  if (targetLang && !url.searchParams.has('targetLang')) {
    url.searchParams.set('targetLang', targetLang)
  }

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function requestLlmGenerate<T = unknown>(params: {
  action?: string
  prompt?: string
  systemPrompt?: string
  messages?: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
  json?: boolean
  temperature?: number
}): Promise<T | null> {
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
  })

  if (res.success && res.data) {
    return res.data
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
]`
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
