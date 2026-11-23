import type {
  AlternativeVariant,
  CollocationExample,
  DependencyArc,
  GrammarPatternItem,
  InputLanguageCode,
  MorphemeFeatureNode,
  MorphemeFeatureType,
  MorphemeNode,
  MorphemeType,
  PhoneticRuleItem,
  RussianCaseCode,
  RussianLexemeToken,
  RussianMorphologyMeta,
  RussianPhoneticsAnalysis,
  RussianPosCode,
  RussianSentenceAnalysis,
  RussianSentenceOverview,
  SyntacticClause,
  UsageContextInfo,
  WordPhoneticCard,
  WordStressSyllable,
} from '../../modules/russian-analyzer/model'
import { detectRussianAnalyzerInputLanguage, stripStressMarks } from './russian-utils'

function resolveTargetLanguageName(interfaceLang: string): string {
  const norm = interfaceLang.toLowerCase()

  if (norm.startsWith('zh')) {
    return 'Simplified Chinese (简体中文)'
  }

  if (norm.startsWith('ru')) {
    return 'Russian'
  }

  return 'English'
}

export function buildRussianAnalyzerSystemPrompt(interfaceLang = 'en'): string {
  const targetLangName = resolveTargetLanguageName(interfaceLang)

  return `You are an elite Russian linguist, Slavist, and Russian-as-a-Foreign-Language (РКИ) professor teaching students whose interface language is ${targetLangName}.
Your task is to perform an exhaustive, multi-layered structural, morphological, morphemic, phonetic, grammatical, and pragmatic analysis of a Russian sentence.

INPUT HANDLING:
1. If the user input is in Russian, analyze that exact Russian sentence (or sentences).
2. If the user input is in Chinese or English, FIRST translate it into the most natural, authentic modern Russian sentence (with accurate word stress using combining acute accent U+0301, e.g. "сего́дня", "оста́ться", "поэ́тому"), and then perform the complete analysis on that Russian sentence.
3. All explanations, translations, grammatical roles, case explanations, morpheme meanings, phonetic notes, and cultural insights MUST be written strictly in ${targetLangName}.
4. Always keep Russian words/lemmas/morphemes/examples in Russian Cyrillic with stress marks where appropriate (e.g. "приве́т", "до́ма", "ё" always written as "ё").

OUTPUT FORMAT:
Return STRICT RAW JSON matching this exact structure (no markdown code fences):
{
  "sentence": {
    "inputLanguage": "ru" | "zh" | "en",
    "originalInput": "exact user query",
    "plainText": "Clean Russian sentence(s) without acute stress marks",
    "stressedText": "Russian sentence(s) with combining acute stress marks (U+0301) on stressed vowels (e.g. 'Я сего́дня о́чень уста́л, поэ́тому реши́л оста́ться до́ма.')",
    "ipa": "Broad phonetic transcription of the sentence in IPA (e.g. '[ja sʲɪˈvodʲnʲə ˈotɕɪnʲ ʊˈstaɫ]')",
    "translation": "Natural literary translation in ${targetLangName}. If there are multiple sentences, separate each sentence with a newline (\\n).",
    "literalTranslation": "Word-for-word literal gloss in ${targetLangName} showing Russian case/aspect logic. If there are multiple sentences, separate each sentence with a newline (\\n).",
    "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    "register": "Stylistic register in ${targetLangName} (e.g. Conversational / Neutral / Formal / Literary)",
    "sentenceType": "Grammatical sentence type in ${targetLangName} (e.g. Complex sentence with cause clause, Impersonal sentence Безличное, Simple verbal)",
    "structuralFormula": "High-level syntactic & case formula in ${targetLangName} (e.g. '[Subj (Nom)] + [Verb (Pfv, Past)] + [Inf (Pfv)] + [Locative Adv]'). Separate multiple sentences with \\n."
  },
  "clauses": [
    {
      "id": "c1",
      "label": "Syntactic clause/group title in ${targetLangName} (e.g. Main clause, Subordinate cause clause, Prepositional phrase)",
      "role": "Syntactic function in ${targetLangName}",
      "text": "Russian text of this clause/group",
      "translation": "Meaning of this block in ${targetLangName}",
      "tokenIds": ["t1", "t2"]
    }
  ],
  "tokens": [
    {
      "id": "t1",
      "word": "Word as it appears in plainText (exclude standalone punctuation)",
      "stressedWord": "Same word with combining acute stress mark U+0301 (e.g. 'сего́дня')",
      "lemma": "Dictionary base form (e.g. Nominative singular for nouns/adjectives, Infinitive for verbs)",
      "ipa": "Phonetic transcription of this word in connected speech (e.g. '[sʲɪˈvodʲnʲə]')",
      "sentenceIndex": 0,
      "trailingPunctuation": "Punctuation immediately following this word (e.g. ',', '?', '.', or '')",
      "pos": "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "particle" | "conj" | "num" | "participle" | "other",
      "posLabel": "Localized part of speech name in ${targetLangName}",
      "syntacticRole": "Exact syntactic role in ${targetLangName}",
      "meaning": "Contextual meaning in ${targetLangName}",
      "dictionaryMeaning": "Broader dictionary meanings in ${targetLangName}",
      "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "grammarNote": "Detailed explanation in ${targetLangName} of why this word takes this exact form, case, or verb aspect",
      "caseGovernmentNote": "If this word governs a case (verb/preposition) or is governed by one, explain the exact case rule (e.g. 'в + Accusative for motion toward'), else empty string",
      "morphology": {
        "caseCode": "nom" | "gen" | "dat" | "acc" | "ins" | "loc" | "none",
        "caseLabel": "Localized case name (e.g. 'Genitive (Родительный)' / '第二格 (生格)' / ''), empty if not declined",
        "caseQuestion": "Russian case question if applicable (e.g. 'кого? чего?', 'кому? чему?', 'куда?')",
        "gender": "Localized gender if applicable (Masc / Fem / Neut)",
        "number": "Localized number if applicable (Singular / Plural)",
        "animacy": "Animate / Inanimate if relevant to Accusative/Genitive",
        "aspect": "Verb aspect if verb/participle (e.g. 'Perfective (СВ)' / 'Imperfective (НСВ)')",
        "aspectPair": "Corresponding aspect partner verb (e.g. 'устава́ть (НСВ) ↔ уста́ть (СВ)')",
        "tense": "Past / Present / Future / Infinitive if verb",
        "person": "1st / 2nd / 3rd person if conjugated",
        "mood": "Indicative / Imperative / Conditional if verb"
      },
      "collocations": [
        { "text": "Russian collocation", "stressedText": "Stressed collocation", "translation": "Translation in ${targetLangName}" }
      ],
      "morphemes": [
        {
          "text": "Morpheme text with hyphen hint (e.g. 'по-', 'реш', '-и-', '-л', '-ся', '-Ø')",
          "type": "prefix" | "root" | "suffix" | "ending" | "postfix",
          "meaning": "Concise meaning or grammatical function in ${targetLangName}",
          "roleInWord": "How this morpheme builds the word or changes its aspect/case/meaning in ${targetLangName}",
          "etymology": "Optional origin or learner mnemonic in ${targetLangName}",
          "features": [
            {
              "symbol": "Short tag or Russian cognate word (e.g. 'СВ', 'м.р. ед.ч.', 'реше́ние', 'Род.п.')",
              "label": "Short category or distinct note (do NOT duplicate explanation)",
              "explanation": "Concise grammatical meaning or cognate gloss in ${targetLangName}",
              "type": "grammar" | "cognate" | "meaning"
            }
          ]
        }
      ]
    }
  ],
  "dependencies": [
    {
      "id": "d1",
      "fromTokenId": "head token id",
      "toTokenId": "dependent token id",
      "relationLabel": "Short syntactic or case-government label in ${targetLangName} (e.g. '+Acc', 'Subject', 'Agreement', 'Cause')"
    }
  ],
  "phonetics": {
    "intonationType": "Bryzgunova Intonation Construction (e.g. 'ИК-1 (Declarative fall)' / 'ИК-3 (Yes/No rise)')",
    "intonationExplanation": "Brief explanation in ${targetLangName} of how the pitch moves across this Russian sentence",
    "rhythmGrouping": "Russian sentence split with ' / ' showing natural prosodic breath groups (separate multiple sentences with \\n)",
    "intonationNote": "Practical pronunciation advice in ${targetLangName} (linking prepositions, stress centers, cadence)",
    "phoneticRules": [
      {
        "sentenceIndex": 0,
        "title": "Rule title in ${targetLangName} (e.g. Vowel reduction Аканье, Final devoicing, -ться → [ца])",
        "written": "Written spelling (e.g. 'сего́дня')",
        "spoken": "Actual pronunciation (e.g. '[с’иво́дн’а]')",
        "explanation": "Why Russian is pronounced this way in ${targetLangName}"
      }
    ],
    "wordStressCards": [
      {
        "word": "Plain Russian word",
        "stressedWord": "Stressed Russian word",
        "ipa": "IPA for this word",
        "isSentenceFocus": true | false,
        "reductionNote": "Brief note if unstressed vowel reduction or consonant assimilation occurs here",
        "syllables": [
          {
            "text": "Syllable (e.g. 'се', 'го́', 'дня')",
            "stressed": true | false,
            "reduced": true | false,
            "phonetic": "Actual sound of this syllable (e.g. 'с’и', 'во́', 'дн’а')"
          }
        ]
      }
    ]
  },
  "grammarPatterns": [
    {
      "sentenceIndex": 0,
      "id": "g1",
      "name": "Grammar pattern title in ${targetLangName} (e.g. Case government, Verb aspect СВ vs НСВ, Reflexive -ся)",
      "formula": "Structural formula with case/aspect markers",
      "level": "A2 / B1 / B2",
      "explanation": "Thorough explanation in ${targetLangName} of how the construction works",
      "commonMistakes": "Typical mistake Chinese/English learners make with this Russian pattern and how to avoid it",
      "examples": [
        { "text": "Russian example", "stressedText": "Stressed Russian example", "translation": "Translation in ${targetLangName}" }
      ]
    }
  ],
  "usageContext": {
    "whenToUse": "When and with whom this phrasing is natural in ${targetLangName}",
    "formalityScore": 3,
    "formalityLabel": "Localized formality label (mentioning ты vs вы register when relevant)",
    "emotionalNuance": "Emotional tone and connotations in ${targetLangName}",
    "culturalNote": "Russian cultural or communicative insight in ${targetLangName}",
    "typicalContexts": ["Context tag 1", "Context tag 2", "Context tag 3"]
  },
  "alternatives": [
    {
      "sentenceIndex": 0,
      "text": "Alternative Russian sentence (plain)",
      "stressedText": "Alternative Russian sentence with stress marks",
      "ipa": "Broad IPA",
      "translation": "Translation in ${targetLangName}",
      "register": "Register tag (e.g. Casual ты / Polite вы / Formal / Simpler A2)",
      "nuance": "How this variant differs in tone or structure from the main sentence"
    }
  ]
}

CRITICAL QUALITY RULES:
- Every content word (noun, verb, adjective, pronoun, participle, adverb) in "tokens" MUST be decomposed into authentic Russian "morphemes" (prefix / root / suffix / ending / postfix), and key morphemes MUST have 1-2 "features" (e.g. grammatical inflection meaning for endings, aspect shift for prefixes, or 1-2 Russian cognate words for roots).
- Include accurate combining acute stress marks (U+0301) in "stressedText" and "stressedWord" on all multi-syllable words (never mark stress on "ё" since "ё" is inherently stressed).
- Include 2-4 "grammarPatterns" focusing on Russian cases, verb aspect, prepositions, or word order.
- Include 3-4 "alternatives" covering casual (ты), polite (вы), formal/literary, and simpler registers.
- "wordStressCards" MUST contain exactly one card per item of "tokens", in the same order.
- MULTI-SENTENCE INPUT: when the text contains several sentences, number them 0, 1, 2... in reading order (the index increments after each sentence-ending punctuation mark). Every token MUST carry its "sentenceIndex". Every item of "grammarPatterns", "alternatives" and "phonetics.phoneticRules" MUST carry the "sentenceIndex" of the sentence it relates to (an alternative rewrites exactly that sentence). Omit "sentenceIndex" on an item only if it genuinely applies to the whole text. Cover every sentence in "grammarPatterns" and "alternatives".`
}

export function buildRussianAnalyzerUserPrompt(input: string): string {
  const clean = input.trim()
  const detected = detectRussianAnalyzerInputLanguage(clean)
  let modeHint = 'The input is in Russian. Analyze this exact Russian sentence deeply.'

  if (detected === 'zh') {
    modeHint = 'The input is in Chinese. Translate it into the most natural, authentic Russian sentence (with accurate stress marks) and perform a complete multi-layered breakdown of that Russian sentence.'
  }
  else if (detected === 'en') {
    modeHint = 'The input is in English. Translate it into the most natural, authentic Russian sentence (with accurate stress marks) and perform a complete multi-layered breakdown of that Russian sentence.'
  }

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

function asOptionalSentenceIndex(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const raw = Number(value)

  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : undefined
}

function normalizePos(val: unknown): RussianPosCode {
  const allowed: RussianPosCode[] = [
    'noun',
    'verb',
    'adj',
    'adv',
    'pron',
    'prep',
    'particle',
    'conj',
    'num',
    'participle',
    'other',
  ]
  const str = asString(val, 'other') as RussianPosCode

  return allowed.includes(str) ? str : 'other'
}

function normalizeCaseCode(val: unknown): RussianCaseCode {
  const allowed: RussianCaseCode[] = ['nom', 'gen', 'dat', 'acc', 'ins', 'loc', 'none']
  const str = asString(val, 'none').toLowerCase() as RussianCaseCode

  return allowed.includes(str) ? str : 'none'
}

function normalizeMorphemeType(val: unknown): MorphemeType {
  const allowed: MorphemeType[] = ['prefix', 'root', 'suffix', 'ending', 'postfix']
  const str = asString(val, 'root').toLowerCase() as MorphemeType

  return allowed.includes(str) ? str : 'root'
}

function normalizeFeatureType(val: unknown): MorphemeFeatureType {
  if (val === 'grammar' || val === 'cognate' || val === 'meaning') {
    return val
  }

  return 'grammar'
}

function normalizeFeature(raw: unknown): MorphemeFeatureNode {
  const obj = asRecord(raw)

  return {
    symbol: asString(obj.symbol, '·'),
    label: asString(obj.label, ''),
    explanation: asString(obj.explanation, ''),
    type: normalizeFeatureType(obj.type),
  }
}

function normalizeMorpheme(raw: unknown, fallbackText: string): MorphemeNode {
  const obj = asRecord(raw)

  return {
    text: asString(obj.text, fallbackText),
    type: normalizeMorphemeType(obj.type),
    meaning: asString(obj.meaning, ''),
    roleInWord: asString(obj.roleInWord, ''),
    etymology: asString(obj.etymology, ''),
    features: asArray(obj.features).map(normalizeFeature).filter(f => Boolean(f.symbol || f.explanation)),
  }
}

function normalizeCollocation(raw: unknown): CollocationExample {
  const obj = asRecord(raw)
  const text = asString(obj.text, asString(obj.stressedText))

  return {
    text: stripStressMarks(text),
    stressedText: asString(obj.stressedText, text),
    translation: asString(obj.translation),
  }
}

function normalizeMorphologyMeta(raw: unknown): RussianMorphologyMeta {
  const obj = asRecord(raw)

  return {
    caseCode: normalizeCaseCode(obj.caseCode),
    caseLabel: asString(obj.caseLabel, ''),
    caseQuestion: asString(obj.caseQuestion, ''),
    gender: asString(obj.gender, ''),
    number: asString(obj.number, ''),
    animacy: asString(obj.animacy, ''),
    aspect: asString(obj.aspect, ''),
    aspectPair: asString(obj.aspectPair, ''),
    tense: asString(obj.tense, ''),
    person: asString(obj.person, ''),
    mood: asString(obj.mood, ''),
  }
}

function ensureMorphemes(word: string, rawMorphemes: unknown[]): MorphemeNode[] {
  if (rawMorphemes.length > 0) {
    return rawMorphemes.map(item => normalizeMorpheme(item, word))
  }

  return [{
    text: word,
    type: 'root',
    meaning: word,
    roleInWord: '',
    features: [],
  }]
}

function normalizeToken(raw: unknown, idx: number): RussianLexemeToken {
  const obj = asRecord(raw)
  const rawWord = asString(obj.word, asString(obj.stressedWord, '?'))
  const word = stripStressMarks(rawWord)
  const stressedWord = asString(obj.stressedWord, rawWord)

  return {
    id: asString(obj.id, `t${idx + 1}`),
    word,
    stressedWord,
    lemma: asString(obj.lemma, word),
    ipa: asString(obj.ipa, ''),
    sentenceIndex: asOptionalSentenceIndex(obj.sentenceIndex),
    trailingPunctuation: asString(obj.trailingPunctuation, ''),
    pos: normalizePos(obj.pos),
    posLabel: asString(obj.posLabel, 'Word'),
    syntacticRole: asString(obj.syntacticRole, ''),
    meaning: asString(obj.meaning, ''),
    dictionaryMeaning: asString(obj.dictionaryMeaning, asString(obj.meaning, '')),
    cefr: asString(obj.cefr, 'A2'),
    grammarNote: asString(obj.grammarNote, ''),
    caseGovernmentNote: asString(obj.caseGovernmentNote, ''),
    morphology: normalizeMorphologyMeta(obj.morphology),
    collocations: asArray(obj.collocations).map(normalizeCollocation).filter(c => Boolean(c.text)),
    morphemes: ensureMorphemes(word, asArray(obj.morphemes)),
  }
}

function normalizeClause(raw: unknown, idx: number): SyntacticClause {
  const obj = asRecord(raw)

  return {
    id: asString(obj.id, `c${idx + 1}`),
    label: asString(obj.label, `Clause ${idx + 1}`),
    role: asString(obj.role, ''),
    text: asString(obj.text, ''),
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
    relationLabel: asString(obj.relationLabel, ''),
  }
}

function normalizePhoneticRule(raw: unknown): PhoneticRuleItem {
  const obj = asRecord(raw)

  return {
    title: asString(obj.title),
    written: asString(obj.written),
    spoken: asString(obj.spoken),
    explanation: asString(obj.explanation),
    sentenceIndex: asOptionalSentenceIndex(obj.sentenceIndex),
  }
}

function normalizeSyllable(raw: unknown): WordStressSyllable {
  const obj = asRecord(raw)

  return {
    text: asString(obj.text),
    stressed: Boolean(obj.stressed),
    reduced: Boolean(obj.reduced),
    phonetic: asString(obj.phonetic, ''),
  }
}

function normalizeWordPhoneticCard(raw: unknown): WordPhoneticCard {
  const obj = asRecord(raw)
  const rawWord = asString(obj.word, asString(obj.stressedWord))
  const word = stripStressMarks(rawWord)
  const stressedWord = asString(obj.stressedWord, rawWord)
  const rawSyllables = asArray(obj.syllables).map(normalizeSyllable).filter(s => Boolean(s.text))

  return {
    word,
    stressedWord,
    ipa: asString(obj.ipa, ''),
    isSentenceFocus: Boolean(obj.isSentenceFocus),
    reductionNote: asString(obj.reductionNote, ''),
    syllables: rawSyllables.length > 0
      ? rawSyllables
      : [{ text: stressedWord, stressed: true, reduced: false }],
  }
}

function buildFallbackWordCards(tokens: RussianLexemeToken[]): WordPhoneticCard[] {
  return tokens.map(token => ({
    word: token.word,
    stressedWord: token.stressedWord,
    ipa: token.ipa,
    isSentenceFocus: false,
    syllables: [{ text: token.stressedWord, stressed: true, reduced: false }],
  }))
}

function normalizePhonetics(raw: unknown, tokens: RussianLexemeToken[]): RussianPhoneticsAnalysis {
  const obj = asRecord(raw)
  const cards = asArray(obj.wordStressCards).map(normalizeWordPhoneticCard).filter(c => Boolean(c.word))

  return {
    intonationType: asString(obj.intonationType, 'ИК-1'),
    intonationExplanation: asString(obj.intonationExplanation, ''),
    rhythmGrouping: asString(obj.rhythmGrouping, tokens.map(t => t.stressedWord).join(' / ')),
    intonationNote: asString(obj.intonationNote, ''),
    phoneticRules: asArray(obj.phoneticRules).map(normalizePhoneticRule).filter(r => Boolean(r.title)),
    wordStressCards: cards.length > 0 ? cards : buildFallbackWordCards(tokens),
  }
}

function normalizeGrammarPattern(raw: unknown, idx: number): GrammarPatternItem {
  const obj = asRecord(raw)

  return {
    id: asString(obj.id, `g${idx + 1}`),
    name: asString(obj.name, `Pattern ${idx + 1}`),
    formula: asString(obj.formula, ''),
    level: asString(obj.level, 'B1'),
    explanation: asString(obj.explanation, ''),
    commonMistakes: asString(obj.commonMistakes, ''),
    examples: asArray(obj.examples).map(normalizeCollocation).filter(e => Boolean(e.text)),
    sentenceIndex: asOptionalSentenceIndex(obj.sentenceIndex),
  }
}

function normalizeUsageContext(raw: unknown): UsageContextInfo {
  const obj = asRecord(raw)
  const rawScore = Number(obj.formalityScore)
  const formalityScore = Number.isFinite(rawScore) ? Math.min(5, Math.max(1, Math.round(rawScore))) : 3

  return {
    whenToUse: asString(obj.whenToUse, ''),
    formalityScore,
    formalityLabel: asString(obj.formalityLabel, 'Neutral'),
    emotionalNuance: asString(obj.emotionalNuance, ''),
    culturalNote: asString(obj.culturalNote, ''),
    typicalContexts: asArray(obj.typicalContexts).map(c => asString(c)).filter(Boolean),
  }
}

function normalizeAlternative(raw: unknown): AlternativeVariant {
  const obj = asRecord(raw)
  const rawText = asString(obj.text, asString(obj.stressedText))

  return {
    text: stripStressMarks(rawText),
    stressedText: asString(obj.stressedText, rawText),
    ipa: asString(obj.ipa, ''),
    translation: asString(obj.translation, ''),
    register: asString(obj.register, ''),
    nuance: asString(obj.nuance, ''),
    sentenceIndex: asOptionalSentenceIndex(obj.sentenceIndex),
  }
}

function resolveInputLanguage(rawLang: unknown, originalInput: string): InputLanguageCode {
  if (rawLang === 'ru' || rawLang === 'zh' || rawLang === 'en') {
    return rawLang
  }

  const detected = detectRussianAnalyzerInputLanguage(originalInput)

  return detected === 'auto' ? 'ru' : detected
}

function normalizeSentenceOverview(raw: unknown, originalInput: string, tokens: RussianLexemeToken[]): RussianSentenceOverview {
  const obj = asRecord(raw)
  const fallbackStressed = tokens.map(t => t.stressedWord).join(' ')
  const fallbackPlain = tokens.map(t => t.word).join(' ')
  const stressedText = asString(obj.stressedText, asString(obj.plainText, fallbackStressed || originalInput))
  const plainText = stripStressMarks(asString(obj.plainText, stressedText || fallbackPlain))

  return {
    inputLanguage: resolveInputLanguage(obj.inputLanguage, originalInput),
    originalInput,
    plainText,
    stressedText,
    ipa: asString(obj.ipa, ''),
    translation: asString(obj.translation, ''),
    literalTranslation: asString(obj.literalTranslation, ''),
    cefrLevel: asString(obj.cefrLevel, 'B1'),
    register: asString(obj.register, 'Neutral'),
    sentenceType: asString(obj.sentenceType, ''),
    structuralFormula: asString(obj.structuralFormula, ''),
  }
}

export function normalizeRussianAnalysisResponse(raw: unknown, originalInput: string): RussianSentenceAnalysis {
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
    alternatives: asArray(root.alternatives).map(normalizeAlternative).filter(a => Boolean(a.text)),
  }
}
