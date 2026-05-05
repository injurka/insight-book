import type { TokenizedSentence, TokenizedWord } from '../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import nlp from 'compromise'
import kuromoji from 'kuromoji'
import nodejieba from 'nodejieba'

const SENTENCE_DELIMITERS = /([.。！？…!?]+)/g

function splitIntoSentences(text: string): string[] {
  // БОЛЬШЕ НЕ ВЫРЕЗАЕМ ПРОБЕЛЫ И НЕ ИСПОЛЬЗУЕМ trim()
  // Сначала разбиваем на абзацы с сохранением самих символов переноса
  const paragraphs = text.split(/(\n+)/)

  const sentences: string[] = []

  for (const para of paragraphs) {
    if (!para)
      continue

    // Если это чистый блок из пробелов/переносов строк — сохраняем как есть
    if (/^\s+$/.test(para)) {
      sentences.push(para)
      continue
    }

    const parts = para.split(SENTENCE_DELIMITERS)
    let currentSentence = ''

    for (let i = 0; i < parts.length; i++) {
      currentSentence += parts[i]

      // Если это разделитель (нечетный индекс) или последний кусок массива
      if (i % 2 !== 0 || i === parts.length - 1) {
        if (currentSentence) {
          sentences.push(currentSentence) // Без .trim() !
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
    // Разбиваем по пробелам/переносам, чтобы jieba их не "проглотила"
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

  async tokenize(text: string): Promise<TokenizedWord[]> {
    await this.initTokenizer()
    if (!this.tokenizer)
      return [{ word: text, pos: 'unk' }]

    const tokens: TokenizedWord[] = []
    // Разбиваем по пробельным символам для гарантии их сохранения
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
        // Сохраняем пробелы и пунктуацию до слова как отдельный токен (без trim)
        if (term.pre)
          tokens.push({ word: term.pre, pos: 'x' })

        // Само слово
        if (term.text) {
          const tag = this.getSimpleTag(term.tags)
          tokens.push({ word: term.text, pos: tag })
        }

        // Сохраняем пробелы и пунктуацию после слова
        if (term.post)
          tokens.push({ word: term.post, pos: 'x' })
      }
    }

    // Fallback на случай, если библиотека ничего не распарсила (например, там были одни пробелы)
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

    // Если это чистый перенос строки или отступы - нет смысла отдавать парсерам
    if (/^\s+$/.test(raw)) {
      tokenizedSentences.push({ sentenceId: i, tokens: [{ word: raw, pos: 'x' }], raw })
      continue
    }

    const tokens = await tokenizer.tokenize(raw)
    tokenizedSentences.push({ sentenceId: i, tokens, raw })
  }
  return tokenizedSentences
}
