import type { TocItem } from '../types'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { parse as parseHtml } from 'node-html-parser'
import { PAGE_SIZE_CHARS, UPLOADS_PATH } from '../config'
import { db } from '../db'

mkdirSync(UPLOADS_PATH, { recursive: true })

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  // Разбиваем на абзацы, сохраняя саму структуру переносов \n
  const paragraphs = text.split(/(\n+)/)

  for (const para of paragraphs) {
    // Если это просто переносы строк (пустота), добавляем к текущей странице
    if (!para.trim() && para.includes('\n')) {
      currentChunk += para
      continue
    }

    // Разбиваем абзац на предложения по знакам пунктуации (включая азиатские)
    const parts = para.split(/([.!?…。！？]+\s*)/)

    for (let i = 0; i < parts.length; i += 2) {
      const sentence = (parts[i] || '') + (parts[i + 1] || '')
      if (!sentence)
        continue

      // Если после добавления предложения лимит превышен и страница не пустая — закрываем страницу
      if (currentChunk.length + sentence.length > size && currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }

      currentChunk += sentence
    }
  }

  // Не забываем добавить остаток
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function extractCover(epub: any): Promise<string | null> {
  try {
    // 1. Пробуем взять id обложки из метаданных
    const coverId: string | undefined = epub.metadata?.cover

    if (coverId) {
      const result = await new Promise<string | null>((resolve) => {
        epub.getImage(coverId, (err: any, data: Buffer, mimeType: string) => {
          if (err || !data) {
            resolve(null)
            return
          }
          const mime = mimeType || 'image/jpeg'
          resolve(`data:${mime};base64,${Buffer.from(data).toString('base64')}`)
        })
      })
      if (result)
        return result
    }

    // 2. Fallback: ищем обложку по характерным id/href в манифесте
    const manifest: Record<string, { id: string, href: string, mediaType: string }> = epub.manifest || {}
    const coverItem = Object.values(manifest).find((item) => {
      const id = item.id?.toLowerCase() ?? ''
      const href = item.href?.toLowerCase() ?? ''
      const mime = item.mediaType?.toLowerCase() ?? ''
      return (
        mime.startsWith('image/')
        && (id.includes('cover') || href.includes('cover'))
      )
    })

    if (coverItem) {
      const result = await new Promise<string | null>((resolve) => {
        epub.getImage(coverItem.id, (err: any, data: Buffer, mimeType: string) => {
          if (err || !data) {
            resolve(null)
            return
          }
          const mime = mimeType || coverItem.mediaType || 'image/jpeg'
          resolve(`data:${mime};base64,${Buffer.from(data).toString('base64')}`)
        })
      })
      if (result)
        return result
    }

    // 3. Fallback: берём первое попавшееся изображение из манифеста
    const firstImage = Object.values(manifest).find(item =>
      item.mediaType?.toLowerCase().startsWith('image/'),
    )

    if (firstImage) {
      const result = await new Promise<string | null>((resolve) => {
        epub.getImage(firstImage.id, (err: any, data: Buffer, mimeType: string) => {
          if (err || !data) {
            resolve(null)
            return
          }
          const mime = mimeType || firstImage.mediaType || 'image/jpeg'
          resolve(`data:${mime};base64,${Buffer.from(data).toString('base64')}`)
        })
      })
      if (result)
        return result
    }
  }
  catch { /* ignore */ }

  return null
}

function extractLanguage(epub: any): string {
  try {
    const lang = epub.metadata?.language
    if (Array.isArray(lang))
      return lang[0].substring(0, 2).toLowerCase()
    if (typeof lang === 'string')
      return lang.substring(0, 2).toLowerCase()
  }
  catch { }
  return 'en'
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
  const { EPub } = await import('epub2') as any

  return new Promise<number>((resolve, reject) => {
    const epub = new EPub(filePath)

    epub.on('error', reject)
    epub.on('end', async () => {
      try {
        const title = epub.metadata?.title || filename.replace('.epub', '')
        const author = epub.metadata?.creator || null
        const coverBase64 = await extractCover(epub) // <-- теперь async
        const language = extractLanguage(epub)
        let toc = extractToc(epub)

        const allTexts: string[] = []
        const spineItems = epub.spine?.contents || []

        let currentTotalLength = 0
        const hrefToPageMap: Record<string, number> = {}

        for (const item of spineItems) {
          const startPage = Math.floor(currentTotalLength / PAGE_SIZE_CHARS) + 1

          if (item.href) {
            const baseHref = item.href.split('#')[0].split('/').pop() || item.href
            hrefToPageMap[baseHref] = startPage
          }

          await new Promise<void>((res) => {
            epub.getChapter(item.id, (err: any, text: string) => {
              if (!err && text) {
                const root = parseHtml(text)
                root.querySelectorAll('script, style').forEach(n => n.remove())

                // Вставляем маркер только после логических блоков (абзацев, списков, заголовков)
                root.querySelectorAll('p, div, br, h1, h2, h3, li, blockquote').forEach((n) => {
                  n.insertAdjacentHTML('afterend', '[[BLOCK_BREAK]]')
                })

                let plain = root.text
                // 1. Убираем технические переносы строк внутри предложений (превращаем в пробелы)
                plain = plain.replace(/\s+/g, ' ')
                // 2. Восстанавливаем реальные абзацы двойным переносом \n\n
                plain = plain.replace(/(\s*\[\[BLOCK_BREAK\]\]\s*)+/g, '\n\n').trim()

                if (plain) {
                  allTexts.push(plain)
                  currentTotalLength += plain.length + 1
                }
              }
              res()
            })
          })
        }

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
          INSERT INTO books (title, author, coverBase64, filePath, language, totalPages, toc)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        const result = insertBook.run(title, author, coverBase64, filePath, language, pages.length, tocJson)
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
