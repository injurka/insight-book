import type { TokenizedSentence, TokenizedWord } from '../types'
import path from 'node:path'
import kuromoji from 'kuromoji'
import nodejieba from 'nodejieba'

const SENTENCE_DELIMITERS = /([。！？…!?]+)/g

function splitIntoSentences(text: string): string[] {
  const parts = text.split(SENTENCE_DELIMITERS).filter(s => s.trim())
  const sentences: string[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const sent = (parts[i] || '') + (parts[i + 1] || '')
    if (sent.trim())
      sentences.push(sent.trim())
  }
  return sentences.length ? sentences : [text]
}

interface LanguageTokenizer {
  tokenize: (text: string) => Promise<TokenizedWord[]> | TokenizedWord[]
}

class ChineseTokenizer implements LanguageTokenizer {
  tokenize(text: string): TokenizedWord[] {
    const tagged = nodejieba.tag(text) as Array<{ word: string, tag: string }>
    return tagged.map(t => ({ word: t.word, pos: t.tag }))
  }
}

class JapaneseTokenizer implements LanguageTokenizer {
  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null

  private initTokenizer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.tokenizer)
        return resolve()

      const dicPath = path.resolve(process.cwd(), 'node_modules', 'kuromoji', 'dict')
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

    const tokens = this.tokenizer.tokenize(text)
    return tokens.map(t => ({ word: t.surface_form, pos: t.pos }))
  }
}

class DefaultTokenizer implements LanguageTokenizer {
  private segmenter: Intl.Segmenter

  constructor(language: string) {
    // Fallback на Intl.Segmenter (поддерживает большинство языков, включая англ)
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

// Синглтоны токенизаторов
const zhTokenizer = new ChineseTokenizer()
const jaTokenizer = new JapaneseTokenizer()

function getTokenizer(language: string): LanguageTokenizer {
  switch (language.toLowerCase()) {
    case 'zh': return zhTokenizer
    case 'ja': return jaTokenizer
    default: return new DefaultTokenizer(language)
  }
}

export async function tokenizePage(text: string, language: string): Promise<TokenizedSentence[]> {
  const tokenizer = getTokenizer(language)
  const sentences = splitIntoSentences(text)

  const tokenizedSentences: TokenizedSentence[] = []

  for (let i = 0; i < sentences.length; i++) {
    const raw = sentences[i]
    const tokens = await tokenizer.tokenize(raw)
    tokenizedSentences.push({ sentenceId: i, tokens, raw })
  }

  return tokenizedSentences
}
