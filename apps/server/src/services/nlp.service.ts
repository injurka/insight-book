import type { LanguageTokenizer, TokenizedWord } from '../types'
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

// Умное разбиение на предложения через встроенный Intl.Segmenter
function splitIntoSentences(text: string, language: string): string[] {
  try {
    const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
    const sentences: string[] = []
    for (const { segment } of segmenter.segment(text)) {
      sentences.push(segment)
    }
    return sentences
  }
  catch {
    return text.split(/([.。！？…!?]+|\n{2,})/g).filter(Boolean)
  }
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

class RussianTokenizer implements LanguageTokenizer {
  private initPromise: Promise<void> | null = null
  private isReady = false
  private segmenter = new Intl.Segmenter('ru', { granularity: 'word' })
  private Az: any

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
        console.error('[NLP] Az.js load failed:', err)
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
      tokens.push({ word: segment, pos })
    }

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
const ruTokenizer = new RussianTokenizer()

export async function initNLP() {
  // eslint-disable-next-line no-console
  console.log('🤖 Initializing NLP tokenizers...')
  await Promise.all([
    jaTokenizer.init(),
    ruTokenizer.init().catch(() => { }),
  ])
  // eslint-disable-next-line no-console
  console.log('✅ NLP tokenizers ready')
}

function getTokenizer(language: string): LanguageTokenizer {
  switch (language.toLowerCase()) {
    case 'zh': return zhTokenizer
    case 'ja': return jaTokenizer
    case 'en': return enTokenizer
    case 'ru': return ruTokenizer
    default: return new DefaultTokenizer(language)
  }
}

export async function tokenizeHtmlPage(html: string, language: string) {
  const tokenizer = getTokenizer(language)
  const $ = cheerio.load(html, null, false)
  const allWords = new Set<string>()
  let sentenceIdCounter = 0

  const blocks: { textNodes: any[], fullText: string }[] = []
  let currentBlock = { textNodes: [] as any[], fullText: '' }

  function traverse(el: any) {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    const isBlock = el.type === 'tag' && /^(p|div|h[1-6]|li|blockquote|td|th|br|hr|tr|ul|ol|table|article|section|main|aside|nav|header|footer|pre|figure|figcaption)$/i.test(el.name)

    if (isBlock && currentBlock.textNodes.length > 0) {
      blocks.push(currentBlock)
      currentBlock = { textNodes: [], fullText: '' }
    }

    if (el.type === 'text') {
      const text = el.data
      if (text) {
        currentBlock.textNodes.push(el)
        currentBlock.fullText += text
      }
    }
    else if (el.type === 'tag' && el.children) {
      el.children.forEach(traverse)
    }

    if (isBlock && currentBlock.textNodes.length > 0) {
      blocks.push(currentBlock)
      currentBlock = { textNodes: [], fullText: '' }
    }
  }

  $.root().contents().each((_, el) => traverse(el))
  if (currentBlock.textNodes.length > 0)
    blocks.push(currentBlock)

  for (const block of blocks) {
    const sentences = splitIntoSentences(block.fullText, language)
    const blockTokens: { text: string, pos: string, sentId: number, tokenIdx: number, encodedRaw: string, isValidSent: boolean }[] = []

    for (const sent of sentences) {
      if (!/[\p{L}\p{N}]/u.test(sent)) {
        blockTokens.push({ text: sent, pos: 'x', sentId: sentenceIdCounter, tokenIdx: 0, encodedRaw: '', isValidSent: false })
      }
      else {
        const tokens = await tokenizer.tokenize(sent)
        let finalTokens = tokens
        const tokenizedStr = tokens.map(t => t.word).join('')

        // Гарантированный фоллбэк: если токенизатор "съел" пробелы или знаки,
        // мы используем Intl.Segmenter, чтобы 100% сохранить структуру HTML без багов.
        if (tokenizedStr !== sent) {
          const segmenter = new Intl.Segmenter(language, { granularity: 'word' })
          finalTokens = []
          for (const { segment, isWordLike } of segmenter.segment(sent)) {
            finalTokens.push({ word: segment, pos: isWordLike ? 'unk' : 'x' })
          }
        }

        const encodedRaw = encodeURIComponent(sent)
        for (let i = 0; i < finalTokens.length; i++) {
          if (finalTokens[i].pos === 'x' && /[\p{L}\p{N}]/u.test(finalTokens[i].word)) {
            finalTokens[i].pos = 'unk'
          }

          blockTokens.push({ text: finalTokens[i].word, pos: finalTokens[i].pos, sentId: sentenceIdCounter, tokenIdx: i, encodedRaw, isValidSent: true })
          if (/[\p{L}\p{N}]/u.test(finalTokens[i].word)) {
            allWords.add(finalTokens[i].word)
            allWords.add(finalTokens[i].word.toLowerCase())
          }
        }
      }
      sentenceIdCounter++
    }

    let currentTokenIdx = 0
    let currentTokenCharOffset = 0

    for (const node of block.textNodes) {
      let nodeText = node.data
      let newHtml = ''
      let activeSentId = -1
      let sentenceHtmlBuf = ''
      let activeEncodedRaw = ''
      let activeIsValid = false

      const closeSentence = () => {
        if (sentenceHtmlBuf) {
          newHtml += `<span class="sentence" data-sent-id="${activeSentId}" data-raw-sent="${activeEncodedRaw}">${sentenceHtmlBuf}</span>`
          sentenceHtmlBuf = ''
        }
      }

      while (nodeText.length > 0 && currentTokenIdx < blockTokens.length) {
        const token = blockTokens[currentTokenIdx]
        const remainingInToken = token.text.substring(currentTokenCharOffset)

        const takeLen = Math.min(nodeText.length, remainingInToken.length)
        const chunk = remainingInToken.substring(0, takeLen)

        nodeText = nodeText.substring(takeLen)
        currentTokenCharOffset += takeLen

        if (currentTokenCharOffset >= token.text.length) {
          currentTokenIdx++
          currentTokenCharOffset = 0
        }

        if (token.sentId !== activeSentId || token.isValidSent !== activeIsValid) {
          if (activeSentId !== -1) {
            if (activeIsValid)
              closeSentence()
            else newHtml += sentenceHtmlBuf
            sentenceHtmlBuf = ''
          }
          activeSentId = token.sentId
          activeEncodedRaw = token.encodedRaw
          activeIsValid = token.isValidSent
        }

        if (activeIsValid) {
          const isPunct = token.pos === 'x'
          const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
          const safeChunk = chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          sentenceHtmlBuf += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodeURIComponent(token.text)}" data-pos="${token.pos}" data-sent-id="${token.sentId}" data-token-idx="${token.tokenIdx}">${safeChunk}</span>`
        }
        else {
          sentenceHtmlBuf += chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
      }

      if (activeSentId !== -1) {
        if (activeIsValid)
          closeSentence()
        else newHtml += sentenceHtmlBuf
      }

      if (nodeText.length > 0) {
        newHtml += nodeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }
      $(node).replaceWith(newHtml)
    }
  }

  return { processedHtml: $.html(), uniqueWords: Array.from(allWords) }
}

export async function analyzeBookVocabulary(bookId: number, language: string) {
  const book = await db.select({ type: schema.books.type }).from(schema.books).where(eq(schema.books.id, bookId)).get()
  const tokenizer = getTokenizer(language)
  const posCounts: Record<string, number> = {}
  const wordFreq: Record<string, { count: number, pos: string, original: string }> = {}
  let totalValidTokens = 0
  let totalSentencesCount = 0

  async function processSentences(sentences: string[]) {
    for (const raw of sentences) {
      if (/^\s+$/.test(raw))
        continue
      const tokens = await tokenizer.tokenize(raw)

      for (const t of tokens) {
        if (t.pos === 'x' && /[\p{L}\p{N}]/u.test(t.word)) {
          t.pos = 'unk'
        }

        if (['x', 'u', 'p', 'c', 'm', 'r'].includes(t.pos))
          continue
        if (t.word.length < (['zh', 'ja'].includes(language) ? 1 : 2))
          continue

        totalValidTokens++
        posCounts[t.pos] = (posCounts[t.pos] || 0) + 1

        const w = t.word.toLowerCase()
        if (!wordFreq[w])
          wordFreq[w] = { count: 0, pos: t.pos, original: t.word }
        wordFreq[w].count++
        if (t.word !== w && wordFreq[w].original === w)
          wordFreq[w].original = t.word
      }
    }
  }

  if (book?.type === 'manga') {
    const pages = await db.select({ ocrData: schema.mangaPages.ocrData }).from(schema.mangaPages).where(eq(schema.mangaPages.bookId, bookId))
    for (const page of pages) {
      if (!page.ocrData)
        continue
      const blocks = JSON.parse(page.ocrData)
      for (const block of blocks) {
        const sentences = splitIntoSentences(block.text || '', language)
        totalSentencesCount += sentences.length
        await processSentences(sentences)
      }
    }
  }
  else {
    const pages = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, bookId))
    for (const page of pages) {
      const plainText = parseHtml(page.content).textContent
      const sentences = splitIntoSentences(plainText, language)
      totalSentencesCount += sentences.length
      await processSentences(sentences)
    }
  }

  const uniqueTokens = Object.keys(wordFreq).length
  const lexicalDiversity = totalValidTokens > 0 ? Math.round((uniqueTokens / totalValidTokens) * 100) : 0
  const allWordsArr = Object.values(wordFreq).map(data => ({ word: data.original, pos: data.pos, count: data.count }))

  // eslint-disable-next-line regexp/no-obscure-range
  const properNouns = allWordsArr.filter(w => ['nr', 'ns', 'nt'].includes(w.pos) || (w.pos.startsWith('n') && /^[A-ZА-ЯЁ]/.test(w.word))).sort((a, b) => b.count - a.count).slice(0, 30)
  const isProper = (word: string) => properNouns.some(p => p.word === word)
  const nouns = allWordsArr.filter(w => w.pos.startsWith('n') && !isProper(w.word)).sort((a, b) => b.count - a.count).slice(0, 30)
  const verbs = allWordsArr.filter(w => w.pos.startsWith('v')).sort((a, b) => b.count - a.count).slice(0, 30)
  const adjs = allWordsArr.filter(w => (w.pos.startsWith('a') || w.pos.startsWith('d')) && !isProper(w.word)).sort((a, b) => b.count - a.count).slice(0, 30)

  // Минимальная длина слова для "редких", чтобы отсекать предлоги (особенно для ru и en)
  const minLength = ['zh', 'ja'].includes(language) ? 2 : 5
  const rareWords = allWordsArr.filter(w => w.count >= 2 && w.count <= 5 && w.word.length >= minLength && !isProper(w.word)).sort((a, b) => b.word.length - a.word.length).slice(0, 30)

  return {
    posDistribution: posCounts,
    topWords: { nouns, verbs, adjs, properNouns, rareWords },
    lexicalDiversity,
    totalSentences: totalSentencesCount,
    totalWords: uniqueTokens,
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

    const sentences = splitIntoSentences(text, language)
    let newHtml = ''

    for (const raw of sentences) {
      if (!/[\p{L}\p{N}]/u.test(raw)) {
        newHtml += raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        continue
      }
      const tokens = await tokenizer.tokenize(raw)
      const encodedRaw = encodeURIComponent(raw)
      let sentHtml = `<span class="sentence" data-sent-id="${sentenceIdCounter}" data-raw-sent="${encodedRaw}">`

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (t.pos === 'x' && /[\p{L}\p{N}]/u.test(t.word)) {
          t.pos = 'unk'
        }

        if (/[\p{L}\p{N}]/u.test(t.word)) {
          allWords.add(t.word)
          allWords.add(t.word.toLowerCase())
        }
        const isPunct = t.pos === 'x'
        const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
        const safeWord = t.word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        sentHtml += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodeURIComponent(t.word)}" data-pos="${t.pos}" data-sent-id="${sentenceIdCounter}" data-token-idx="${i}">${safeWord}</span>`
      }
      sentHtml += '</span>'
      sentenceIdCounter++
      newHtml += sentHtml
    }
    processedBlocks.push({ ...block, html: newHtml })
  }
  return { processedBlocks, uniqueWords: Array.from(allWords) }
}
