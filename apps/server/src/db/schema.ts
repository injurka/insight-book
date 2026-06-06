import { relations, sql } from 'drizzle-orm'
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

export const dumpLogs = sqliteTable('dump_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prefix: text('prefix').notNull(),
  status: text('status').notNull().default('in-progress'),
  error: text('error'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completedAt'),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const opdsCatalogs = sqliteTable('opds_catalogs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).default(1),
  type: text('type').notNull().default('epub'),
  title: text('title').notNull(),
  author: text('author'),
  coverUrl: text('coverUrl'),
  filePath: text('filePath').notNull(),
  language: text('language').notNull().default('en'),
  totalPages: integer('totalPages').notNull().default(0),
  toc: text('toc'),
  series: text('series'),
  seriesNumber: integer('seriesNumber'),

  status: text('status').notNull().default('reading'),
  isFavorite: integer('isFavorite', { mode: 'boolean' }).notNull().default(sql`0`),
  collection: text('collection'),
  isPublic: integer('isPublic', { mode: 'boolean' }).notNull().default(sql`0`),

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
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).default(1),
  currentPage: integer('currentPage').notNull().default(1),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, t => ({
  pk: primaryKey({ columns: [t.bookId, t.userId] }),
}))

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

export const dictDecks = sqliteTable('dict_decks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  language: text('language').notNull().default('en'),
  targetLanguage: text('targetLanguage').notNull().default('ru'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const userDictionary = sqliteTable('user_dictionary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).default(1),
  deckId: integer('deckId').references(() => dictDecks.id, { onDelete: 'set null' }),
  word: text('word').notNull(),
  transcription: text('transcription'),
  translation: text('translation'),
  language: text('language').notNull().default('en'),
  targetLanguage: text('targetLanguage').notNull().default('ru'),
  notes: text('notes'),
  tags: text('tags'),
  difficulty: text('difficulty'),
  grammarNote: text('grammarNote'),
  vocabularyNote: text('vocabularyNote'),

  status: integer('status').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  interval: real('interval').notNull().default(0),
  easeFactor: real('easeFactor').notNull().default(2.5),
  nextReviewDate: text('nextReviewDate').notNull().default(sql`(datetime('now'))`),

  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, t => ({
  unq: unique().on(t.userId, t.word, t.targetLanguage),
}))

export const wordEncounters = sqliteTable('word_encounters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId: integer('wordId').notNull().references(() => userDictionary.id, { onDelete: 'cascade' }),
  bookId: integer('bookId').references(() => books.id, { onDelete: 'set null' }),
  sentence: text('sentence').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, t => ({
  unq: unique().on(t.wordId, t.sentence),
}))

export const usersRelations = relations(users, ({ many }) => ({
  books: many(books),
  dictionary: many(userDictionary),
  decks: many(dictDecks),
  activity: many(dailyActivity),
  progresses: many(readingProgress),
  opdsCatalogs: many(opdsCatalogs),
}))

export const dictDecksRelations = relations(dictDecks, ({ one, many }) => ({
  user: one(users, { fields: [dictDecks.userId], references: [users.id] }),
  words: many(userDictionary),
}))

export const wordEncountersRelations = relations(wordEncounters, ({ one }) => ({
  word: one(userDictionary, { fields: [wordEncounters.wordId], references: [userDictionary.id] }),
  book: one(books, { fields: [wordEncounters.bookId], references: [books.id] }),
}))

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  book: one(books, { fields: [readingProgress.bookId], references: [books.id] }),
  user: one(users, { fields: [readingProgress.userId], references: [users.id] }),
}))

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, { fields: [books.userId], references: [users.id] }),
  progresses: many(readingProgress),
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

export const bookStatsRelations = relations(bookStats, ({ one }) => ({
  book: one(books, { fields: [bookStats.bookId], references: [books.id] }),
}))

export const bookPagesRelations = relations(bookPages, ({ one }) => ({
  book: one(books, { fields: [bookPages.bookId], references: [books.id] }),
}))

export const userDictionaryRelations = relations(userDictionary, ({ one, many }) => ({
  user: one(users, { fields: [userDictionary.userId], references: [users.id] }),
  deck: one(dictDecks, { fields: [userDictionary.deckId], references: [dictDecks.id] }),
  encounters: many(wordEncounters),
}))

export const dailyActivity = sqliteTable('daily_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  wordsAdded: integer('wordsAdded').notNull().default(0),
  wordsReviewed: integer('wordsReviewed').notNull().default(0),
  pagesRead: integer('pagesRead').notNull().default(0),
}, t => ({
  unq: unique().on(t.userId, t.date),
}))

export const dailyActivityRelations = relations(dailyActivity, ({ one }) => ({
  user: one(users, { fields: [dailyActivity.userId], references: [users.id] }),
}))
