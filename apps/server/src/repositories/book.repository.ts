import type { SQL } from 'drizzle-orm'
import { and, desc, eq, inArray, isNotNull, like, or, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'

export class BookRepository {
  buildPublicConditions(tag: string | null, search: string | null, language: string | null): (SQL | undefined)[] {
    const conditions: (SQL | undefined)[] = [eq(schema.books.isPublic, true)]
    if (tag) {
      conditions.push(like(schema.bookStats.tags, `%${tag}%`))
    }
    if (search) {
      conditions.push(like(schema.books.title, `%${search}%`))
    }
    if (language) {
      conditions.push(eq(schema.books.language, language))
    }
    return conditions
  }

  async getPublicBooksBaseQuery(page: number, limit: number, conditions: (SQL | undefined)[]) {
    return db.select({
      book: schema.books,
      stats: schema.bookStats,
      progress: schema.readingProgress,
    })
      .from(schema.books)
      .leftJoin(schema.bookStats, eq(schema.books.id, schema.bookStats.bookId))
      .leftJoin(schema.readingProgress, and(
        eq(schema.readingProgress.bookId, schema.books.id),
        sql`1=0`,
      ))
      .where(and(...conditions))
      .orderBy(desc(schema.books.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
  }

  async countPublicBooks(conditions: (SQL | undefined)[]) {
    const res = await db.select({ count: sql<number>`count(*)` })
      .from(schema.books)
      .leftJoin(schema.bookStats, eq(schema.books.id, schema.bookStats.bookId))
      .where(and(...conditions))
      .get()
    return res?.count || 0
  }

  async getLlmCounts(bookIds: number[], targetLang: string) {
    if (bookIds.length === 0)
      return []
    return db.select({
      bookId: schema.bookLlmCache.bookId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(schema.bookLlmCache)
      .innerJoin(schema.llmCache, eq(schema.bookLlmCache.sentenceHash, schema.llmCache.sentenceHash))
      .where(and(
        inArray(schema.bookLlmCache.bookId, bookIds),
        eq(schema.llmCache.targetLanguage, targetLang),
      ))
      .groupBy(schema.bookLlmCache.bookId)
  }

  async getUserBooks(userId: number) {
    return db.query.books.findMany({
      where: or(
        eq(schema.books.userId, userId),
        eq(schema.books.isPublic, true),
      ),
      with: { progresses: { where: eq(schema.readingProgress.userId, userId), limit: 1 } },
      orderBy: [desc(schema.books.updatedAt)],
    })
  }

  async getBookById(id: number, userId: number | null) {
    let condition
    if (userId) {
      condition = and(
        eq(schema.books.id, id),
        or(eq(schema.books.userId, userId), eq(schema.books.isPublic, true)),
      )
    }
    else {
      condition = and(
        eq(schema.books.id, id),
        eq(schema.books.isPublic, true),
      )
    }

    return db.query.books.findFirst({
      where: condition,
      with: {
        progresses: userId ? { where: eq(schema.readingProgress.userId, userId), limit: 1 } : undefined,
        stats: true,
      },
    })
  }

  async getBookAnalysesCounts(id: number, targetLang: string) {
    const [sentencesCountRes, wordsCountRes, ttsCountRes] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(schema.bookLlmCache)
        .innerJoin(schema.llmCache, eq(schema.bookLlmCache.sentenceHash, schema.llmCache.sentenceHash))
        .where(and(
          eq(schema.bookLlmCache.bookId, id),
          eq(schema.bookLlmCache.type, 'sentence'),
          eq(schema.llmCache.targetLanguage, targetLang),
        ))
        .get(),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.bookLlmCache)
        .innerJoin(schema.llmCache, eq(schema.bookLlmCache.sentenceHash, schema.llmCache.sentenceHash))
        .where(and(
          eq(schema.bookLlmCache.bookId, id),
          eq(schema.bookLlmCache.type, 'word'),
          eq(schema.llmCache.targetLanguage, targetLang),
        ))
        .get(),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.bookTtsCache)
        .where(eq(schema.bookTtsCache.bookId, id))
        .get(),
    ])
    return { sentencesCountRes, wordsCountRes, ttsCountRes }
  }

  async getMangaPagesCount(id: number) {
    return db.select({ count: sql<number>`count(*)` })
      .from(schema.mangaPages)
      .where(and(eq(schema.mangaPages.bookId, id), isNotNull(schema.mangaPages.ocrData)))
      .get()
  }

  async findFirstBook(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id) })
  }

  async startReadingProgress(bookId: number, userId: number) {
    return db.insert(schema.readingProgress).values({
      bookId,
      userId,
      currentPage: 1,
      status: 'reading',
      isFavorite: false,
      collection: null,
      updatedAt: new Date().toISOString(),
    }).onConflictDoNothing()
  }

  async upsertBookStats(bookId: number, data: Partial<typeof schema.bookStats.$inferInsert>) {
    return db.insert(schema.bookStats).values({
      bookId,
      ...data,
    }).onConflictDoUpdate({
      target: schema.bookStats.bookId,
      set: data,
    })
  }

  async getBookStats(bookId: number) {
    return db.query.bookStats.findFirst({ where: eq(schema.bookStats.bookId, bookId) })
  }

  async updateBook(id: number, data: Partial<typeof schema.books.$inferInsert>) {
    return db.update(schema.books).set(data).where(eq(schema.books.id, id))
  }

  async upsertReadingProgress(bookId: number, userId: number, payload: Partial<typeof schema.readingProgress.$inferInsert>) {
    return db.insert(schema.readingProgress).values({
      bookId,
      userId,
      currentPage: payload.currentPage ?? 1,
      status: payload.status ?? 'reading',
      isFavorite: payload.isFavorite ?? false,
      collection: payload.collection ?? null,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [schema.readingProgress.bookId, schema.readingProgress.userId],
      set: payload,
    })
  }

  async getBookPages(bookId: number) {
    return db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(eq(schema.bookPages.bookId, bookId)).orderBy(schema.bookPages.pageNum)
  }

  async getOldBookForCover(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { coverUrl: true, userId: true } })
  }

  async updateCoverUrl(id: number, coverUrl: string) {
    return db.transaction(async (tx) => {
      await tx.update(schema.books).set({ coverUrl }).where(eq(schema.books.id, id))
    })
  }

  async createCustomBookWithProgress(data: typeof schema.books.$inferInsert, userId: number) {
    return db.transaction(async (tx) => {
      const [book] = await tx.insert(schema.books).values(data).returning()
      await tx.insert(schema.readingProgress).values({
        bookId: book.id,
        userId,
        currentPage: 1,
      }).onConflictDoNothing()
      return book
    })
  }

  async getBookForDeletion(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { filePath: true, coverUrl: true, userId: true, isPublic: true, publicStatus: true } })
  }

  async deleteReadingProgress(bookId: number, userId: number) {
    return db.delete(schema.readingProgress).where(and(eq(schema.readingProgress.bookId, bookId), eq(schema.readingProgress.userId, userId)))
  }

  async deleteBook(id: number) {
    return db.transaction(async (tx) => {
      await tx.delete(schema.books).where(eq(schema.books.id, id))
    })
  }

  async getBookToc(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { toc: true, userId: true, isPublic: true } })
  }

  async getBookForPage(id: number) {
    return db.select({
      totalPages: schema.books.totalPages,
      language: schema.books.language,
      type: schema.books.type,
      userId: schema.books.userId,
      isPublic: schema.books.isPublic,
      textDirection: schema.books.textDirection,
    })
      .from(schema.books)
      .where(eq(schema.books.id, id))
      .get()
  }

  async getMangaPage(bookId: number, pageNum: number) {
    return db.select().from(schema.mangaPages).where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum))).get()
  }

  async updateMangaPageOcr(id: number, ocrData: string) {
    return db.update(schema.mangaPages).set({ ocrData }).where(eq(schema.mangaPages.id, id))
  }

  async getNlpCache(bookId: number, pageNum: number) {
    return db.query.nlpCache.findFirst({
      where: and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)),
    })
  }

  async getBookPageContent(bookId: number, pageNum: number) {
    return db.select({ content: schema.bookPages.content }).from(schema.bookPages).where(and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum))).get()
  }

  async upsertNlpCache(bookId: number, pageNum: number, data: string) {
    return db.transaction(async (tx) => {
      await tx.delete(schema.nlpCache).where(and(eq(schema.nlpCache.bookId, bookId), eq(schema.nlpCache.pageNum, pageNum)))
      await tx.insert(schema.nlpCache).values({ bookId, pageNum, data })
    })
  }

  async getBookLangAndType(id: number) {
    return db.query.books.findFirst({
      where: eq(schema.books.id, id),
      columns: { language: true, type: true, userId: true, isPublic: true },
    })
  }

  async getMangaPageInfo(bookId: number, pageNum: number) {
    return db.query.mangaPages.findFirst({
      where: and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum)),
    })
  }

  async getBookPageInfo(bookId: number, pageNum: number) {
    return db.query.bookPages.findFirst({
      where: and(eq(schema.bookPages.bookId, bookId), eq(schema.bookPages.pageNum, pageNum)),
    })
  }

  async getBookUserIdAndPublic(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { id: true, userId: true, isPublic: true } })
  }

  async getBookLanguage(id: number) {
    return db.query.books.findFirst({ where: eq(schema.books.id, id), columns: { language: true, userId: true, isPublic: true } })
  }

  async getUserRole(userId: number) {
    return db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { role: true } })
  }

  async getMangaPageImageUrl(bookId: number, pageNum: number) {
    return db.select({ imageUrl: schema.mangaPages.imageUrl })
      .from(schema.mangaPages)
      .where(and(eq(schema.mangaPages.bookId, bookId), eq(schema.mangaPages.pageNum, pageNum)))
      .get()
  }
}

export const bookRepository = new BookRepository()