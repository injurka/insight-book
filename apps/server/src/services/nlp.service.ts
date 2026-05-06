import type { TokenizedSentence, TokenizedWord } from '../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import nlp from 'compromise'
import { eq } from 'drizzle-orm'
import kuromoji from 'kuromoji'
import nodejieba from 'nodejieba'
import { db } from '../db'
import * as schema from '../db/schema'

const SENTENCE_DELIMITERS = /([.。！？…!?]+)/g

function splitIntoSentences(text: string): string[] {
  const paragraphs = text.split(/(\n+)/)

  const sentences: string[] = []

  for (const para of paragraphs) {
    if (!para)
      continue

    if (/^\s+$/.test(para)) {
      sentences.push(para)
      continue
    }

    const parts = para.split(SENTENCE_DELIMITERS)
    let currentSentence = ''

    for (let i = 0; i < parts.length; i++) {
      currentSentence += parts[i]

      if (i % 2 !== 0 || i === parts.length - 1) {
        if (currentSentence) {
          sentences.push(currentSentence)
          currentSentence = ''
        }
      }
    }
  }

  return sentences
}

interface LanguageTokenizer {
  tokenize: (text: string) => Promise<TokenizedWord[]> | TokenizedWord[]
}

class ChineseTokenizer implements LanguageTokenizer {
  tokenize(text: string): TokenizedWord[] {
    const tokens: TokenizedWord[] = []
    const parts = text.split(/(\s+)/)
    for (const part of parts) {
      if (!part)
        continue
      if (/^\s+$/.test(part)) {
        tokens.push({ word: part, pos: 'x' })
      }
      else {
        const tagged = nodejieba.tag(part) as Array<{ word: string, tag: string }>
        tokens.push(...tagged.map(t => ({ word: t.word, pos: t.tag })))
      }
    }
    return tokens
  }
}

class JapaneseTokenizer implements LanguageTokenizer {
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null
  private initPromise: Promise<void> | null = null

  private tagMap: Record<string, string> = {
    名詞: 'n',
    動詞: 'v',
    形容詞: 'a',
    副詞: 'd',
    助詞: 'u',
    助動詞: 'u',
    接続詞: 'c',
    感動詞: 'x',
    連体詞: 'a',
    記号: 'x',
    接頭詞: 'x',
    接尾詞: 'x',
    フィラー: 'x',
  }

  private getSimpleTag(fullTag: string): string {
    const mainTag = fullTag.split('-')[0]
    return this.tagMap[mainTag] || 'x'
  }

  public init(): Promise<void> {
    if (this.tokenizer)
      return Promise.resolve()

    if (this.initPromise)
      return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const require = createRequire(import.meta.url)
      const kuromojiDir = path.dirname(require.resolve('kuromoji/package.json'))
      const dicPath = path.join(kuromojiDir, 'dict')

      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          this.initPromise = null
          return reject(err)
        }
        this.tokenizer = tokenizer
        resolve()
      })
    })

    return this.initPromise
  }

  async tokenize(text: string): Promise<TokenizedWord[]> {
    await this.init()
    if (!this.tokenizer)
      return [{ word: text, pos: 'unk' }]

    const tokens: TokenizedWord[] = []
    const parts = text.split(/(\s+)/)
    for (const part of parts) {
      if (!part)
        continue
      if (/^\s+$/.test(part)) {
        tokens.push({ word: part, pos: 'x' })
      }
      else {
        const kuromojiTokens = this.tokenizer.tokenize(part)
        tokens.push(...kuromojiTokens.map(t => ({ word: t.surface_form, pos: this.getSimpleTag(t.pos) })))
      }
    }
    return tokens
  }
}

class EnglishTokenizer implements LanguageTokenizer {
  private tagMap: Record<string, string> = {
    Noun: 'n',
    Verb: 'v',
    Adjective: 'a',
    Adverb: 'd',
    Preposition: 'p',
    Conjunction: 'c',
    Determiner: 'u',
    Value: 'm',
    QuestionWord: 'r',
    Pronoun: 'r',
  }

  private getSimpleTag(tags: string[]): string {
    if (!tags || tags.length === 0)
      return 'x'
    for (const tag of tags) {
      if (this.tagMap[tag])
        return this.tagMap[tag]
    }
    return 'x'
  }

  tokenize(text: string): TokenizedWord[] {
    const doc = nlp(text)
    const jsonOutput = doc.json()
    const tokens: TokenizedWord[] = []

    for (const sentence of jsonOutput) {
      for (const term of sentence.terms) {
        if (term.pre)
          tokens.push({ word: term.pre, pos: 'x' })

        if (term.text) {
          const tag = this.getSimpleTag(term.tags)
          tokens.push({ word: term.text, pos: tag })
        }

        if (term.post)
          tokens.push({ word: term.post, pos: 'x' })
      }
    }

    if (tokens.length === 0) {
      tokens.push({ word: text, pos: 'x' })
    }

    return tokens
  }
}

class DefaultTokenizer implements LanguageTokenizer {
  private segmenter: Intl.Segmenter
  constructor(language: string) {
    this.segmenter = new Intl.Segmenter(language, { granularity: 'word' })
  }

  tokenize(text: string): TokenizedWord[] {
    const tokens: TokenizedWord[] = []
    for (const { segment, isWordLike } of this.segmenter.segment(text)) {
      tokens.push({ word: segment, pos: isWordLike ? 'word' : 'x' })
    }
    return tokens
  }
}

const zhTokenizer = new ChineseTokenizer()
const jaTokenizer = new JapaneseTokenizer()
const enTokenizer = new EnglishTokenizer()

export async function initNLP() {
  console.log('🤖 Initializing NLP tokenizers...')
  await jaTokenizer.init()
  console.log('✅ NLP tokenizers ready')
}

function getTokenizer(language: string): LanguageTokenizer {
  switch (language.toLowerCase()) {
    case 'zh': return zhTokenizer
    case 'ja': return jaTokenizer
    case 'en': return enTokenizer
    default: return new DefaultTokenizer(language)
  }
}

export async function tokenizePage(text: string, language: string): Promise<TokenizedSentence[]> {
  const tokenizer = getTokenizer(language)
  const sentences = splitIntoSentences(text)
  const tokenizedSentences: TokenizedSentence[] = []

  for (let i = 0; i < sentences.length; i++) {
    const raw = sentences[i]

    if (/^\s+$/.test(raw)) {
      tokenizedSentences.push({ sentenceId: i, tokens: [{ word: raw, pos: 'x' }], raw })
      continue
    }

    const tokens = await tokenizer.tokenize(raw)
    tokenizedSentences.push({ sentenceId: i, tokens, raw })
  }
  return tokenizedSentences
}

export async function analyzeBookVocabulary(bookId: number, language: string) {
  const pages = await db.select({ content: schema.bookPages.content })
    .from(schema.bookPages)
    .where(eq(schema.bookPages.bookId, bookId))

  const tokenizer = getTokenizer(language)
  const posCounts: Record<string, number> = {}
  const wordFreq: Record<string, { count: number, pos: string }> = {}
  let totalValidTokens = 0

  for (const page of pages) {
    const sentences = splitIntoSentences(page.content)
    for (const raw of sentences) {
      if (/^\s+$/.test(raw))
        continue

      const tokens = await tokenizer.tokenize(raw)
      for (const t of tokens) {
        // Игнорируем пунктуацию, предлоги, союзы, числа, местоимения
        if (['x', 'u', 'p', 'c', 'm', 'r'].includes(t.pos))
          continue

        // Для иероглифических языков игнорируем токены короче 1 символа (мусор)
        // Для английского - короче 2 символов
        if (t.word.length < (language === 'en' ? 2 : 1))
          continue

        totalValidTokens++
        posCounts[t.pos] = (posCounts[t.pos] || 0) + 1

        const w = t.word.toLowerCase()
        if (!wordFreq[w])
          wordFreq[w] = { count: 0, pos: t.pos }
        wordFreq[w].count++
      }
    }
  }

  const uniqueTokens = Object.keys(wordFreq).length
  const lexicalDiversity = totalValidTokens > 0 ? Math.round((uniqueTokens / totalValidTokens) * 100) : 0

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .map(([word, data]) => ({ word, ...data }))

  return { posDistribution: posCounts, topWords, lexicalDiversity }
}
