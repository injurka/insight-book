import type { Node } from 'node-html-parser'
import type { EpubInstance, EpubManifestItem, TocItem } from '../../types'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { HTMLElement, parse as parseHtml } from 'node-html-parser'
import { normalizeLanguageCode } from '~/utils/helpers'
import { storageService } from '../storage.service'
import { escapeHtml, HtmlPageBuilder, insertParsedBookToDb, unreadableBook } from './book-parser.utils'

async function extractCover(epub: EpubInstance): Promise<{ buffer: Buffer, ext: string, mime: string } | null> {
  try {
    const getImageData = (id: string): Promise<{ buffer: Buffer, ext: string, mime: string } | null> => {
      return new Promise((resolve) => {
        epub.getImage(id, (err: Error | null, data: Buffer, mimeType: string) => {
          if (err || !data || mimeType === 'image/svg+xml')
            return resolve(null)

          let ext = '.jpg'

          if (mimeType?.includes('png'))
            ext = '.png'
          else if (mimeType?.includes('webp'))
            ext = '.webp'
          else if (mimeType?.includes('gif'))
            ext = '.gif'

          resolve({ buffer: data, ext, mime: mimeType })
        })
      })
    }

    const coverId = epub.metadata?.cover || Object.values(epub.manifest || {})
      .find(item => item.properties?.split(/\s+/).includes('cover-image'))
      ?.id

    if (coverId) {
      const res = await getImageData(coverId)

      if (res)
        return res
    }

    const manifest = epub.manifest || {}
    const coverItem = Object.values(manifest).find((item: EpubManifestItem) => {
      const id = item.id?.toLowerCase() ?? ''
      const href = item.href?.toLowerCase() ?? ''
      const mime = item.mediaType?.toLowerCase() ?? ''

      return mime.startsWith('image/') && (id.includes('cover') || href.includes('cover'))
    })

    if (coverItem && coverItem.id) {
      const res = await getImageData(coverItem.id)

      if (res)
        return res
    }

    const firstImage = Object.values(manifest).find((item: EpubManifestItem) =>
      item.mediaType?.toLowerCase().startsWith('image/'))

    if (firstImage && firstImage.id) {
      const res = await getImageData(firstImage.id)

      if (res)
        return res
    }
  }
  catch { /* ignore */ }

  return null
}

function extractLanguage(epub: EpubInstance): string {
  const lang = epub.metadata?.language

  return normalizeLanguageCode(Array.isArray(lang) ? lang[0] : lang) || 'en'
}

async function getEpubImageBase64(epub: EpubInstance, imageId: string): Promise<string | null> {
  return new Promise((resolve) => {
    epub.getImage(imageId, (err: Error | null, data: Buffer, mimeType: string) => {
      if (err || !data)
        return resolve(null)

      resolve(`data:${mimeType || 'image/jpeg'};base64,${data.toString('base64')}`)
    })
  })
}

const LEAF_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'table', 'pre', 'figure', 'img', 'image', 'svg', 'hr', 'br'])
const IMAGE_TAGS = new Set(['img', 'image', 'svg'])
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'body', 'header', 'footer', 'aside'])
const IMAGE_ROOT = '/insight-epub-images/'

interface ChapterBlock {
  html: string
  length: number
  anchors: string[]
}

function extractBlocks(element: HTMLElement): ChapterBlock[] {
  const blocks: ChapterBlock[] = []
  let pendingAnchors: string[] = []

  function appendBlock(html: string, length: number, anchors: string[] = []) {
    blocks.push({ html, length, anchors: [...pendingAnchors, ...anchors] })
    pendingAnchors = []
  }

  function visit(node: Node) {
    if (!(node instanceof HTMLElement)) {
      const text = node.nodeType === 3 ? node.textContent.trim() : ''

      if (text)
        appendBlock(`<p>${escapeHtml(text)}</p>`, text.length)

      return
    }

    const tag = node.tagName?.toLowerCase()
    const anchor = node.getAttribute('id') || (tag === 'a' ? node.getAttribute('name') : undefined)

    if (anchor)
      pendingAnchors.push(anchor)

    const hasBlockChildren = node.children.some((child) => {
      const childTag = child.tagName.toLowerCase()

      return LEAF_TAGS.has(childTag) || CONTAINER_TAGS.has(childTag)
    })

    if (tag && (LEAF_TAGS.has(tag) || !hasBlockChildren)) {
      const length = node.textContent.trim().length

      const separator = blocks.length > 0 && (tag === 'hr' || tag === 'br')

      if (length || separator || IMAGE_TAGS.has(tag) || node.querySelector('img, image, svg')) {
        const anchors = node.querySelectorAll('[id], a[name]')
          .map(child => child.getAttribute('id') || child.getAttribute('name') || '')
          .filter(Boolean)
        appendBlock(node.outerHTML, length, anchors)
      }

      return
    }

    node.childNodes.forEach(visit)
  }

  element.childNodes.forEach(visit)

  return blocks
}

function decodeHref(value: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function normalizeArchivePath(value: string): string {
  return path.posix.normalize(decodeHref(value).replace(/^\/+/, ''))
}

function readChapter(epub: EpubInstance, id: string, raw = false): Promise<string | null> {
  return new Promise((resolve) => {
    const callback = (error: Error | null, html: string) => resolve(error ? null : html)

    if (raw)
      epub.getChapterRaw(id, callback)
    else
      epub.getChapter(id, callback)
  })
}

async function extractToc(epub: EpubInstance): Promise<TocItem[]> {
  const navItem = Object.values(epub.manifest || {}).find(item => item.properties?.split(/\s+/).includes('nav'))
  const navHtml = navItem?.id ? await readChapter(epub, navItem.id, true) : null

  if (navHtml && navItem?.href) {
    const nav = parseHtml(navHtml).querySelectorAll('nav').find(node => node.getAttribute('epub:type')?.split(/\s+/).includes('toc'))
    const entries = nav?.querySelectorAll('li').flatMap((li): TocItem[] => {
      const link = li.children.find(child => child.tagName === 'A')
      const href = link?.getAttribute('href')
      const title = link?.textContent.trim()

      if (!href || !title || /^(?:[\w+.-]+:|\/\/)/.test(href))
        return []

      let level = 1

      for (let parent = li.parentNode; parent && parent !== nav; parent = parent.parentNode) {
        if (parent.tagName === 'LI')
          level++
      }

      const target = href.startsWith('#')
        ? `${navItem.href}${href}`
        : path.posix.join(path.posix.dirname(navItem.href!), href)

      return [{
        id: '',
        href: target,
        title,
        level,
        order: 0,
      }]
    })

    if (entries?.length)
      return entries
  }

  return (epub.toc || []).map(item => ({
    id: item.id ?? '',
    href: item.href ?? '',
    title: item.title?.trim() ?? '',
    order: item.order ?? 0,
    level: (item.level ?? 0) + 1,
  }))
}

function mapToc(toc: TocItem[], targets: Map<string, number>): TocItem[] {
  const seen = new Set<string>()

  return toc.flatMap((item) => {
    const [archivePath, fragment] = item.href.split('#', 2)
    const normalizedPath = normalizeArchivePath(archivePath)
    const target = fragment ? `${normalizedPath}#${decodeHref(fragment)}` : normalizedPath
    const pageNum = targets.get(target) ?? targets.get(normalizedPath)
    const key = `${target}\0${item.title}`

    if (!pageNum || !item.title || seen.has(key))
      return []

    seen.add(key)
    const order = seen.size - 1

    return [{ ...item, id: `epub-toc-${order}`, order, pageNum }]
  })
}

async function inlineImages(epub: EpubInstance, root: HTMLElement, chapterPath: string) {
  for (const img of root.querySelectorAll('img, image')) {
    const attribute = img.getAttribute('src') === undefined ? 'xlink:href' : 'src'
    const src = img.getAttribute(attribute)

    if (!src || /^(?:[\w+.-]+:|\/\/)/.test(src))
      continue

    const target = src.startsWith(IMAGE_ROOT)
      ? src.slice(IMAGE_ROOT.length)
      : path.posix.join(path.posix.dirname(chapterPath), src)
    const item = Object.values(epub.manifest || {}).find(entry =>
      entry.href && normalizeArchivePath(entry.href) === normalizeArchivePath(target))
    const data = item?.id ? await getEpubImageBase64(epub, item.id) : null

    if (data)
      img.setAttribute(attribute, data)
  }
}

function openEpub(filePath: string, EPub: typeof import('epub2').EPub): Promise<EpubInstance> {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath, IMAGE_ROOT) as unknown as EpubInstance
    epub.on('error', error => reject(unreadableBook(String(error))))
    epub.on('end', () => resolve(epub))
    epub.parse()
  })
}

export async function processEpub(filePath: string, filename: string, userId: number): Promise<number> {
  let coverKey: string | undefined

  try {
    const { EPub } = await import('epub2')
    const epub = await openEpub(filePath, EPub)
    const builder = new HtmlPageBuilder()
    const targets = new Map<string, number>()

    for (const item of epub.spine?.contents || []) {
      const html = await readChapter(epub, item.id)

      if (!html)
        continue

      const root = parseHtml(html)
      root.querySelectorAll('script, style').forEach(node => node.remove())
      root.querySelectorAll('a').forEach(node => node.removeAttribute('href'))
      await inlineImages(epub, root, item.href)
      const chapterPath = normalizeArchivePath(item.href)

      for (const block of extractBlocks(root.querySelector('body') || root)) {
        const pageNum = builder.getPageNumForNextBlock(block.length)

        if (!targets.has(chapterPath))
          targets.set(chapterPath, pageNum)

        for (const anchor of block.anchors)
          targets.set(`${chapterPath}#${anchor}`, pageNum)

        builder.pushBlock(`${block.html}\n`, block.length)
      }
    }

    const pages = builder.finalize()
    const toc = mapToc(await extractToc(epub), targets)
    const cover = await extractCover(epub)

    if (cover) {
      coverKey = `covers/${crypto.randomUUID()}${cover.ext}`
      await storageService.uploadFile(coverKey, cover.buffer, cover.mime)
    }

    return await insertParsedBookToDb({
      userId,
      type: 'epub',
      title: epub.metadata?.title || filename.replace(/\.epub$/i, ''),
      author: epub.metadata?.creator || null,
      filePath,
      coverUrl: coverKey ? `/api/uploads/${coverKey}` : null,
      language: extractLanguage(epub),
      pages,
      toc,
    })
  }
  catch (error) {
    if (coverKey)
      await storageService.deleteFile(coverKey).catch(() => {})

    throw error
  }
  finally {
    await unlink(filePath).catch(() => {})
  }
}
