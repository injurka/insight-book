import type { TocItem } from '../types'
import path from 'node:path'
import { parse as parseHtml } from 'node-html-parser'
import { BOOKS_PATH, COVERS_PATH, PAGE_SIZE_CHARS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'

async function extractCover(epub: any): Promise<{ buffer: Buffer, ext: string } | null> {
  try {
    const getImageData = (id: string): Promise<{ buffer: Buffer, ext: string } | null> => {
      return new Promise((resolve) => {
        epub.getImage(id, (err: any, data: Buffer, mimeType: string) => {
          if (err || !data)
            return resolve(null)
          let ext = '.jpg'
          if (mimeType?.includes('png'))
            ext = '.png'
          else if (mimeType?.includes('webp'))
            ext = '.webp'
          else if (mimeType?.includes('gif'))
            ext = '.gif'
          resolve({ buffer: data, ext })
        })
      })
    }

    const coverId = epub.metadata?.cover
    if (coverId) {
      const res = await getImageData(coverId)
      if (res)
        return res
    }

    const manifest = epub.manifest || {}
    const coverItem = Object.values(manifest).find((item: any) => {
      const id = item.id?.toLowerCase() ?? ''
      const href = item.href?.toLowerCase() ?? ''
      const mime = item.mediaType?.toLowerCase() ?? ''
      return mime.startsWith('image/') && (id.includes('cover') || href.includes('cover'))
    })

    if (coverItem) {
      const res = await getImageData((coverItem as any).id)
      if (res)
        return res
    }

    const firstImage = Object.values(manifest).find((item: any) =>
      item.mediaType?.toLowerCase().startsWith('image/'),
    )
    if (firstImage) {
      const res = await getImageData((firstImage as any).id)
      if (res)
        return res
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
    const raw = epub.toc as Array<any>
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
      if (err || !data)
        return resolve(null)
      resolve(`data:${mimeType || 'image/jpeg'};base64,${data.toString('base64')}`)
    })
  })
}

export async function processEpub(fileBuffer: ArrayBuffer, filename: string, userId: number): Promise<number> {
  const safeName = `${Date.now()}_${filename.replace(/[^\w.-]/g, '_')}`
  const filePath = path.join(BOOKS_PATH, safeName)
  await Bun.write(filePath, fileBuffer)

  const { EPub } = await import('epub2') as any

  return new Promise<number>((resolve, reject) => {
    const epub = new EPub(filePath)

    epub.on('error', reject)
    epub.on('end', async () => {
      try {
        const title = epub.metadata?.title || filename.replace('.epub', '')
        const author = epub.metadata?.creator || null

        const coverData = await extractCover(epub)
        let coverUrl = null
        if (coverData) {
          const coverFilename = `${Date.now()}_cover${coverData.ext}`
          await Bun.write(path.join(COVERS_PATH, coverFilename), coverData.buffer)
          coverUrl = `/api/uploads/covers/${coverFilename}`
        }

        const language = extractLanguage(epub)
        let toc = extractToc(epub)

        const allHtmlPages: string[] = []
        const spineItems = epub.spine?.contents || []

        let currentTotalLength = 0
        let currentPageHtml = ''
        const hrefToPageMap: Record<string, number> = {}

        for (const item of spineItems) {
          const startPage = allHtmlPages.length + 1

          if (item.href) {
            const baseHref = item.href.split('#')[0].split('/').pop() || item.href
            if (!hrefToPageMap[baseHref]) {
              hrefToPageMap[baseHref] = startPage
            }
          }

          await new Promise<void>((res) => {
            epub.getChapter(item.id, async (err: any, html: string) => {
              if (!err && html) {
                const root = parseHtml(html)

                root.querySelectorAll('script, style').forEach(n => n.remove())
                root.querySelectorAll('a').forEach(node => node.replaceWith(node.innerHTML))

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

                const body = root.querySelector('body') || root

                // --- НОВАЯ ЛОГИКА РЕКУРСИВНОГО ПАРСИНГА БЛОКОВ ---
                const leafTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'table', 'pre', 'figure', 'img', 'image', 'hr', 'br'])
                const containerTags = new Set(['div', 'section', 'article', 'main', 'body', 'header', 'footer', 'aside'])

                const leaves: { html: string, textLength: number }[] = []

                function extractLeaves(node: any) {
                  // Если это текстовая нода (напрямую текст без обертки)
                  if (node.nodeType === 3) {
                    const text = node.textContent?.trim()
                    if (text) {
                      leaves.push({
                        html: `<p>${node.textContent}</p>`,
                        textLength: text.length,
                      })
                    }
                    return
                  }

                  // Если это HTML элемент
                  if (node.nodeType === 1) {
                    const tag = node.tagName?.toLowerCase()
                    if (tag === 'script' || tag === 'style')
                      return

                    // Если это известный листовой блочный тег (абзац, заголовок, картинка)
                    if (leafTags.has(tag)) {
                      leaves.push({
                        html: node.outerHTML,
                        textLength: node.textContent?.trim().length || 0,
                      })
                      return
                    }

                    // Проверяем, есть ли внутри этого контейнера другие блочные теги
                    let hasBlockChildren = false
                    for (const child of node.childNodes) {
                      if (child.nodeType === 1) {
                        const cTag = child.tagName?.toLowerCase()
                        if (leafTags.has(cTag) || containerTags.has(cTag)) {
                          hasBlockChildren = true
                          break
                        }
                      }
                    }

                    // Если внутри есть блоки или это структурный контейнер — рекурсивно ныряем глубже
                    if (hasBlockChildren) {
                      node.childNodes.forEach((child: any) => extractLeaves(child))
                    }
                    else {
                      // Это контейнер, содержащий только текст или inline элементы (span, b, i). Берем его целиком.
                      const textLen = node.textContent?.trim().length || 0
                      if (textLen > 0 || tag === 'img' || tag === 'image') {
                        leaves.push({
                          html: node.outerHTML,
                          textLength: textLen,
                        })
                      }
                    }
                  }
                }

                extractLeaves(body)

                // Теперь собираем из "листьев" (отдельных абзацев) нормальные страницы
                for (const leaf of leaves) {
                  // Проверяем лимит ДО добавления блока
                  if (currentTotalLength > 0 && currentTotalLength + leaf.textLength >= PAGE_SIZE_CHARS) {
                    allHtmlPages.push(currentPageHtml)
                    currentPageHtml = ''
                    currentTotalLength = 0
                  }

                  currentPageHtml += `${leaf.html}\n`
                  currentTotalLength += leaf.textLength
                }
                // --- КОНЕЦ НОВОЙ ЛОГИКИ ---
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

        const [insertedBook] = await db.insert(schema.books).values({
          userId,
          type: 'epub',
          title,
          author,
          coverUrl,
          filePath,
          language,
          totalPages: allHtmlPages.length,
          toc: tocJson,
        }).returning({ id: schema.books.id })

        const bookId = insertedBook.id

        const pagesToInsert = allHtmlPages.map((chunk, idx) => ({
          bookId,
          pageNum: idx + 1,
          content: chunk,
        }))

        const chunkSize = 1000
        for (let i = 0; i < pagesToInsert.length; i += chunkSize) {
          const chunk = pagesToInsert.slice(i, i + chunkSize)
          await db.insert(schema.bookPages).values(chunk).onConflictDoNothing()
        }

        await db.insert(schema.readingProgress).values({
          bookId,
          currentPage: 1,
        }).onConflictDoNothing()

        resolve(bookId)
      }
      catch (e) {
        reject(e)
      }
    })

    epub.parse()
  })
}
