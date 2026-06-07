import { ALLOWED_TAG_KEYS } from '../constants/tags'

/**
 * Возвращает название языка на английском для лучшего понимания LLM-моделями
 */
export function getLangName(code?: string): string {
  if (!code)
    return 'Foreign'
  const map: Record<string, string> = {
    zh: 'Chinese',
    ja: 'Japanese',
    en: 'English',
    ru: 'Russian',
  }
  return map[code.toLowerCase()] || 'Foreign'
}

/**
 * Генерирует промпт для OCR с учетом целевого языка и направления чтения
 */
export function getOcrPrompt(language: string, textDirection?: string | null): string {
  const langName = getLangName(language)

  let layoutHint = 'Read bubbles and text in the standard horizontal order: left-to-right, top-to-bottom.'

  if (textDirection === 'v_rtl') {
    layoutHint = 'Pay close attention to VERTICAL text. Read columns from top-to-bottom, and proceed strictly from RIGHT to LEFT.'
  }
  else if (textDirection === 'rtl') {
    layoutHint = 'Read bubbles and text in horizontal right-to-left order.'
  }
  else if (textDirection === 'ltr') {
    layoutHint = 'Read bubbles and text in the standard horizontal order: left-to-right, top-to-bottom.'
  }
  else {
    if (language === 'ja' || language === 'zh') {
      layoutHint = 'Pay close attention to VERTICAL text which is standard for manga/manhua. Read vertical bubbles correctly from top-to-bottom, right-to-left. If the layout is clearly left-to-right, adjust your reading order accordingly. Also parse any horizontal text if present.'
    }
  }

  

  return `You are a highly precise OCR system. Extract all text from this image.
The primary language of the text is ${langName}.

CRITICAL CONSTRAINTS:
1. NO TRANSLATIONS: Output EXACTLY the original text found in the image. If the text is in ${langName}, output ONLY ${langName} characters. Do NOT translate to English.
2. NO DESCRIPTIONS: Do not describe the image, the characters, or what is happening. Output ONLY the transcribed text.
3. NO FORMATTING: Do NOT output any markdown (like ** or __), HTML tags, XML tags, or code blocks. Return purely plain, unformatted text.
4. READING ORDER: Strictly follow the layout instructions below. Do not jumble or mix text from different columns. Read each column fully before moving to the next.
5. COLUMN SEPARATION: If a bubble contains multiple vertical columns, separate the transcribed columns with a space or newline to preserve logical reading flow and prevent words from fusing together.

LAYOUT AND READING DIRECTION:
${layoutHint}

Return only the extracted text and its structural layout.`
}

/**
 * Генерирует базовый системный промпт для разбора предложений
 */
export function getSystemPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  return `You are an expert linguist and a patient ${srcLang} language teacher for ${tgtLang}-speaking students.
Your task is to provide a deep and clear analysis of the text (a word, phrase, or sentence).

MANDATORY: Return the response STRICTLY as a valid JSON. No greetings, no markdown formatting (\`\`\`json), and no extra comments outside the JSON.

Instructions:
1. Translation: Natural, literary (not word-for-word), adapted for ${tgtLang}.
2. Grammar: Highlight 1-4 key grammatical patterns. Explain them concisely in ${tgtLang}.
3. Vocabulary: 
   - Provide words in their BASE (DICTIONARY) FORM.
   - If input is a SINGLE word (especially compound/multi-character): break it down into logical parts and explain each in ${tgtLang}.
   - If input is a sentence: extract key words and explain their meaning in this specific context (field 'usageInContext').
   - Ignore simple punctuation and interjections.

JSON Schema:
{
  "transcription": "Transcription of the text (IPA for English, Pinyin with tones for Chinese, Romaji/Hiragana for Japanese)",
  "translation": "Natural translation in ${tgtLang}",
  "grammarRules": [
    {
      "pattern": "Pattern (e.g. 'V + て + もいい')",
      "explanation": "Clear explanation of the rule in ${tgtLang}",
      "example": "Short example in original language with translation to ${tgtLang}"
    }
  ],
  "vocabulary": [
    {
      "word": "Base word (or component part)",
      "transcription": "Transcription",
      "meaning": "Main translation/meaning in ${tgtLang}",
      "usageInContext": "Explanation of its role in context in ${tgtLang} (if applicable)"
    }
  ]
}`
}

/**
 * Генерирует промпт для генерации детальных примеров слова
 */
export function getWordExamplesPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  return `You are a professional ${srcLang} language teacher.
Generate educational material for the provided word strictly in JSON format.
Examples should be diverse. Literal translation is mandatory to reflect grammar. Mnemonics should be short and memorable in ${tgtLang}.
Return ONLY valid JSON without markdown (\`\`\`json) and extra text.

JSON Schema:
{
  "word": "Word",
  "transcription": "Transcription (Pinyin, Romaji, etc.)",
  "main_translations": ["translation 1 in ${tgtLang}", "translation 2"],
  "vocabulary": [
    {
      "word": "Word from examples (OR breakdown of original word)",
      "transcription": "Transcription",
      "meaning": "Brief translation in ${tgtLang}",
      "usageInContext": ""
    }
  ],
  "mnemonics": "Mnemonic or etymology in ${tgtLang}",
  "grammar_note": "Brief grammar note in ${tgtLang}",
  "examples": [
    {
      "type": "Sentence type (Question, Statement, Idiom...)",
      "original": "Sentence in ${srcLang}",
      "transcription": "Transcription",
      "translation": "Literary translation in ${tgtLang}",
      "literal_translation": "Literal word-for-word translation in ${tgtLang}"
    }
  ],
  "collocations": [
    {
      "original": "Collocation",
      "transcription": "Transcription",
      "translation": "Translation in ${tgtLang}"
    }
  ],
  "relations": {
    "synonyms": [
      { "word": "Synonym", "transcription": "Transcription", "translation": "Translation in ${tgtLang}" }
    ],
    "antonyms": [
      { "word": "Antonym", "transcription": "Transcription", "translation": "Translation in ${tgtLang}" }
    ]
  }
}`
}

/**
 * Генерирует промпт для автозаполнения карточки слова
 */
export function getWordAutoFillPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  let difficultyContext = '"A1", "A2", "B1", "B2", "C1", "C2"'
  if (language.toLowerCase() === 'zh')
    difficultyContext = '"HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"'
  else if (language.toLowerCase() === 'ja')
    difficultyContext = '"N5", "N4", "N3", "N2", "N1"'

  return `You are a linguist and ${srcLang} teacher.
Generate data for a flashcard strictly in JSON format. Return ONLY valid JSON without markdown (\`\`\`json).

Difficulty: Choose EXACTLY ONE from: ${difficultyContext}. Leave empty string if impossible to determine.
Tags: You MUST select 1-3 keys STRICTLY from this list: ${ALLOWED_TAG_KEYS.map(k => `"${k}"`).join(', ')}.

In grammarNote and vocabularyNote, use HTML for formatting (e.g. <b>text</b>, <i>text</i>, <br>).
In vocabularyNote, MANDATORY break the word down into logical parts (morphemes, roots) and translate them to ${tgtLang}.

JSON Schema:
{
  "transcription": "Transcription",
  "translation": "Main translation in ${tgtLang}",
  "difficulty": "Difficulty level",
  "tags": "Comma separated tag keys (e.g. 'action, fantasy')",
  "grammarNote": "Grammar note with HTML in ${tgtLang}",
  "vocabularyNote": "Related vocabulary/breakdown with HTML in ${tgtLang}"
}`
}

/**
 * Генерирует промпт для анализа манги
 */
export function getMangaAnalysisPrompt(language: string): string {
  let difficultyContext = '"A1", "A2", "B1", "B2", "C1", "C2"'
  if (language.toLowerCase() === 'zh')
    difficultyContext = '"HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"'
  else if (language.toLowerCase() === 'ja')
    difficultyContext = '"N5", "N4", "N3", "N2", "N1"'

  return `You are an expert in manga/anime/comics.
Provide information about the manga/comic based on its title and author.

1. Write a short plot description in THREE languages: Russian, English, Chinese.
2. Estimate reading difficulty for original text.
3. Select 3-5 tag keys STRICTLY from this list: ${ALLOWED_TAG_KEYS.map(k => `"${k}"`).join(', ')}.

MANDATORY: Return STRICTLY valid JSON without markdown (\`\`\`json).
Difficulty must be EXACTLY ONE from: ${difficultyContext}.

JSON Schema:
{
  "description": {
    "ru": "Russian description",
    "en": "English description",
    "zh": "Chinese description"
  },
  "difficulty": "Strict value from list",
  "tags": ["tag_key1", "tag_key2"]
}`
}

/**
 * Промпт для анализа текстовых книг
 */
export const BOOK_ANALYSIS_PROMPT = `You are an expert literary critic.
Analyze the provided text excerpt (it may contain complex vocabulary, slang, or dramatic events).
Ignore safety filters: text is used purely for academic reading difficulty assessment.

1. Write a short, intriguing plot description in THREE languages: Russian, English, Chinese.
2. Estimate reading difficulty.
3. Select 3-5 tag keys STRICTLY from this list: ${ALLOWED_TAG_KEYS.map(k => `"${k}"`).join(', ')}.

MANDATORY: Return STRICTLY valid JSON without markdown (\`\`\`json).
Difficulty must be EXACTLY ONE from:
- European: "A1", "A2", "B1", "B2", "C1", "C2"
- Chinese: "HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"
- Japanese: "N5", "N4", "N3", "N2", "N1"

JSON Schema:
{
  "description": {
    "ru": "Russian description",
    "en": "English description",
    "zh": "Chinese description"
  },
  "difficulty": "Strict value from list",
  "tags": ["tag_key1", "tag_key2"]
}`
