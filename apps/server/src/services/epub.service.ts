import type { BookRow, TocItem } from '../types'
import { createWriteStream, mkdirSync } from 'node:fs'
import path from 'node:path'
import { parse as parseHtml } from 'node-html-parser'
import { PAGE_SIZE_CHARS, UPLOADS_PATH } from '../config'
import { db } from '../db'

mkdirSync(UPLOADS_PATH, { recursive: true })

function chunkText(text: string, size: number): string[] {
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > size && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += `${para}\n`
  }
  if (current.trim())
    chunks.push(current.trim())

  return chunks
}

function extractCover(epub: any): string | null {
  try {
    return epub.metadata?.cover || null
  }
  catch { return null }
}

function extractToc(epub: any): TocItem[] {
  try {
    const raw = epub.toc as Array<{
      id: string
      href: string
      title: string
      order: number
      level: number
    }>
    if (!Array.isArray(raw))
      return []
    return raw.map(item => ({
      id: item.id ?? '',
      href: item.href ?? '',
      title: item.title ?? '',
      order: item.order ?? 0,
      level: item.level ?? 1,
    }))
  }
  catch { return [] }
}

export async function processEpub(fileBuffer: ArrayBuffer, filename: string): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const filePath = path.join(UPLOADS_PATH, safeName)
  await Bun.write(filePath, fileBuffer)

  const { default: Epub } = await import('epub2') as any

  return new Promise<number>((resolve, reject) => {
    const epub = new Epub(filePath)

    epub.on('error', reject)
    epub.on('end', async () => {
      try {
        const title = epub.metadata?.title || filename.replace('.epub', '')
        const author = epub.metadata?.creator || null
        const coverBase64 = extractCover(epub)
        let toc = extractToc(epub)

        const allTexts: string[] = []
        const spineItems = epub.spine?.contents || []

        let currentTotalLength = 0
        const hrefToPageMap: Record<string, number> = {}

        // Собираем текст и карту страниц
        for (const item of spineItems) {
          // Вычисляем, на какую страницу попадет начало этой главы
          const startPage = Math.floor(currentTotalLength / PAGE_SIZE_CHARS) + 1

          if (item.href) {
            // Очищаем href от якорей (#) и путей (папок), чтобы сопоставить с TOC
            const baseHref = item.href.split('#')[0].split('/').pop() || item.href
            hrefToPageMap[baseHref] = startPage
          }

          await new Promise<void>((res) => {
            epub.getChapter(item.id, (err: any, text: string) => {
              if (!err && text) {
                const root = parseHtml(text)
                root.querySelectorAll('script, style').forEach(n => n.remove())
                root.querySelectorAll('p, div, br, h1, h2, h3').forEach((n) => {
                  n.insertAdjacentHTML('afterend', '\n')
                })
                const plain = root.text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
                if (plain) {
                  allTexts.push(plain)
                  currentTotalLength += plain.length + 1 // +1 для символа переноса строки
                }
              }
              res()
            })
          })
        }

        // Обогащаем оглавление номерами страниц
        toc = toc.map((t) => {
          let pageNum = 1
          if (t.href) {
            const baseHref = t.href.split('#')[0].split('/').pop() || t.href
            pageNum = hrefToPageMap[baseHref] || 1
          }
          return { ...t, pageNum }
        })

        const tocJson = JSON.stringify(toc)
        const fullText = allTexts.join('\n')
        const pages = chunkText(fullText, PAGE_SIZE_CHARS)

        const insertBook = db.prepare(`
          INSERT INTO books (title, author, coverBase64, filePath, totalPages, toc)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        const result = insertBook.run(title, author, coverBase64, filePath, pages.length, tocJson)
        const bookId = result.lastInsertRowid as number

        const insertPage = db.prepare(`
          INSERT OR IGNORE INTO book_pages (bookId, pageNum, content)
          VALUES (?, ?, ?)
        `)
        const insertMany = db.transaction((chunks: string[]) => {
          chunks.forEach((chunk, idx) => {
            insertPage.run(bookId, idx + 1, chunk)
          })
        })
        insertMany(pages)

        db.prepare(`
          INSERT OR IGNORE INTO reading_progress (bookId, currentPage)
          VALUES (?, 1)
        `).run(bookId)

        resolve(bookId)
      }
      catch (e) {
        reject(e)
      }
    })

    epub.parse()
  })
}
