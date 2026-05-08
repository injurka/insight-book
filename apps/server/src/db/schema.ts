import { relations, sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull().default('epub'),
  title: text('title').notNull(),
  author: text('author'),
  coverUrl: text('coverUrl'),
  filePath: text('filePath').notNull(),
  language: text('language').notNull().default('en'),
  totalPages: integer('totalPages').notNull().default(0),
  toc: text('toc'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
})

export const mangaPages = sqliteTable('manga_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  pageNum: integer('pageNum').notNull(),
  imageUrl: text('imageUrl').notNull(),
  imageWidth: integer('imageWidth').notNull(),
  imageHeight: integer('imageHeight').notNull(),
  ocrData: text('ocrData'),
}, t => ({
  unq: unique().on(t.bookId, t.pageNum),
}))

export const bookPages = sqliteTable('book_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  pageNum: integer('pageNum').notNull(),
  content: text('content').notNull(),
}, t => ({
  unq: unique().on(t.bookId, t.pageNum),
}))

export const readingProgress = sqliteTable('reading_progress', {
  bookId: integer('bookId').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  currentPage: integer('currentPage').notNull().default(1),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
})

export const bookStats = sqliteTable('book_stats', {
  bookId: integer('bookId').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  description: text('description'),
  difficulty: text('difficulty'),
  tags: text('tags'),
  totalChars: integer('totalChars').default(0),
  uniqueChars: integer('uniqueChars').default(0),
  posDistribution: text('posDistribution'),
  topWords: text('topWords'),
  lexicalDiversity: integer('lexicalDiversity'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const nlpCache = sqliteTable('nlp_cache', {
  bookId: integer('bookId').notNull(),
  pageNum: integer('pageNum').notNull(),
  data: text('data').notNull(),
})

export const llmCache = sqliteTable('llm_cache', {
  sentenceHash: text('sentenceHash').primaryKey(),
  language: text('language').notNull().default('en'),
  sentence: text('sentence').notNull(),
  analysis: text('analysis').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const bookLlmCache = sqliteTable('book_llm_cache', {
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  sentenceHash: text('sentenceHash').notNull().references(() => llmCache.sentenceHash, { onDelete: 'cascade' }),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, t => ({
  pk: primaryKey({ columns: [t.bookId, t.sentenceHash] }),
}))

export const ttsCache = sqliteTable('tts_cache', {
  textHash: text('textHash').primaryKey(),
  text: text('text').notNull(),
  audioBase64: text('audioBase64').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const userDictionary = sqliteTable('user_dictionary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  word: text('word').notNull().unique(),
  transcription: text('transcription'),
  translation: text('translation'),
  language: text('language').notNull().default('en'),
  notes: text('notes'),
  tags: text('tags'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
})

// ================= RELATIONS =================

export const booksRelations = relations(books, ({ one, many }) => ({
  progress: one(readingProgress, { fields: [books.id], references: [readingProgress.bookId] }),
  stats: one(bookStats, { fields: [books.id], references: [bookStats.bookId] }),
  pages: many(bookPages),
  mangaPages: many(mangaPages),
  bookLlmCache: many(bookLlmCache),
}))

export const llmCacheRelations = relations(llmCache, ({ many }) => ({
  bookLlmCache: many(bookLlmCache),
}))

export const bookLlmCacheRelations = relations(bookLlmCache, ({ one }) => ({
  book: one(books, { fields: [bookLlmCache.bookId], references: [books.id] }),
  llmCache: one(llmCache, { fields: [bookLlmCache.sentenceHash], references: [llmCache.sentenceHash] }),
}))

export const mangaPagesRelations = relations(mangaPages, ({ one }) => ({
  book: one(books, { fields: [mangaPages.bookId], references: [books.id] }),
}))

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  book: one(books, { fields: [readingProgress.bookId], references: [books.id] }),
}))

export const bookStatsRelations = relations(bookStats, ({ one }) => ({
  book: one(books, { fields: [bookStats.bookId], references: [books.id] }),
}))

export const bookPagesRelations = relations(bookPages, ({ one }) => ({
  book: one(books, { fields: [bookPages.bookId], references: [books.id] }),
}))
