import type {
  AlternativeVariant,
  CharacterNode,
  ChineseSentenceAnalysis,
  CollocationExample,
  ComponentNode,
  ComponentRoleType,
  DependencyArc,
  GrammarPatternItem,
  LexemeToken,
  PartOfSpeechCode,
  PhoneticsAnalysis,
  SentenceOverview,
  SyllableTonePoint,
  SyntacticClause,
  ToneSandhiRuleItem,
  UsageContextInfo,
} from '../../modules/chinese-analyzer/model'
import { detectInputLanguage, normalizeToneNumber } from './tone-utils'

export function buildAnalyzerSystemPrompt(interfaceLang = 'ru'): string {
  const targetLangName = interfaceLang === 'en' ? 'English' : 'Russian'

  return `You are an elite Chinese (Mandarin) linguist, sinologist, and pedagogical architect.
Your task is to perform an exhaustive, multi-layered structural, lexical, morphological, phonetic, grammatical, and pragmatic analysis of a sentence.

INPUT HANDLING:
1. If the input is in Chinese, preserve the wording of the sentence and analyze its Simplified Chinese form.
2. If the user input is in Russian or English, FIRST translate it into natural, idiomatic Mandarin in Simplified Chinese, and then perform the complete analysis on that Chinese sentence.
3. All explanations, translations, grammatical roles, etymologies, and notes MUST be written in ${targetLangName}. Use Simplified Chinese for all Chinese output, including words, characters, phonetic examples, and alternative sentences. Preserve the exact input in "originalInput".

OUTPUT FORMAT:
Return STRICT RAW JSON matching this exact structure (no markdown code fences):
{
  "sentence": {
    "inputLanguage": "zh" | "ru",
    "originalInput": "exact user query",
    "hanzi": "Simplified Chinese sentence (without trailing spaces)",
    "pinyin": "Full sentence pinyin with tone marks",
    "translation": "Natural literary translation in ${targetLangName}. If there are multiple sentences, separate each sentence with a newline (\\n).",
    "literalTranslation": "Word-by-word literal gloss showing Chinese structural logic (e.g. 'Я / недавно / по отношению к / китайской традиционной культуре / всё более / испытывать интерес / [смена состояния]'). If there are multiple sentences, separate each sentence with a newline (\\n).",
    "hskLevel": "HSK 1" | "HSK 2" | "HSK 3" | "HSK 4" | "HSK 5" | "HSK 6",
    "register": "Разговорный / Нейтральный / Официальный / Книжный",
    "sentenceType": "Grammatical sentence type (e.g. Топик-комментарий, Конструкция с 把, Повествовательное SVO)",
    "structuralFormula": "High-level syntactic formula (e.g. [Субъект] + [Время] + 对 + [Объект] + [Степень] + [Предикат] + 了). If there are multiple sentences, put each sentence's formula on a separate line (\\n)."
  },
  "clauses": [
    {
      "id": "c1",
      "label": "Syntactic group title (e.g. Тема и время, Предложная группа мишени, Глагольная группа состояния)",
      "role": "Syntactic function (e.g. Subject + Time Adjunct, Prepositional Object, Predicate Phrase)",
      "hanzi": "Substring of characters in this block",
      "translation": "Meaning of this syntactic block",
      "tokenIds": ["t1", "t2"]
    }
  ],
  "tokens": [
    {
      "id": "t1",
      "hanzi": "Word in Simplified Chinese (exclude punctuation tokens)",
      "pinyin": "Word pinyin with tone marks",
      "tones": [3, 4],
      "toneSandhiNote": "Optional note if tone sandhi applies to this word in context, otherwise empty string",
      "sentenceIndex": 0,
      "trailingPunctuation": "Punctuation immediately following this word in the sentence (e.g. '，', '？', '。', or '')",
      "pos": "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "particle" | "measure" | "conj" | "idiom" | "num" | "other",
      "posLabel": "Localized part of speech name",
      "syntacticRole": "Exact syntactic role in this sentence (e.g. Подлежащее, Обстоятельство времени, Предлог направления, Сказуемое)",
      "meaning": "Meaning in this specific sentence",
      "dictionaryMeaning": "Broader dictionary meanings separated by commas",
      "hsk": "HSK 1..6",
      "grammarNote": "Detailed explanation of how this word operates grammatically here and why it occupies this position",
      "collocations": [
        { "hanzi": "collocation", "pinyin": "pinyin", "translation": "translation" }
      ],
      "characters": [
        {
          "char": "Single character",
          "pinyin": "char pinyin",
          "tone": 1 | 2 | 3 | 4 | 5,
          "meaning": "Core meaning of this individual character",
          "roleInWord": "How this character combines with the other character(s) to form the word's meaning",
          "etymology": "Origin, structure type (пиктограмма / идеограмма / фоноидеограмма 形声字) and memorable mnemonic",
          "structureType": "Фоноидеограмма (形声) / Идеограмма (会意) / Пиктограмма (象形)",
          "components": [
            {
              "symbol": "Radical or component char (e.g. 氵, 心, 青)",
              "name": "Component name and pinyin",
              "meaning": "Meaning or phonetic value of this component",
              "type": "semantic" | "phonetic" | "radical"
            }
          ]
        }
      ]
    }
  ],
  "dependencies": [
    {
      "id": "d1",
      "fromTokenId": "head token id (e.g. t5)",
      "toTokenId": "dependent token id (e.g. t1)",
      "relationLabel": "Short syntactic relation label (e.g. субъект, модификатор, объект, маркер аспекта)"
    }
  ],
  "phonetics": {
    "rhythmGrouping": "Sentence split with ' / ' showing natural native breathing pauses",
    "intonationNote": "Advice on overall sentence intonation, stress, and emotional cadence",
    "sandhiRules": [
      {
        "title": "Rule name (e.g. Сандхи третьего тона 3+3 → 2+3, Изменение тона 不/一)",
        "before": "Base pinyin",
        "after": "Spoken pinyin",
        "explanation": "Why the tone changes in connected speech"
      }
    ],
    "syllables": [
      {
        "hanzi": "Single syllable character",
        "pinyin": "Syllable pinyin",
        "baseTone": 1 | 2 | 3 | 4 | 5,
        "spokenTone": 1 | 2 | 3 | 4 | 5,
        "sandhiApplied": true | false,
        "note": "Optional brief phonetic note"
      }
    ]
  },
  "grammarPatterns": [
    {
      "id": "g1",
      "name": "Pattern title (e.g. Конструкция 对...感兴趣)",
      "formula": "A + 对 + B + 感兴趣",
      "level": "HSK 3",
      "explanation": "Thorough explanation of the grammar pattern and word order",
      "commonMistakes": "Typical mistake learners make and how to avoid it",
      "examples": [
        { "hanzi": "Example sentence", "pinyin": "pinyin", "translation": "translation" }
      ]
    }
  ],
  "usageContext": {
    "whenToUse": "Detailed explanation of when and with whom this phrasing is used",
    "formalityScore": 3,
    "formalityLabel": "Нейтрально-уважительный",
    "emotionalNuance": "Emotional tone and subtle connotations",
    "culturalNote": "Cultural or pragmatic insight about Chinese communication",
    "typicalContexts": ["Знакомство", "Обсуждение хобби", "Повседневная беседа"]
  },
  "alternatives": [
    {
      "hanzi": "Alternative Chinese sentence",
      "pinyin": "Pinyin with tones",
      "translation": "Translation",
      "register": "Разговорный / Официальный / Экспрессивный / Простой",
      "nuance": "How this variant differs in nuance or situation from the main sentence"
    }
  ]
}

CRITICAL QUALITY RULES:
- Every multi-character word in "tokens" MUST have ALL of its constituent characters broken down in "characters", and each character MUST have 1 to 3 "components" (radicals/semantic/phonetic parts).
- Even single-character words in "tokens" MUST have that character in "characters" with its radical/component decomposition.
- Include at least 3-4 "alternatives" across different registers (casual, formal/literary, simpler, more expressive).
- Include 2-4 "grammarPatterns" covering the key constructions and word order rules of the sentence.`
}

export function buildAnalyzerUserPrompt(input: string): string {
  const clean = input.trim()
  const detected = detectInputLanguage(clean)
  const modeHint = detected === 'zh'
    ? 'The input is in Chinese. Analyze this exact sentence deeply.'
    : 'The input is in Russian. Translate it into the most natural, authentic Mandarin Chinese sentence and perform a complete multi-layered breakdown of that Chinese sentence.'

  return `User Input: "${clean}"
Mode: ${modeHint}
Generate the complete JSON analysis object now.`
}

function asRecord(val: unknown): Record<string, unknown> {
  return (val && typeof val === 'object' && !Array.isArray(val))
    ? val as Record<string, unknown>
    : {}
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : []
}

function normalizeComponentType(val: unknown): ComponentRoleType {
  if (val === 'semantic' || val === 'phonetic' || val === 'radical') {
    return val
  }

  return 'radical'
}

function normalizeComponent(raw: unknown): ComponentNode {
  const obj = asRecord(raw)

  return {
    symbol: asString(obj.symbol, '部'),
    name: asString(obj.name, 'Ключ'),
    meaning: asString(obj.meaning, 'Составной элемент'),
    type: normalizeComponentType(obj.type),
  }
}

function normalizeCharacter(raw: unknown, fallbackChar = '字'): CharacterNode {
  const obj = asRecord(raw)
  const char = asString(obj.char, fallbackChar)
  const pinyin = asString(obj.pinyin, '')
  const components = asArray(obj.components).map(normalizeComponent)

  return {
    char,
    pinyin,
    tone: normalizeToneNumber(obj.tone, pinyin),
    meaning: asString(obj.meaning, ''),
    roleInWord: asString(obj.roleInWord, ''),
    etymology: asString(obj.etymology, ''),
    structureType: asString(obj.structureType, ''),
    components,
  }
}

function normalizeCollocation(raw: unknown): CollocationExample {
  const obj = asRecord(raw)

  return {
    hanzi: asString(obj.hanzi),
    pinyin: asString(obj.pinyin),
    translation: asString(obj.translation),
  }
}

function normalizePos(val: unknown): PartOfSpeechCode {
  const allowed: PartOfSpeechCode[] = [
    'noun',
    'verb',
    'adj',
    'adv',
    'pron',
    'prep',
    'particle',
    'measure',
    'conj',
    'idiom',
    'num',
    'other',
  ]
  const str = asString(val, 'other') as PartOfSpeechCode

  return allowed.includes(str) ? str : 'other'
}

function ensureTokenCharacters(hanzi: string, pinyin: string, rawChars: unknown[]): CharacterNode[] {
  if (rawChars.length > 0) {
    return rawChars.map((item, idx) => normalizeCharacter(item, hanzi[idx] || hanzi))
  }

  const syllables = pinyin.split(/\s+/).filter(Boolean)

  return Array.from(hanzi).map((ch, idx) => normalizeCharacter({
    char: ch,
    pinyin: syllables[idx] || pinyin,
  }, ch))
}

function normalizeToken(raw: unknown, idx: number): LexemeToken {
  const obj = asRecord(raw)
  const hanzi = asString(obj.hanzi, '?')
  const pinyin = asString(obj.pinyin, '')
  const characters = ensureTokenCharacters(hanzi, pinyin, asArray(obj.characters))
  const rawTones = asArray(obj.tones).map(t => normalizeToneNumber(t))
  const tones = rawTones.length > 0 ? rawTones : characters.map(c => c.tone)
  const rawSentenceIndex = Number(obj.sentenceIndex)
  const sentenceIndex = Number.isFinite(rawSentenceIndex) && rawSentenceIndex >= 0
    ? Math.floor(rawSentenceIndex)
    : undefined

  return {
    id: asString(obj.id, `t${idx + 1}`),
    hanzi,
    pinyin,
    tones,
    toneSandhiNote: asString(obj.toneSandhiNote, ''),
    sentenceIndex,
    trailingPunctuation: asString(obj.trailingPunctuation, ''),
    pos: normalizePos(obj.pos),
    posLabel: asString(obj.posLabel, 'Лексема'),
    syntacticRole: asString(obj.syntacticRole, 'Член предложения'),
    meaning: asString(obj.meaning, ''),
    dictionaryMeaning: asString(obj.dictionaryMeaning, asString(obj.meaning, '')),
    hsk: asString(obj.hsk, 'HSK'),
    grammarNote: asString(obj.grammarNote, ''),
    collocations: asArray(obj.collocations).map(normalizeCollocation).filter(c => Boolean(c.hanzi)),
    characters,
  }
}

function normalizeClause(raw: unknown, idx: number): SyntacticClause {
  const obj = asRecord(raw)

  return {
    id: asString(obj.id, `c${idx + 1}`),
    label: asString(obj.label, `Блок ${idx + 1}`),
    role: asString(obj.role, ''),
    hanzi: asString(obj.hanzi, ''),
    translation: asString(obj.translation, ''),
    tokenIds: asArray(obj.tokenIds).map(id => asString(id)).filter(Boolean),
  }
}

function normalizeDependency(raw: unknown, idx: number): DependencyArc {
  const obj = asRecord(raw)

  return {
    id: asString(obj.id, `d${idx + 1}`),
    fromTokenId: asString(obj.fromTokenId),
    toTokenId: asString(obj.toTokenId),
    relationLabel: asString(obj.relationLabel, 'связь'),
  }
}

function normalizeSandhiRule(raw: unknown): ToneSandhiRuleItem {
  const obj = asRecord(raw)

  return {
    title: asString(obj.title),
    before: asString(obj.before),
    after: asString(obj.after),
    explanation: asString(obj.explanation),
  }
}

function normalizeSyllable(raw: unknown): SyllableTonePoint {
  const obj = asRecord(raw)
  const pinyin = asString(obj.pinyin)
  const baseTone = normalizeToneNumber(obj.baseTone, pinyin)
  const spokenTone = normalizeToneNumber(obj.spokenTone ?? obj.baseTone, pinyin)

  return {
    hanzi: asString(obj.hanzi),
    pinyin,
    baseTone,
    spokenTone,
    sandhiApplied: Boolean(obj.sandhiApplied) || baseTone !== spokenTone,
    note: asString(obj.note),
  }
}

function buildFallbackSyllables(tokens: LexemeToken[]): SyllableTonePoint[] {
  const list: SyllableTonePoint[] = []

  for (const token of tokens) {
    for (const ch of token.characters) {
      list.push({
        hanzi: ch.char,
        pinyin: ch.pinyin,
        baseTone: ch.tone,
        spokenTone: ch.tone,
        sandhiApplied: false,
      })
    }
  }

  return list
}

function normalizePhonetics(raw: unknown, tokens: LexemeToken[]): PhoneticsAnalysis {
  const obj = asRecord(raw)
  const rawSyllables = asArray(obj.syllables).map(normalizeSyllable).filter(s => Boolean(s.hanzi))
  const syllables = rawSyllables.length > 0 ? rawSyllables : buildFallbackSyllables(tokens)

  return {
    rhythmGrouping: asString(obj.rhythmGrouping, tokens.map(t => t.hanzi).join(' / ')),
    intonationNote: asString(obj.intonationNote, ''),
    sandhiRules: asArray(obj.sandhiRules).map(normalizeSandhiRule).filter(r => Boolean(r.title)),
    syllables,
  }
}

function normalizeGrammarPattern(raw: unknown, idx: number): GrammarPatternItem {
  const obj = asRecord(raw)

  return {
    id: asString(obj.id, `g${idx + 1}`),
    name: asString(obj.name, `Грамматическая конструкция ${idx + 1}`),
    formula: asString(obj.formula, ''),
    level: asString(obj.level, 'HSK'),
    explanation: asString(obj.explanation, ''),
    commonMistakes: asString(obj.commonMistakes, ''),
    examples: asArray(obj.examples).map(normalizeCollocation).filter(e => Boolean(e.hanzi)),
  }
}

function normalizeUsageContext(raw: unknown): UsageContextInfo {
  const obj = asRecord(raw)
  const rawScore = Number(obj.formalityScore)
  const formalityScore = Number.isFinite(rawScore) ? Math.min(5, Math.max(1, Math.round(rawScore))) : 3

  return {
    whenToUse: asString(obj.whenToUse, ''),
    formalityScore,
    formalityLabel: asString(obj.formalityLabel, 'Нейтральный регистр'),
    emotionalNuance: asString(obj.emotionalNuance, ''),
    culturalNote: asString(obj.culturalNote, ''),
    typicalContexts: asArray(obj.typicalContexts).map(c => asString(c)).filter(Boolean),
  }
}

function normalizeAlternative(raw: unknown): AlternativeVariant {
  const obj = asRecord(raw)

  return {
    hanzi: asString(obj.hanzi),
    pinyin: asString(obj.pinyin),
    translation: asString(obj.translation),
    register: asString(obj.register, 'Альтернатива'),
    nuance: asString(obj.nuance, ''),
  }
}

function normalizeSentenceOverview(raw: unknown, originalInput: string, tokens: LexemeToken[]): SentenceOverview {
  const obj = asRecord(raw)
  const detected = detectInputLanguage(originalInput)
  const fallbackHanzi = tokens.map(t => t.hanzi).join('')

  return {
    inputLanguage: obj.inputLanguage === 'ru' || detected === 'ru' ? 'ru' : 'zh',
    originalInput,
    hanzi: asString(obj.hanzi, fallbackHanzi || originalInput),
    pinyin: asString(obj.pinyin, tokens.map(t => t.pinyin).join(' ')),
    translation: asString(obj.translation, ''),
    literalTranslation: asString(obj.literalTranslation, ''),
    hskLevel: asString(obj.hskLevel, 'HSK 3'),
    register: asString(obj.register, 'Нейтральный'),
    sentenceType: asString(obj.sentenceType, 'Повествовательное'),
    structuralFormula: asString(obj.structuralFormula, 'Субъект + Предикат + Объект'),
  }
}

export function normalizeAnalysisResponse(raw: unknown, originalInput: string): ChineseSentenceAnalysis {
  const root = asRecord(raw)
  const tokens = asArray(root.tokens).map(normalizeToken)
  const clauses = asArray(root.clauses).map(normalizeClause)
  const dependencies = asArray(root.dependencies)
    .map(normalizeDependency)
    .filter(d => Boolean(d.fromTokenId && d.toTokenId))

  return {
    sentence: normalizeSentenceOverview(root.sentence, originalInput, tokens),
    clauses,
    tokens,
    dependencies,
    phonetics: normalizePhonetics(root.phonetics, tokens),
    grammarPatterns: asArray(root.grammarPatterns).map(normalizeGrammarPattern),
    usageContext: normalizeUsageContext(root.usageContext),
    alternatives: asArray(root.alternatives).map(normalizeAlternative).filter(a => Boolean(a.hanzi)),
  }
}
