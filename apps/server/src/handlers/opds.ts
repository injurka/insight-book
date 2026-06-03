import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { CORS_HEADERS } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { fetchAndParseOpds } from '../services/opds.service'
import { AppError } from '../utils/errors'
import { runWorkerTask } from '../workers/worker-client'

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

const CatalogSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
})

export async function handleGetCatalogs(req: Request, userId: number) {
  const catalogs = await db.query.opdsCatalogs.findMany({
    where: eq(schema.opdsCatalogs.userId, userId),
  })
  return json(catalogs)
}

export async function handleAddCatalog(req: Request, userId: number) {
  const body = CatalogSchema.parse(await req.json())
  const [catalog] = await db.insert(schema.opdsCatalogs).values({
    userId,
    title: body.title,
    url: body.url,
  }).returning()
  return json(catalog)
}

export async function handleDeleteCatalog(req: Request, userId: number) {
  const id = Number((req as any).params.id)
  await db.delete(schema.opdsCatalogs).where(and(eq(schema.opdsCatalogs.id, id), eq(schema.opdsCatalogs.userId, userId)))
  return json({ success: true })
}

export async function handleBrowseOpds(req: Request, userId: number) {
  const url = new URL(req.url)
  const opdsUrl = url.searchParams.get('url')
  if (!opdsUrl)
    throw new AppError(400, 'url is required')

  const data = await fetchAndParseOpds(opdsUrl)
  return json(data)
}

export async function handleDownloadOpdsBook(req: Request, userId: number) {
  const { downloadUrl, title, type } = await req.json()

  const res = await fetch(downloadUrl, { headers: { 'User-Agent': 'InsightBook/1.0' } })
  if (!res.ok)
    throw new AppError(400, 'Failed to download book')

  const arrayBuffer = await res.arrayBuffer()

  let ext = '.epub'
  if (type?.includes('epub')) {
    ext = '.epub'
  }
  else if (type?.includes('fb2')) {
    ext = '.fb2'
  }
  else if (type?.includes('cbz') || downloadUrl.includes('.cbz')) {
    ext = '.cbz'
  }
  else if (type?.includes('zip') || downloadUrl.includes('.zip')) {
    if (downloadUrl.includes('fb2'))
      ext = '.fb2'
    else ext = '.zip'
  }

  const filename = `${title.replace(/[^\wА-Я.-]/gi, '_')}${ext}`

  let bookId: number
  if (ext === '.epub') {
    bookId = await runWorkerTask('processEpub', { buffer: arrayBuffer, filename, userId })
  }
  else if (ext === '.fb2' || ext === '.fb2.zip' || filename.endsWith('.fb2.zip')) {
    bookId = await runWorkerTask('processFb2', { buffer: arrayBuffer, filename, userId })
  }
  else if (ext === '.cbz' || ext === '.zip') {
    bookId = await runWorkerTask('processCbz', { buffer: arrayBuffer, filename, userId })
  }
  else {
    throw new AppError(400, 'Unsupported format')
  }

  const book = await db.query.books.findFirst({ where: eq(schema.books.id, bookId) })
  return json({ success: true, book })
}
