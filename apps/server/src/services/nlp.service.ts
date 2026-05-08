import type { TokenizedWord } from '../types'
import { createRequire } from 'node:module'
import path from 'node:path'
import * as cheerio from 'cheerio'
import nlp from 'compromise'
import { eq } from 'drizzle-orm'
import kuromoji from 'kuromoji'
import { parse as parseHtml } from 'node-html-parser'
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

interface LanguageTokenizer { tokenize: (text: string) => Promise<TokenizedWord[]> | TokenizedWord[] }

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
        tokens.push(...kuromojiTokens.map(t => ({ word: t.surface_form, pos: this.getSimpleTag(t.pos) })))
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

class DefaultTokenizer implements LanguageTokenizer {
  private segmenter: Intl.Segmenter
  constructor(language: string) { this.segmenter = new Intl.Segmenter(language, { granularity: 'word' }) }

  tokenize(text: string): TokenizedWord[] {
    const tokens: TokenizedWord[] = []
    for (const { segment, isWordLike } of this.segmenter.segment(text)) tokens.push({ word: segment, pos: isWordLike ? 'word' : 'x' })
    return tokens
  }
}

const zhTokenizer = new ChineseTokenizer()
const jaTokenizer = new JapaneseTokenizer()
const enTokenizer = new EnglishTokenizer()

export async function initNLP() {
  // eslint-disable-next-line no-console
  console.log('🤖 Initializing NLP tokenizers...')
  await jaTokenizer.init()
  // eslint-disable-next-line no-console
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

export async function tokenizeHtmlPage(html: string, language: string) {
  const tokenizer = getTokenizer(language)
  const $ = cheerio.load(html, null, false)
  const allWords = new Set<string>()
  let sentenceIdCounter = 0

  const textNodes: any[] = []
  function findTextNodes(el: any) {
    if (el.type === 'text')
      textNodes.push(el)
    else if (el.type === 'tag' && el.children)
      el.children.forEach((child: any) => findTextNodes(child))
  }

  $.root().contents().each((_, el) => findTextNodes(el))

  for (const node of textNodes) {
    const text = node.data
    if (!text || /^\s+$/.test(text))
      continue

    const sentences = splitIntoSentences(text)
    let newHtml = ''

    for (const raw of sentences) {
      if (/^\s+$/.test(raw) || !raw) {
        newHtml += raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        continue
      }

      const tokens = await tokenizer.tokenize(raw)
      const encodedRaw = encodeURIComponent(raw)
      let sentHtml = `<span class="sentence" data-sent-id="${sentenceIdCounter}" data-raw-sent="${encodedRaw}">`

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (/[\p{L}\p{N}]/u.test(t.word)) {
          allWords.add(t.word)
          allWords.add(t.word.toLowerCase())
        }

        const isPunct = t.pos === 'x'
        const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
        const encodedWord = encodeURIComponent(t.word)
        const safeWord = t.word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        sentHtml += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodedWord}" data-pos="${t.pos}" data-sent-id="${sentenceIdCounter}" data-token-idx="${i}">${safeWord}</span>`
      }
      sentHtml += '</span>'
      sentenceIdCounter++
      newHtml += sentHtml
    }

    $(node).replaceWith(newHtml)
  }

  return {
    processedHtml: $.html(),
    uniqueWords: Array.from(allWords),
  }
}

export async function analyzeBookVocabulary(bookId: number, language: string) {
  const pages = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, bookId))
  const tokenizer = getTokenizer(language)
  const posCounts: Record<string, number> = {}

  // Сохраняем оригинальное написание
  const wordFreq: Record<string, { count: number, pos: string, original: string }> = {}
  let totalValidTokens = 0

  for (const page of pages) {
    const plainText = parseHtml(page.content).textContent
    const sentences = splitIntoSentences(plainText)

    for (const raw of sentences) {
      if (/^\s+$/.test(raw))
        continue
      const tokens = await tokenizer.tokenize(raw)

      for (const t of tokens) {
        if (['x', 'u', 'p', 'c', 'm', 'r'].includes(t.pos))
          continue
        if (t.word.length < (language === 'en' ? 2 : 1))
          continue

        totalValidTokens++
        posCounts[t.pos] = (posCounts[t.pos] || 0) + 1

        const w = t.word.toLowerCase()
        if (!wordFreq[w]) {
          wordFreq[w] = { count: 0, pos: t.pos, original: t.word }
        }
        wordFreq[w].count++

        if (t.word !== w && wordFreq[w].original === w) {
          wordFreq[w].original = t.word
        }
      }
    }
  }

  const uniqueTokens = Object.keys(wordFreq).length
  const lexicalDiversity = totalValidTokens > 0 ? Math.round((uniqueTokens / totalValidTokens) * 100) : 0

  const allWordsArr = Object.values(wordFreq).map(data => ({ word: data.original, pos: data.pos, count: data.count }))

  const properNouns = allWordsArr
    .filter(w => ['nr', 'ns', 'nt'].includes(w.pos) || (w.pos.startsWith('n') && /^[A-ZА-ЯЁ]/.test(w.word)))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const isProper = (word: string) => properNouns.some(p => p.word === word)

  const nouns = allWordsArr
    .filter(w => w.pos.startsWith('n') && !isProper(w.word))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const verbs = allWordsArr
    .filter(w => w.pos.startsWith('v'))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const adjs = allWordsArr
    .filter(w => (w.pos.startsWith('a') || w.pos.startsWith('d')) && !isProper(w.word))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const minLength = language === 'en' ? 6 : 2
  const rareWords = allWordsArr
    // Фильтруем слова, которые попались от 2 до 5 раз
    .filter(w => w.count >= 2 && w.count <= 5 && w.word.length >= minLength && !isProper(w.word))
    .sort((a, b) => b.word.length - a.word.length) // Сортируем по длине убывания
    .slice(0, 30)

  return {
    posDistribution: posCounts,
    topWords: { nouns, verbs, adjs, properNouns, rareWords },
    lexicalDiversity,
  }
}

export async function tokenizeOcrBlocks(blocks: any[], language: string) {
  const tokenizer = getTokenizer(language)
  const allWords = new Set<string>()
  let sentenceIdCounter = 10000

  const processedBlocks = []

  for (const block of blocks) {
    const text = block.text
    if (!text || /^\s+$/.test(text)) {
      processedBlocks.push({ ...block, html: text })
      continue
    }

    const sentences = splitIntoSentences(text)
    let newHtml = ''

    for (const raw of sentences) {
      if (/^\s+$/.test(raw) || !raw) {
        newHtml += raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        continue
      }

      const tokens = await tokenizer.tokenize(raw)
      const encodedRaw = encodeURIComponent(raw)
      let sentHtml = `<span class="sentence" data-sent-id="${sentenceIdCounter}" data-raw-sent="${encodedRaw}">`

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (/[\p{L}\p{N}]/u.test(t.word)) {
          allWords.add(t.word)
          allWords.add(t.word.toLowerCase())
        }

        const isPunct = t.pos === 'x'
        const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
        const encodedWord = encodeURIComponent(t.word)
        const safeWord = t.word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        sentHtml += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodedWord}" data-pos="${t.pos}" data-sent-id="${sentenceIdCounter}" data-token-idx="${i}">${safeWord}</span>`
      }
      sentHtml += '</span>'
      sentenceIdCounter++
      newHtml += sentHtml
    }

    processedBlocks.push({ ...block, html: newHtml })
  }

  return {
    processedBlocks,
    uniqueWords: Array.from(allWords),
  }
}
