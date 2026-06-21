import { and, desc, eq } from 'drizzle-orm'
import { CreateHighlightSchema, UpdateHighlightSchema } from '~/types/schemas'
import { json } from '~/utils/helpers'
import { db } from '../db'
import * as schema from '../db/schema'
import { AppError } from '../utils/errors'

export async function handleGetHighlights(req: Request, userId: number): Promise<Response> {
  const url = new URL(req.url)
  const bookIdStr = url.searchParams.get('bookId')

  const conditions = [eq(schema.highlights.userId, userId)]
  if (bookIdStr) {
    conditions.push(eq(schema.highlights.bookId, Number(bookIdStr)))
  }

  const list = await db.query.highlights.findMany({
    where: and(...conditions),
    orderBy: desc(schema.highlights.createdAt),
  })

  return json(list)
}

export async function handleCreateHighlight(req: Request, userId: number): Promise<Response> {
  const body = CreateHighlightSchema.parse(await req.json())

  const [newHighlight] = await db.insert(schema.highlights).values({
    userId,
    bookId: body.bookId,
    text: body.text,
    translation: body.translation,
    note: body.note,
    color: body.color,
    chapter: body.chapter,
    pageNum: body.pageNum,
  }).returning()

  return json(newHighlight, 201)
}

export async function handleUpdateHighlight(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)
  const body = UpdateHighlightSchema.parse(await req.json())

  const [updatedHighlight] = await db.update(schema.highlights)
    .set(body)
    .where(and(
      eq(schema.highlights.id, id),
      eq(schema.highlights.userId, userId),
    ))
    .returning()

  if (!updatedHighlight) {
    throw new AppError(404, 'Выделение не найдено или доступ закрыт')
  }

  return json(updatedHighlight)
}

export async function handleDeleteHighlight(req: Request, userId: number): Promise<Response> {
  const id = Number(req.params.id)

  const deleted = await db.delete(schema.highlights)
    .where(and(
      eq(schema.highlights.id, id),
      eq(schema.highlights.userId, userId),
    ))
    .returning()

  if (deleted.length === 0) {
    throw new AppError(404, 'Выделение не найдено или доступ закрыт')
  }

  return json({ success: true })
}
