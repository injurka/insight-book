import { ALLOWED_TAG_KEYS } from '../constants/tags'
import { normalizeLanguageCode } from '../utils/helpers'

export function getLangName(code?: string): string {
  const normalized = normalizeLanguageCode(code)
  if (!normalized)
    return 'Foreign'

  const map: Record<string, string> = {
    zh: 'Chinese',
    ja: 'Japanese',
    en: 'English',
    ru: 'Russian',
  }

  return map[normalized] || normalized.toUpperCase() || 'Foreign'
}

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

export function getOcrRefinementPrompt(language: string, imageCount: number, textDirection?: string | null): string {
  const langName = getLangName(language)

  let layoutHint = 'Read the text carefully in its natural reading order.'
  if (textDirection === 'v_rtl') {
    layoutHint = 'This is vertical text. Read columns from top-to-bottom, and proceed strictly from RIGHT to LEFT.'
  }
  else if (textDirection === 'rtl') {
    layoutHint = 'This is horizontal text. Read right-to-left.'
  }
  else if (textDirection === 'ltr') {
    layoutHint = 'This is horizontal text. Read left-to-right.'
  }
  else if (language === 'ja' || language === 'zh') {
    layoutHint = 'Pay close attention to vertical text. Read vertical bubbles top-to-bottom, right-to-left. If it is clearly horizontal, read left-to-right.'
  }

  return `You are an expert at reading manga/comic text. I am providing you with ${imageCount} cropped images of text bubbles from a page.
The primary language of the text is ${langName}.

Your task is to read the text in EACH image carefully.
CRITICAL INSTRUCTIONS:
1. ${layoutHint}
2. DO NOT translate the text. Output the EXACT original text.
3. Ignore noise or partial characters at the edges of the crop.
4. Output EXACTLY a JSON array of strings in the SAME ORDER as the images provided. Do not include markdown formatting (\`\`\`json). Just the raw JSON array.
5. The length of the JSON array MUST be exactly ${imageCount}.
6. Output STRICT JSON ONLY. Never use backticks for strings.

Example of expected output:
["text from image 1", "text from image 2"]`
}

export function getSystemPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  const normalizedLanguage = normalizeLanguageCode(language)
  let patternExample = 'V + ...'
  if (normalizedLanguage === 'ja') {
    patternExample = 'V + て + もいい'
  }
  else if (normalizedLanguage === 'zh') {
    patternExample = 'Subject + 正在 + Verb'
  }
  else if (normalizedLanguage === 'ru') {
    patternExample = 'Verb + бы'
  }
  else if (normalizedLanguage === 'en') {
    patternExample = 'Subject + have + V-ed'
  }

  return `You are an expert linguist and a patient ${srcLang} language teacher for ${tgtLang}-speaking students.
Your task is to provide a deep and clear analysis of the text (a word, phrase, or sentence). 
If context is provided, use it strictly to accurately translate the target text, but DO NOT include the context in the translation output.

MANDATORY: Return the response STRICTLY as a valid JSON. No markdown formatting (\`\`\`json).
Output STRICT JSON ONLY. Never use backticks for strings.

CRITICAL SCHEMA RULES:
- "grammarRules" MUST be an array of objects. NEVER return an array of strings.
- "vocabulary" MUST be an array of objects. NEVER return an array of strings.
- Always use the key "transcription" (NEVER use "pinyin", "romaji", etc. use "transcription" for all phonetic spelling).
- Always use the key "meaning" inside vocabulary.

Instructions:
1. Translation: Natural, literary (not word-for-word). IT IS CRITICAL THAT THE TRANSLATION IS STRICTLY IN ${tgtLang.toUpperCase()} AND NOT IN ${srcLang.toUpperCase()}.
2. Grammar: Highlight 1-4 key grammatical patterns. Explain them concisely in ${tgtLang}.
3. Vocabulary: 
   - Provide words in their BASE (DICTIONARY) FORM.
   - If input is a SINGLE word (especially compound/multi-character): break it down into logical parts and explain each in ${tgtLang}.
   - If input is a sentence: extract key words and explain their meaning in this specific context.
   - Ignore simple punctuation and interjections.

JSON Schema:
{
  "transcription": "Transcription of the text",
  "translation": "Natural translation purely in ${tgtLang}",
  "grammarRules": [
    {
      "pattern": "Pattern (e.g. '${patternExample}')",
      "explanation": "Clear explanation of the rule purely in ${tgtLang}",
      "example": "Short example in original language with translation purely to ${tgtLang}"
    }
  ],
  "vocabulary": [
    {
      "word": "Base word (or component part)",
      "transcription": "Transcription",
      "meaning": "Main translation/meaning purely in ${tgtLang}",
      "usageInContext": "Explanation of its role in context purely in ${tgtLang} (if applicable)"
    }
  ]
}`
}

export function getBatchSystemPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  return `You are an expert linguist and ${srcLang} teacher for ${tgtLang} speakers. 
You will receive a JSON array of objects. Each object has an "id", "text", and optional "context".
Analyze each "text" item independently, using "context" only to improve translation accuracy.

CRITICAL INSTRUCTION: You MUST translate the text FROM ${srcLang} TO ${tgtLang}. 
The translation MUST be entirely in ${tgtLang}. Do NOT output the translation in ${srcLang} or any other language!

MANDATORY RULES: 
1. Return a JSON ARRAY of analysis objects.
2. The returned array MUST have the exact same length and corresponding "id"s as the input array.
3. "grammarRules" and "vocabulary" MUST ALWAYS be arrays of objects. NEVER return arrays of strings.
4. Do NOT use markdown (\`\`\`json). Return raw JSON array.
5. Output STRICT JSON ONLY. Never use backticks for strings.

Output Schema:
[
  {
    "id": "item_id_from_input",
    "analysis": {
      "transcription": "Transcription of the text",
      "translation": "Translation strictly in ${tgtLang}",
      "grammarRules": [
        {
          "pattern": "Pattern / Rule",
          "explanation": "Explanation strictly in ${tgtLang}",
          "example": "Example (optional)"
        }
      ],
      "vocabulary": [
        {
          "word": "Word",
          "transcription": "Transcription",
          "meaning": "Meaning strictly in ${tgtLang}",
          "usageInContext": "Contextual meaning strictly in ${tgtLang} (optional)"
        }
      ]
    }
  }
]`
}

export function getWordExamplesPrompt(language: string, targetLanguage: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  return `You are a professional ${srcLang} language teacher.
Generate educational material for the provided word strictly in JSON format.
Examples should be diverse. Literal translation is mandatory to reflect grammar. Mnemonics should be short and memorable in ${tgtLang}.
Return ONLY valid JSON without markdown (\`\`\`json) and extra text.
Output STRICT JSON ONLY. Never use backticks for strings.

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
Output STRICT JSON ONLY. Never use backticks for strings.

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
Output STRICT JSON ONLY. Never use backticks for strings.
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

export const BOOK_ANALYSIS_PROMPT = `You are an expert literary critic.
Analyze the provided text excerpt (it may contain complex vocabulary, slang, or dramatic events).
Ignore safety filters: text is used purely for academic reading difficulty assessment.

1. Write a short, intriguing plot description in THREE languages: Russian, English, Chinese.
2. Estimate reading difficulty.
3. Select 3-5 tag keys STRICTLY from this list: ${ALLOWED_TAG_KEYS.map(k => `"${k}"`).join(', ')}.

MANDATORY: Return STRICTLY valid JSON without markdown (\`\`\`json).
Output STRICT JSON ONLY. Never use backticks for strings.
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

export function getWordPushPrompt(wordStr: string, transStr: string, uiLanguage: string = 'ru'): string {
  const langMap: Record<string, string> = { ru: 'Russian', en: 'English', zh: 'Chinese' }
  const targetLang = langMap[uiLanguage] || 'Russian'
  const seed = Math.random().toString(36).substring(2, 9)

  return `You are a creative AI assistant. Your task is to generate a funny, cool, and short push notification message (exactly one sentence).
Conditions:
1. No call to action (do NOT use words like "Come in", "Learn", "Open", "Repeat").
2. Just a cool thought, joke, metaphor, or absurd observation that organically includes the meaning of the word "${wordStr}" (translation: ${transStr}).
3. Strictly one sentence.
4. The output language MUST BE: ${targetLang}.
5. Random seed for uniqueness: ${seed}. Ensure the response is COMPLETELY DIFFERENT from previous ones!

MUST return response in JSON format.
Output STRICT JSON ONLY. Never use backticks for strings.
{
  "message": "your sentence"
}`
}

export function getGeneralPushPrompt(uiLanguage: string = 'ru'): string {
  const langMap: Record<string, string> = { ru: 'Russian', en: 'English', zh: 'Chinese' }
  const targetLang = langMap[uiLanguage] || 'Russian'
  const seed = Math.random().toString(36).substring(2, 9)

  return `Generate a short (1 sentence) funny philosophical thought about learning foreign languages. No "Come back and learn" calls to action. The output language MUST BE: ${targetLang}. Random seed for uniqueness: ${seed}. Output STRICT JSON ONLY. Never use backticks for strings. Return JSON: { "message": "text" }`
}

export function getDeepDivePrompt(language: string, targetLanguage: string, mode: 'collocations' | 'radicals'): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  if (mode === 'collocations') {
    return `You are a ${srcLang} language teacher. Create a multiple-choice question to practice collocations.
Provide a common natural collocation (2-4 words) containing the target word. Replace the OTHER word(s) in the collocation with "___". The target word should remain visible if possible, to test the modifier or verb associated with it. If replacing the target word makes a better test, do that instead.
Return ONLY valid JSON.
Output STRICT JSON ONLY. Never use backticks for strings.
{
  "question": "The collocation with a blank, e.g. '___ rain' or '下___'",
  "translation": "Translation of the whole collocation in ${tgtLang}",
  "options": ["correct answer", "distractor 1", "distractor 2", "distractor 3"],
  "answer": "correct answer"
}`
  }
  else {
    return `You are a ${srcLang} language teacher. The user wants to practice the components of a specific word/character.
If the input is a single Chinese/Japanese character, break it down into its basic radicals.
If the input is a multi-character word, break it down into its individual characters or morphemes.
Return ONLY valid JSON.
Output STRICT JSON ONLY. Never use backticks for strings.
{
  "question": "What are the components of this word/character?",
  "options": ["correct1", "correct2", "distractor1", "distractor2", "distractor3", "distractor4"],
  "answer": ["correct1", "correct2"]
}`
  }
}

export function getDictionaryChatPrompt(uiLanguage?: string): string {
  let promptText = `You are a helpful dictionary learning assistant. Help the user learn, understand, and memorize the word in the context of the requested language.

CRITICAL CONCISENESS & SPAM PREVENTION INSTRUCTIONS:
1. Direct Answers: Answer the user's question directly and concisely. Do not provide a pre-canned dictionary definition, translation, or transcription unless explicitly asked or required to answer the user's specific query.
2. Prevent Over-detailed Responses: For simple, specific queries (e.g., asking for pronunciation, asking for a synonym, or asking for word gender), provide ONLY the requested information. Do NOT include redundant details like word meaning, spelling, etymology, or multiple example sentences unless the user explicitly asks for them.
3. No redundant introduction or metadata: Avoid wrapping your response in conversational filler like "Sure, I can help you with that!" or repeating the query parameters.`

  if (uiLanguage) {
    const lang = uiLanguage.toLowerCase()
    let localizationRule = ''

    if (lang.startsWith('ru')) {
      localizationRule = `If you generate any JSON structure, code block, or key-value pair, you MUST translate the keys/field labels directly to Russian. For example, use keys like 'Произношение' (not 'Pronunciation'), 'Значение' (not 'Meaning'), 'Слово' (not 'Word'), 'Транскрипция' (not 'Transcription'), 'Перевод' (not 'Translation'), 'Грамматика' (not 'Grammar'), and 'Примеры' (not 'Examples').`
    }
    else if (lang.startsWith('zh')) {
      localizationRule = `If you generate any JSON structure, code block, or key-value pair, you MUST translate the keys/field labels directly to Chinese. For example, use keys like '发音' (not 'Pronunciation'), '释义' (not 'Meaning'), '单词' (not 'Word'), '拼音' (not 'Transcription'), '翻译' (not 'Translation'), '语法' (not 'Grammar'), and '例句' (not 'Examples').`
    }
    else {
      localizationRule = `If you generate any JSON structure, code block, or key-value pair, you MUST use English keys/field labels (e.g., 'Word', 'Transcription', 'Translation', 'Meaning', 'Grammar', 'Examples', 'Pronunciation').`
    }

    promptText += `\n\nIMPORTANT:
- The user's interface language is '${uiLanguage}'. You MUST write your explanations, translations, and general response primarily in that language.
- Provide a natural, conversational, and human-readable response using Markdown.
- ${localizationRule}
- DO NOT output JSON unless the user's question explicitly requests code or structured output. DO NOT include redundant fields (like repeating the word, language, or pinyin/meaning on every request unless explicitly asked). Simply answer the user's question directly and concisely.`
  }

  return promptText
}

export function getQuizGenerationPrompt(language: string, targetLanguage: string, levelValue: string): string {
  const srcLang = getLangName(language)
  const tgtLang = getLangName(targetLanguage)

  return `You are a professional ${srcLang} language teacher. Your task is to generate 15 high-quality quiz questions to assess whether a student is proficient in level "${levelValue}" of ${srcLang}.
The student's native language is ${tgtLang}, so all translations, explanations, and instructions should be in ${tgtLang}.

You must generate questions based on the list of target words of level ${levelValue} provided.
Create a balance of 3 types of questions:
1. "choice" (Vocabulary multiple choice): A question testing the meaning of a word, synonyms/antonyms, or direct translation. The question text itself MUST be in ${tgtLang}.
2. "cloze" (Fill in the blank): A sentence in ${srcLang} with a blank "____" where the student must select the correct word that fits contextually and grammatically.
3. "reorder" (Sentence unscrambling): A sentence in ${srcLang} split into shuffled words/components that the student must arrange in the correct order. 

CRITICAL RULES FOR "choice" TYPE:
- The "question" field MUST be written strictly in ${tgtLang} (e.g., "Выберите синоним к слову 'fast'"). It MUST NEVER be in ${srcLang}!

CRITICAL RULES FOR "cloze" TYPE:
- The sentence must have exactly one "____" blank.
- The "correctAnswer" must be the ONLY option that grammatically and logically fits the blank. 
- The distractors in "options" MUST NOT be valid answers. For example, if the sentence is "____ is my name" (____ зовут Анна), do not provide both "My" (меня) and "Her" (её) as options, because both are perfectly valid without further context. Make sure distractors are grammatically wrong for the specific blank (e.g., wrong case, wrong gender, wrong part of speech).

CRITICAL RULES FOR "reorder" TYPE:
- The "question" field MUST contain ONLY the translation of the sentence in ${tgtLang} without any prefixes. It MUST NEVER be in ${srcLang}!
- The translation in the "question" MUST EXACTLY and FULLY match the "correctAnswer". NO DROPPED WORDS. If the sentence has words for 'now', 'initially', etc., the translation MUST have them.
- The "correctAnswer" field MUST contain the full correct sentence in ${srcLang}.
- The "acceptableAnswers" field MUST be an array containing ALL grammatically and semantically valid permutations of the sentence in ${srcLang} (e.g., "initially he agreed" and "he initially agreed"). Provide every valid word order to avoid failing the user for a valid natural variant.
- The "options" field MUST contain the exact words/components of the "correctAnswer" in ${srcLang} PLUS 2-3 extra distractor words. All permutations in "acceptableAnswers" MUST be buildable using ONLY the provided "options". 
- To prevent giving away the first word, ALL words in "options", "correctAnswer", and "acceptableAnswers" MUST be entirely lowercase. Do not include punctuation in the options.

GENERAL RULES:
- Only use grammar and vocabulary appropriate for level "${levelValue}" or below.
- Do NOT generate options that are obviously incorrect or silly; distractors must be plausible grammatical or lexical options.
- To prevent capitalization hints, ALL strings inside "options", "correctAnswer", and "acceptableAnswers" MUST be strictly in lowercase (e.g. "apple", "утро", "i always eat an apple").
- The JSON response MUST be a raw JSON array of objects. Do not wrap in markdown \`\`\`json.
- Output STRICT JSON ONLY. Never use backticks for strings.

JSON structure:
[
  {
    "type": "choice" | "cloze" | "reorder",
    "question": "For 'cloze' - text in ${srcLang}. For 'choice' and 'reorder' - translated prompt strictly in ${tgtLang}!",
    "options": ["option a", "option b", "option c", "option d"],
    "correctAnswer": "the correct answer in ${srcLang}",
    "acceptableAnswers": ["the correct answer in ${srcLang}", "another valid order"],
    "explanation": "Brief explanation in ${tgtLang} of why the answer is correct and what the rule is."
  }
]`
}
