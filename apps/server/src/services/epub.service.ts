import type { TocItem } from '../types'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { parse as parseHtml } from 'node-html-parser'
import { PAGE_SIZE_CHARS, UPLOADS_PATH } from '../config'
import { sqlite } from '../db'

mkdirSync(UPLOADS_PATH, { recursive: true })

async function extractCover(epub: any): Promise<string | null> {
  try {
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

async function getEpubImageBase64(epub: any, imageId: string): Promise<string | null> {
  return new Promise((resolve) => {
    epub.getImage(imageId, (err: any, data: Buffer, mimeType: string) => {
      if (err || !data) {
        return resolve(null)
      }
      resolve(`data:${mimeType || 'image/jpeg'};base64,${data.toString('base64')}`)
    })
  })
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
        const coverBase64 = await extractCover(epub)
        const language = extractLanguage(epub)
        let toc = extractToc(epub)

        const allHtmlPages: string[] = []
        const spineItems = epub.spine?.contents || []

        let currentTotalLength = 0
        let currentPageHtml = ''
        const hrefToPageMap: Record<string, number> = {}

        for (const item of spineItems) {
          const startPage = Math.floor(currentTotalLength / PAGE_SIZE_CHARS) + 1

          if (item.href) {
            const baseHref = item.href.split('#')[0].split('/').pop() || item.href
            hrefToPageMap[baseHref] = startPage
          }

          await new Promise<void>((res) => {
            epub.getChapter(item.id, async (err: any, html: string) => {
              if (!err && html) {
                const root = parseHtml(html)
                root.querySelectorAll('script, style').forEach(n => n.remove())

                const images = root.querySelectorAll('img, image')
                for (const img of images) {
                  const src = img.getAttribute('src') || img.getAttribute('xlink:href')
                  if (src) {
                    const fileName = src.split('/').pop()
                    if (fileName) {
                      const manifestItem = Object.values(epub.manifest || {}).find((m: any) => m.href && m.href.includes(fileName))
                      if (manifestItem) {
                        const base64 = await getEpubImageBase64(epub, (manifestItem as any).id)
                        if (base64) {
                          if (img.tagName.toLowerCase() === 'image')
                            img.setAttribute('xlink:href', base64)
                          else img.setAttribute('src', base64)
                        }
                      }
                    }
                  }
                }

                // Ищем тег body, чтобы взять только его детей. Иначе берем корень.
                const body = root.querySelector('body') || root
                const blockElements = body.childNodes

                for (const node of blockElements) {
                  const nodeHtml = node.toString()
                  const textLength = node.textContent?.trim().length || 0

                  // Пропускаем пустые текстовые узлы между тегами на верхнем уровне
                  if (!nodeHtml.trim() && textLength === 0)
                    continue

                  currentPageHtml += `${nodeHtml}\n`
                  currentTotalLength += textLength

                  if (currentTotalLength >= PAGE_SIZE_CHARS) {
                    allHtmlPages.push(currentPageHtml)
                    currentPageHtml = ''
                    currentTotalLength = 0
                  }
                }
              }
              res()
            })
          })
        }

        if (currentPageHtml.trim()) {
          allHtmlPages.push(currentPageHtml)
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

        const insertBook = sqlite.prepare(`
          INSERT INTO books (title, author, coverBase64, filePath, language, totalPages, toc)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        const result = insertBook.run(title, author, coverBase64, filePath, language, allHtmlPages.length, tocJson)
        const bookId = result.lastInsertRowid as number

        const insertPage = sqlite.prepare(`
          INSERT OR IGNORE INTO book_pages (bookId, pageNum, content)
          VALUES (?, ?, ?)
        `)
        const insertMany = sqlite.transaction((chunks: string[]) => {
          chunks.forEach((chunk, idx) => {
            insertPage.run(bookId, idx + 1, chunk)
          })
        })
        insertMany(allHtmlPages)

        sqlite.prepare(`
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
