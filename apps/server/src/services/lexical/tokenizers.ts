import type { LanguageTokenizer, TokenizedWord } from '../../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import { normalizeLanguageCode } from '@injurka/insight-book-language-utils'
import nlp from 'compromise'
import kuromoji from 'kuromoji'
import nodejieba from 'nodejieba'
import { logger } from '../../utils/logger'

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
        tokens.push(...tagged.map(t => ({ word: t.word, pos: t.tag === 'eng' ? 'word' : t.tag })))
      }
    }
    return tokens
  }
}

class JapaneseTokenizer implements LanguageTokenizer {
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null
  private initPromise: Promise<void> | null = null
  private tagMap: Record<string, string> = { 名詞: 'n', 動詞: 'v', 形容詞: 'a', 副詞: 'd', 助詞: 'u', 助動詞: 'u', 接続詞: 'c', 感動詞: 'x', 連体詞: 'a', 記号: 'x', 接頭詞: 'x', 接尾詞: 'x', フィラー: 'x' }

  private getSimpleTag(fullTag: string): string {
    return this.tagMap[fullTag.split('-')[0]] || 'x'
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
        tokens.push(...kuromojiTokens.map(t => ({ word: t.surface_form, pos: t.pos_detail_1 === '代名詞' ? 'r' : this.getSimpleTag(t.pos), lemma: t.basic_form === '*' ? t.surface_form : t.basic_form, entity: t.pos_detail_1 === '固有名詞' })))
      }
    }
    return tokens
  }
}

class EnglishTokenizer implements LanguageTokenizer {
  private tagMap: Record<string, string> = { Noun: 'n', Verb: 'v', Adjective: 'a', Adverb: 'd', Preposition: 'p', Conjunction: 'c', Determiner: 'u', Value: 'm', QuestionWord: 'r', Pronoun: 'r' }

  private getSimpleTag(tags: string[]): string {
    if (!tags || tags.length === 0)
      return 'x'
    if (tags.includes('Pronoun') || tags.includes('Possessive'))
      return 'r'
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
        if (term.text)
          tokens.push({ word: term.text, pos: this.getSimpleTag(term.tags) })
        if (term.post)
          tokens.push({ word: term.post, pos: 'x' })
      }
    }
    if (tokens.length === 0)
      tokens.push({ word: text, pos: 'x' })
    return tokens
  }
}

interface AzModule {
  Morph: {
    (word: string): { tag: { POS: string, Name?: boolean, Surn?: boolean, Patr?: boolean, Geox?: boolean, Orgn?: boolean }, normalize: () => { toString: () => string } }[]
    init: (cb: () => void) => void
  }
}

class RussianTokenizer implements LanguageTokenizer {
  private initPromise: Promise<void> | null = null
  private isReady = false
  private segmenter = new Intl.Segmenter('ru', { granularity: 'word' })
  private Az!: AzModule

  public init(): Promise<void> {
    if (this.isReady)
      return Promise.resolve()
    if (this.initPromise)
      return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      // @ts-expect-error no dts
      import('az').then((azModule) => {
        this.Az = azModule.default || azModule
        this.Az.Morph.init(() => {
          this.isReady = true
          resolve()
        })
      }).catch((err) => {
        this.initPromise = null
        logger.error(err, '[NLP] Az.js load failed:')
        reject(err)
      })
    })
    return this.initPromise
  }

  private mapPos(tag: string): string {
    if (!tag)
      return 'unk'
    if (['NOUN'].includes(tag))
      return 'n'
    if (['VERB', 'INFN', 'PRTF', 'PRTS', 'GRND'].includes(tag))
      return 'v'
    if (['ADJF', 'ADJS', 'COMP'].includes(tag))
      return 'a'
    if (['ADVB'].includes(tag))
      return 'd'
    if (['NPRO'].includes(tag))
      return 'r' // местоимение
    if (['PREP'].includes(tag))
      return 'p' // предлог
    if (['CONJ'].includes(tag))
      return 'c' // союз
    if (['PRCL', 'INTJ'].includes(tag))
      return 'x' // частица, междометие
    return 'unk'
  }

  async tokenize(text: string): Promise<TokenizedWord[]> {
    // Если по какой-то причине az не загрузился, падаем на обычный сегментер
    try {
      await this.init()
    }
    catch {
      const tokens: TokenizedWord[] = []
      for (const { segment, isWordLike } of this.segmenter.segment(text)) {
        tokens.push({ word: segment, pos: isWordLike ? 'unk' : 'x' })
      }
      return tokens
    }

    const tokens: TokenizedWord[] = []

    for (const { segment, isWordLike } of this.segmenter.segment(text)) {
      if (!isWordLike) {
        tokens.push({ word: segment, pos: 'x' })
        continue
      }

      const parses = this.Az.Morph(segment)
      const pos = parses.length > 0 ? this.mapPos(parses[0].tag.POS) : 'unk'
      const parse = parses[0]
      tokens.push({ word: segment, pos, lemma: parse?.normalize().toString(), entity: !!parse && (parse.tag.Name || parse.tag.Surn || parse.tag.Patr || parse.tag.Geox || parse.tag.Orgn) })
    }

    return tokens
  }
}

class DefaultTokenizer implements LanguageTokenizer {
  private segmenter: Intl.Segmenter
  constructor(language: string) {
    try {
      this.segmenter = new Intl.Segmenter(language || undefined, { granularity: 'word' })
    }
    catch {
      this.segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    }
  }

  tokenize(text: string): TokenizedWord[] {
    const tokens: TokenizedWord[] = []
    for (const { segment, isWordLike } of this.segmenter.segment(text)) tokens.push({ word: segment, pos: isWordLike ? 'word' : 'x' })
    return tokens
  }
}

const zhTokenizer = new ChineseTokenizer()
const jaTokenizer = new JapaneseTokenizer()
const enTokenizer = new EnglishTokenizer()
const ruTokenizer = new RussianTokenizer()

export async function initNLP() {
  logger.info('🤖 Initializing NLP tokenizers...')
  await Promise.all([
    jaTokenizer.init(),
    ruTokenizer.init().catch(() => { }),
  ])

  logger.info('✅ NLP tokenizers ready')
}

export function getTokenizer(language: string): LanguageTokenizer {
  language = normalizeLanguageCode(language)
  switch (language) {
    case 'zh': return zhTokenizer
    case 'ja': return jaTokenizer
    case 'en': return enTokenizer
    case 'ru': return ruTokenizer
    default: return new DefaultTokenizer(language)
  }
}

// Reader and OCR must retain every character, even if a dictionary tokenizer drops it.
export async function tokenizeText(text: string, language: string): Promise<TokenizedWord[]> {
  const tokens = await getTokenizer(language).tokenize(text)
  const preserved = tokens.map(token => token.word).join('') === text
  const result = preserved ? tokens : new DefaultTokenizer(normalizeLanguageCode(language)).tokenize(text)
  return result.filter(token => token.word.length > 0).map(token => ({
    ...token,
    pos: token.pos === 'x' && /[\p{L}\p{N}]/u.test(token.word) ? 'unk' : token.pos,
  }))
}
