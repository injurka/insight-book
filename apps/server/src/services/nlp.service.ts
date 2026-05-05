import type { TokenizedSentence, TokenizedWord } from '../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import nlp from 'compromise'
import kuromoji from 'kuromoji'
import nodejieba from 'nodejieba'

function splitIntoSentences(text: string, language: string): string[] {
  try {
    const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
    const sentences: string[] = []
    for (const { segment } of segmenter.segment(text)) {
      if (segment.trim()) {
        sentences.push(segment.trim())
      }
    }
    return sentences.length ? sentences : [text]
  }
  catch {
    const SENTENCE_DELIMITERS = /([。！？…!?.]+)/g
    const parts = text.split(SENTENCE_DELIMITERS).filter(s => s.trim())
    const sentences: string[] = []
    for (let i = 0; i < parts.length; i += 2) {
      const sent = (parts[i] || '') + (parts[i + 1] || '')
      if (sent.trim())
        sentences.push(sent.trim())
    }
    return sentences.length ? sentences : [text]
  }
}

interface LanguageTokenizer {
  tokenizePage: (text: string, language: string) => Promise<TokenizedSentence[]> | TokenizedSentence[]
}

class ChineseTokenizer implements LanguageTokenizer {
  tokenizePage(text: string, language: string): TokenizedSentence[] {
    const sentences = splitIntoSentences(text, language)
    return sentences.map((raw, i) => {
      const tagged = nodejieba.tag(raw) as Array<{ word: string, tag: string }>
      const tokens = tagged.map(t => ({ word: t.word, pos: t.tag }))
      return { sentenceId: i, tokens, raw }
    })
  }
}

class JapaneseTokenizer implements LanguageTokenizer {
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null

  private tagMap: Record<string, string> = {
    名詞: 'n',
    動詞: 'v',
    形容詞: 'a',
    副詞: 'd',
    助詞: 'u', // Частица -> Служебное слово
    助動詞: 'u', // Вспом. глагол -> Служебное слово
    接続詞: 'c',
    感動詞: 'x', // Междометие -> Прочее
    連体詞: 'a', // Определительное слово -> Прилагательное
    記号: 'x',
    接頭詞: 'x', // Префикс -> Прочее
    接尾詞: 'x', // Суффикс -> Прочее
    フィラー: 'x', // Заполнитель -> Прочее
  }

  private getSimpleTag(fullTag: string): string {
    const mainTag = fullTag.split('-')[0]
    return this.tagMap[mainTag] || 'x'
  }

  private initTokenizer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.tokenizer)
        return resolve()

      const require = createRequire(import.meta.url)
      const kuromojiDir = path.dirname(require.resolve('kuromoji/package.json'))
      const dicPath = path.join(kuromojiDir, 'dict')

      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err)
          return reject(err)
        this.tokenizer = tokenizer
        resolve()
      })
    })
  }

  async tokenizePage(text: string, language: string): Promise<TokenizedSentence[]> {
    await this.initTokenizer()
    const sentences = splitIntoSentences(text, language)

    return sentences.map((raw, i) => {
      if (!this.tokenizer)
        return { sentenceId: i, tokens: [{ word: raw, pos: 'unk' }], raw }

      const tokens = this.tokenizer.tokenize(raw).map(t => ({
        word: t.surface_form,
        pos: this.getSimpleTag(t.pos),
      }))

      return { sentenceId: i, tokens, raw }
    })
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

  tokenizePage(text: string): TokenizedSentence[] {
    const doc = nlp(text)
    const jsonOutput = doc.json()

    const result: TokenizedSentence[] = []

    for (let i = 0; i < jsonOutput.length; i++) {
      const sentence = jsonOutput[i]
      const tokens: TokenizedWord[] = []

      for (const term of sentence.terms) {
        if (term.pre) {
          for (const char of term.pre) {
            if (char.trim().length > 0)
              tokens.push({ word: char, pos: 'x' })
          }
        }

        if (term.text) {
          const tag = this.getSimpleTag(term.tags)
          tokens.push({ word: term.text, pos: tag })
        }

        if (term.post) {
          for (const char of term.post) {
            if (char.trim().length > 0)
              tokens.push({ word: char, pos: 'x' })
          }
        }
      }

      result.push({
        sentenceId: i,
        tokens,
        raw: (sentence.text || '').trim(),
      })
    }
    return result
  }
}

class DefaultTokenizer implements LanguageTokenizer {
  tokenizePage(text: string, language: string): TokenizedSentence[] {
    const sentences = splitIntoSentences(text, language)

    let wordSegmenter: Intl.Segmenter
    try {
      wordSegmenter = new Intl.Segmenter(language, { granularity: 'word' })
    }
    catch {
      wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' })
    }

    return sentences.map((raw, i) => {
      const tokens: TokenizedWord[] = []
      for (const { segment, isWordLike } of wordSegmenter.segment(raw)) {
        if (segment.trim().length > 0) {
          tokens.push({ word: segment, pos: isWordLike ? 'word' : 'x' })
        }
      }
      return { sentenceId: i, tokens, raw }
    })
  }
}

const zhTokenizer = new ChineseTokenizer()
const jaTokenizer = new JapaneseTokenizer()
const enTokenizer = new EnglishTokenizer()
const defaultTokenizer = new DefaultTokenizer()

function getTokenizer(language: string): LanguageTokenizer {
  switch (language.toLowerCase()) {
    case 'zh': return zhTokenizer
    case 'ja': return jaTokenizer
    case 'en': return enTokenizer
    default: return defaultTokenizer
  }
}

export async function tokenizePage(text: string, language: string): Promise<TokenizedSentence[]> {
  const tokenizer = getTokenizer(language)
  return await tokenizer.tokenizePage(text, language)
}
