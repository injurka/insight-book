import { normalizeLanguageCode } from '@injurka/insight-book-language-utils'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { tokenizeEnglishProfile } from './lexical/english'
import { collectTextBlocks } from './lexical/html-blocks'
import { LexicalProfile } from './lexical/profile'
import { tokenizeText } from './lexical/tokenizers'
import { splitIntoSentences } from './sentence-splitter'

export { tokenizeHtmlPage, tokenizeOcrBlocks } from './lexical/reader-tokenizer'

export async function analyzeBookVocabulary(bookId: number, language: string) {
  language = normalizeLanguageCode(language)
  const book = await db.select({ type: schema.books.type }).from(schema.books).where(eq(schema.books.id, bookId)).get()
  const profile = new LexicalProfile(language)
  const lemmaCache = new Map<string, string>()
  let totalSentencesCount = 0
  let pageIndex = 0

  async function processSentences(sentences: string[]) {
    for (const raw of sentences) {
      if (!/[\p{L}\p{N}]/u.test(raw))
        continue
      totalSentencesCount++
      const tokens = language === 'en' ? tokenizeEnglishProfile(raw, lemmaCache) : await tokenizeText(raw, language)
      profile.addSentence(tokens, pageIndex)
    }
  }

  if (book?.type === 'manga') {
    const pages = await db.select({ ocrData: schema.mangaPages.ocrData }).from(schema.mangaPages).where(eq(schema.mangaPages.bookId, bookId)).orderBy(schema.mangaPages.pageNum)
    for (const page of pages) {
      pageIndex++
      if (!page.ocrData)
        continue
      const blocks = JSON.parse(page.ocrData)
      for (const block of blocks) {
        const sentences = splitIntoSentences(block.text || '', language)
        await processSentences(sentences)
      }
    }
  }
  else {
    const pages = await db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, bookId)).orderBy(schema.bookPages.pageNum)
    for (const page of pages) {
      pageIndex++
      const $ = cheerio.load(page.content, null, false)
      for (const block of collectTextBlocks($.root().contents().toArray()))
        await processSentences(splitIntoSentences(block.fullText, language))
    }
  }

  return { ...profile.finish(), totalSentences: totalSentencesCount }
}

export { initNLP } from './lexical/tokenizers'
