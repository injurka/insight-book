/* eslint-disable antfu/no-top-level-await */
import type { TocItem } from '../../types'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { eq, sql } from 'drizzle-orm'
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { Elysia } from 'elysia'
import { parse } from 'node-html-parser'
import { BOOKS_PATH, MAX_REQUEST_BODY_SIZE, UPLOADS_PATH } from '../../config'
import { bookController, uploadsController } from '../../controllers/book.controller'
import { client, db } from '../../db'
import * as schema from '../../db/schema'
import { handleElysiaError } from '../../utils/errors'
import { terminatePool } from '../../workers/worker-client'
import { storageService } from '../storage.service'
import { png, uploadFixtures, widePng } from './book-upload-fixtures'

async function seedDatabase() {
  const dialect = new SQLiteSyncDialect()

  for (const table of [schema.users, schema.books, schema.bookPages, schema.mangaPages, schema.readingProgress]) {
    const config = getTableConfig(table)
    const columns = config.columns.map((column) => {
      const defaultValue = column.default === undefined ? '' : ` DEFAULT ${dialect.sqlToQuery(sql`${column.default}`.inlineParams()).sql}`

      return `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${defaultValue}`
    })

    for (const key of config.primaryKeys)
      columns.push(`PRIMARY KEY (${key.columns.map(column => `"${column.name}"`).join(',')})`)

    for (const key of config.uniqueConstraints)
      columns.push(`UNIQUE (${key.columns.map(column => `"${column.name}"`).join(',')})`)

    await db.run(sql.raw(`CREATE TABLE "${config.name}" (${columns.join(',')})`))
  }

  await db.insert(schema.users).values({ id: 1, username: 'upload-test', passwordHash: 'unused', bookLimit: null })
}

const api = new Elysia().onError(handleElysiaError).use(bookController).use(uploadsController).compile()
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
  fetch: request => api.handle(request),
})

function multipart(endpoint: string, form: FormData) {
  return fetch(new URL(`/api/books/${endpoint}`, server.url), { method: 'POST', body: form })
}

function upload(name: string, content: string | Uint8Array<ArrayBufferLike>) {
  const form = new FormData()
  form.append('file', new File([typeof content === 'string' ? content : Uint8Array.from(content)], name, { type: 'application/octet-stream' }))

  return multipart('upload', form)
}

async function successfulBook(response: Response, label: string) {
  const result = await response.json() as { book: typeof schema.books.$inferSelect, success: boolean }
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(result)}`)
  assert.equal(result.success, true, label)

  return result.book
}

async function checkCover(coverUrl: string | null) {
  assert(coverUrl)
  const cover = await fetch(new URL(coverUrl, server.url))
  assert.equal(cover.status, 200)
  assert.equal(cover.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await cover.arrayBuffer()), png)
}

async function verifyComic(
  bookId: number,
  totalPages: number,
  toc: TocItem[],
  name: string,
) {
  assert.deepEqual(toc.map(item => [item.title, item.pageNum]), [['Second page', 2]], name)
  const pages = await db.query.mangaPages.findMany({ where: eq(schema.mangaPages.bookId, bookId) })
  assert.equal(pages.length, totalPages, name)

  for (const page of pages) {
    assert.equal(page.imageWidth, page.pageNum, name)
    assert.equal(page.imageHeight, 1, name)
    const asset = await storageService.getFile(page.imageUrl!)
    assert(asset)
    assert.deepEqual(Buffer.from(asset.buffer), page.pageNum === 1 ? png : widePng, name)
  }
}

async function verifyText(
  fixture: (typeof uploadFixtures)[number],
  bookId: number,
  totalPages: number,
  toc: TocItem[],
  name: string,
) {
  const pages = await db.query.bookPages.findMany({
    where: eq(schema.bookPages.bookId, bookId),
    orderBy: (table, { asc }) => [asc(table.pageNum)],
  })
  assert.equal(pages.length, totalPages, name)
  assert.deepEqual(pages.map(page => page.pageNum), pages.map((_, index) => index + 1), name)

  const textPages = pages.map(page => parse(page.content).textContent)

  const body = 'body' in fixture ? fixture.body : undefined
  const headingTitle = 'toc' in fixture ? fixture.toc : undefined

  if (body)
    assert(textPages.some(page => page.includes(body)), `${name}: missing expected body`)

  if (headingTitle) {
    const heading = toc.find(item => item.title === headingTitle)
    assert(heading?.pageNum, `${name}: missing chapter ${headingTitle}`)
    assert(textPages[heading.pageNum - 1].includes(headingTitle), `${name}: chapter links to the wrong page`)
  }

  if (fixture.type === 'epub') {
    assert.deepEqual(toc.map(item => [item.title, item.level, item.pageNum]), [['第二章', 1, 2], ['小节标题', 2, 4]], name)
    assert(pages.some(page => page.content.includes('data:image/png;base64,')), name)
  }

  if (fixture.type === 'pdf')
    assert.equal(toc[0]?.id, 'pdf-toc-0', name)

  if (fixture.type === 'fb2') {
    const contents = textPages.join('')
    assert.deepEqual(toc.map(item => [item.title, item.level]), [['第二章', 1], ['小节标题', 2]], name)
    assert(contents.indexOf('小节正文') < contents.indexOf('章节结尾'), name)
  }
}

async function verifyUpload(fixture: (typeof uploadFixtures)[number], name: string) {
  const book = await successfulBook(await upload(name, fixture.bytes), name)
  assert.equal(book.type, fixture.type, name)
  assert.equal(book.language, fixture.language, name)

  if ('title' in fixture) {
    assert.equal(book.title, fixture.title, name)
    assert.equal(book.author, 'Author Name', name)
  }

  if ('cover' in fixture)
    await checkCover(book.coverUrl)

  const progress = await db.query.readingProgress.findFirst({ where: eq(schema.readingProgress.bookId, book.id) })
  assert.equal(progress?.currentPage, 1, name)
  assert(book.totalPages > 0, name)
  const tocResult = await fetch(new URL(`/api/books/${book.id}/toc`, server.url))
  assert.equal(tocResult.status, 200, name)
  const toc = await tocResult.json() as TocItem[]
  assert(toc.every(item => Number.isInteger(item.pageNum) && item.pageNum! >= 1 && item.pageNum! <= book.totalPages), name)

  if (fixture.type === 'manga') {
    await verifyComic(
      book.id,
      book.totalPages,
      toc,
      name,
    )
  }
  else {
    await verifyText(
      fixture,
      book.id,
      book.totalPages,
      toc,
      name,
    )
  }

  process.stdout.write(`OK ${name}\n`)
}

async function expectUploadError(
  name: string,
  bytes: string | Uint8Array<ArrayBufferLike>,
  status: number,
  code: string,
) {
  const previousBookCount = await db.$count(schema.books)
  const before = (await readdir(UPLOADS_PATH, { recursive: true })).sort()
  const response = await upload(name, bytes)
  const body = await response.json()

  assert.equal(response.status, status, `${name}: ${JSON.stringify(body)}`)
  assert.equal(body.code, code, name)
  assert.equal(await db.$count(schema.books), previousBookCount, name)
  assert.deepEqual((await readdir(UPLOADS_PATH, { recursive: true })).sort(), before, `${name}: leftover upload artifacts`)
}

async function verifyCustomManga() {
  const create = await fetch(new URL('/api/books/custom', server.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Custom manga',
      text: '',
      targetLang: 'ru',
      type: 'manga',
      language: 'zh',
    }),
  })
  const book = await successfulBook(create, 'custom manga')
  function append(title: string, image: Buffer) {
    const form = new FormData()
    form.set('chapterTitle', title)
    form.append('files', new File([new Uint8Array(image)], '2', { type: 'image/png' }))

    return multipart(`${book.id}/manga-chapter`, form)
  }

  const first = await successfulBook(await append('First chapter', png), 'first chapter')
  await checkCover(first.coverUrl)
  assert.equal((await append('Broken chapter', Buffer.from('not an image'))).status, 422)
  const second = await successfulBook(await append('Second chapter', png), 'second chapter')
  assert.equal(second.totalPages, 2)
  assert.equal(second.coverUrl, first.coverUrl)
  assert.deepEqual((JSON.parse(second.toc!) as TocItem[]).map(item => [item.title, item.pageNum]), [
    ['First chapter', 1],
    ['Second chapter', 2],
  ])
}

try {
  await seedDatabase()
  const uploads = uploadFixtures.flatMap(fixture => fixture.names.map(name => ({ fixture, name })))
  // The first pair reaches the upload route while workers initialize.
  await Promise.all(uploads.slice(0, 2).map(({ fixture, name }) => verifyUpload(fixture, name)))

  for (const { fixture, name } of uploads.slice(2))
    await verifyUpload(fixture, name)

  await expectUploadError(
    'unknown.bin',
    'not a book',
    400,
    'INVALID_FILE_TYPE',
  )
  await expectUploadError(
    'empty.txt',
    '',
    422,
    'UNREADABLE_BOOK',
  )
  await expectUploadError(
    'blank.txt',
    ' \n\t',
    422,
    'UNREADABLE_BOOK',
  )
  await expectUploadError(
    'invalid.srt',
    'no valid subtitle cues',
    422,
    'UNREADABLE_BOOK',
  )
  await expectUploadError(
    'invalid.fb2',
    '<xml/>',
    422,
    'UNREADABLE_BOOK',
  )

  for (const name of ['bad.epub', 'bad.docx', 'bad.pdf', 'bad.mobi', 'bad.cbr']) {
    await expectUploadError(
      name,
      'damaged container',
      422,
      'UNREADABLE_BOOK',
    )
  }

  const noImages = new AdmZip()
  noImages.addFile('details.txt', Buffer.from('Comic metadata without images'))
  await expectUploadError(
    'no-images.cbz',
    noImages.toBuffer(),
    400,
    'MANGA_NO_IMAGES',
  )
  const badImage = new AdmZip()
  badImage.addFile('1.png', png)
  badImage.addFile('2.png', Buffer.from('broken image'))
  await expectUploadError(
    'bad-image.cbz',
    badImage.toBuffer(),
    422,
    'UNREADABLE_BOOK',
  )

  assert((await readdir(BOOKS_PATH, { withFileTypes: true })).every(entry => entry.isDirectory()), 'temporary source files were left in the books directory')
  await verifyCustomManga()

  const oversized = await upload('oversized.txt', new Uint8Array(MAX_REQUEST_BODY_SIZE + 1))
  assert.equal(oversized.status, 413)
  const missingFile = await multipart('upload', new FormData())
  assert.equal(missingFile.status, 400)
  await db.update(schema.users).set({ bookLimit: 0 }).where(eq(schema.users.id, 1))
  await expectUploadError(
    'quota.txt',
    'Readable book rejected by quota',
    403,
    'BOOK_LIMIT_EXCEEDED',
  )
}
finally {
  await server.stop(true)
  terminatePool()
  client.close()
}
