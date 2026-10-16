import type { BookDeckWord } from './types'
import * as cheerio from 'cheerio'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { bookPages } from '../../db/schema'
import { tokenizeEnglishProfile } from '../lexical/english'
import { collectTextBlocks } from '../lexical/html-blocks'
import { tokenizeText } from '../lexical/tokenizers'
import { splitIntoSentences } from '../sentence-splitter'

export async function extractBookDeckWords(bookId: number, language: string): Promise<BookDeckWord[]> {
  const words = new Map<string, BookDeckWord>()
  const lemmaCache = new Map<string, string>()
  const pages = await db.select().from(bookPages).where(eq(bookPages.bookId, bookId)).orderBy(bookPages.pageNum)
  for (const page of pages) {
    const $ = cheerio.load(page.content, null, false)
    $('script, style, rt, rp').remove()
    for (const block of collectTextBlocks($.root().contents().toArray())) {
      for (const sentence of splitIntoSentences(block.fullText, language)) {
        const tokens = language === 'en' ? tokenizeEnglishProfile(sentence, lemmaCache) : await tokenizeText(sentence, language)
        for (const token of tokens) {
          const word = (token.lemma || token.word).normalize('NFKC').replace(/’/g, '\'').toLowerCase()
          if (!/^\p{L}[\p{L}\p{M}'・-]*$/u.test(word) || word.length > 100)
            continue
          let entry = words.get(word)
          if (!entry) {
            entry = { word, count: 0, forms: [], properName: !!token.entity, contexts: [], source: 'missing', content: null }
            words.set(word, entry)
          }
          entry.count++
          if (!entry.forms.includes(token.word) && entry.forms.length < 6)
            entry.forms.push(token.word)
          if (entry.contexts.length < 3 && !entry.contexts.some(c => c.sentence === sentence))
            entry.contexts.push({ sentence: sentence.slice(0, 1500), page: page.pageNum })
        }
      }
    }
  }
  return [...words.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}
