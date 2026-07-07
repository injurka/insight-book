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
  role: text('role').notNull().default('user'),

  // Лимиты
  tokenLimit: integer('tokenLimit').default(100000),
  bookLimit: integer('bookLimit').default(3),
  usedTokens: integer('usedTokens').notNull().default(0),
  periodStart: text('periodStart').notNull().default(sql`(datetime('now'))`),

  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),

  // PUSH-уведомления
  pushTargetDeckId: integer('pushTargetDeckId'),
  pushTimeStart: text('pushTimeStart').notNull().default('10:00'),
  pushTimeEnd: text('pushTimeEnd').notNull().default('21:00'),
  pushCount: integer('pushCount').notNull().default(1),
  timezone: text('timezone').notNull().default('UTC'),
  uiLanguage: text('uiLanguage').notNull().default('ru'),
  lastPushSentAt: text('lastPushSentAt'),
  avatarUrl: text('avatarUrl'),

  // Auth
  email: text('email').unique(),
  yandexId: text('yandexId').unique(),
})

export const emailConfirmations = sqliteTable('email_confirmations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  code: text('code').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const limitHistory = sqliteTable('limit_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodStart: text('periodStart').notNull(),
  periodEnd: text('periodEnd').notNull(),
  usedTokens: integer('usedTokens').notNull().default(0),
  usedBooks: integer('usedBooks').notNull().default(0),
})

export const tokenUsage = sqliteTable('token_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  action: text('action').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('inputTokens').notNull().default(0),
  outputTokens: integer('outputTokens').notNull().default(0),
}, t => [
  unique().on(t.userId, t.date, t.action, t.model),
])

export const llmLogs = sqliteTable('llm_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('inputTokens').notNull().default(0),
  outputTokens: integer('outputTokens').notNull().default(0),
  inputText: text('inputText'),
  outputText: text('outputText'),
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

  isPublic: integer('isPublic', { mode: 'boolean' }).notNull().default(sql`0`),
  isUnlisted: integer('isUnlisted', { mode: 'boolean' }).notNull().default(sql`0`),
  publicStatus: text('publicStatus').notNull().default('private'),
  textDirection: text('textDirection'),

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
}, t => [
  unique().on(t.bookId, t.pageNum),
])

export const bookPages = sqliteTable('book_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  pageNum: integer('pageNum').notNull(),
  content: text('content').notNull(),
}, t => [
  unique().on(t.bookId, t.pageNum),
])

export const readingProgress = sqliteTable('reading_progress', {
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).default(1),
  currentPage: integer('currentPage').notNull().default(1),
  status: text('status').notNull().default('reading'),
  isFavorite: integer('isFavorite', { mode: 'boolean' }).notNull().default(sql`0`),
  collection: text('collection'),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, t => [
  primaryKey({ columns: [t.bookId, t.userId] }),
])

export const bookStats = sqliteTable('book_stats', {
  bookId: integer('bookId').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  description: text('description'),
  difficulty: text('difficulty'),
  tags: text('tags'),
  totalChars: integer('totalChars').default(0),
  uniqueChars: integer('uniqueChars').default(0),
  totalSentences: integer('totalSentences').default(0),
  totalWords: integer('totalWords').default(0),
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
  targetLanguage: text('targetLanguage').notNull().default('ru'),

  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const bookLlmCache = sqliteTable('book_llm_cache', {
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  sentenceHash: text('sentenceHash').notNull().references(() => llmCache.sentenceHash, { onDelete: 'cascade' }),
  type: text('type').notNull().default('sentence'),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, t => [
  primaryKey({ columns: [t.bookId, t.sentenceHash] }),
])

export const ttsCache = sqliteTable('tts_cache', {
  textHash: text('textHash').primaryKey(),
  text: text('text').notNull(),
  audioBase64: text('audioBase64').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const bookTtsCache = sqliteTable('book_tts_cache', {
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  textHash: text('textHash').notNull().references(() => ttsCache.textHash, { onDelete: 'cascade' }),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, t => [
  primaryKey({ columns: [t.bookId, t.textHash] }),
])

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

  // FSRS Fields
  state: integer('state').notNull().default(0), // 0: New, 1: Learning, 2: Review, 3: Relearning
  due: text('due').notNull().default(sql`(datetime('now'))`),
  stability: real('stability').notNull().default(0),
  difficultyFsrs: real('difficultyFsrs').notNull().default(0),
  scheduledDays: integer('scheduledDays').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  lastReview: text('lastReview'),
  learningSteps: integer('learningSteps').notNull().default(0),

  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, t => [
  unique().on(t.userId, t.word, t.targetLanguage),
])

export const wordToDeck = sqliteTable('word_to_deck', {
  wordId: integer('wordId').notNull().references(() => userDictionary.id, { onDelete: 'cascade' }),
  deckId: integer('deckId').notNull().references(() => dictDecks.id, { onDelete: 'cascade' }),
}, t => [
  primaryKey({ columns: [t.wordId, t.deckId] }),
])

export const wordEncounters = sqliteTable('word_encounters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId: integer('wordId').notNull().references(() => userDictionary.id, { onDelete: 'cascade' }),
  bookId: integer('bookId').references(() => books.id, { onDelete: 'set null' }),
  sentence: text('sentence').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, t => [
  unique().on(t.wordId, t.sentence),
])

export const dailyActivity = sqliteTable('daily_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  wordsAdded: integer('wordsAdded').notNull().default(0),
  wordsReviewed: integer('wordsReviewed').notNull().default(0),
  pagesRead: integer('pagesRead').notNull().default(0),
}, t => [
  unique().on(t.userId, t.date),
])

export const webPushSubscriptions = sqliteTable('web_push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keys: text('keys').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const webPushSubscriptionsRelations = relations(webPushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [webPushSubscriptions.userId], references: [users.id] }),
}))

export const fcmSubscriptions = sqliteTable('fcm_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const fcmSubscriptionsRelations = relations(fcmSubscriptions, ({ one }) => ({
  user: one(users, { fields: [fcmSubscriptions.userId], references: [users.id] }),
}))

export const highlights = sqliteTable('highlights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: integer('bookId').notNull().references(() => books.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  translation: text('translation'),
  note: text('note'),
  color: text('color').notNull().default('#fde047'),
  chapter: text('chapter'),
  pageNum: integer('pageNum').notNull(),
  analysisData: text('analysisData', { mode: 'json' }),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

export const customPrompts = sqliteTable('custom_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
})

export const usersRelations = relations(users, ({ many }) => ({
  books: many(books),
  dictionary: many(userDictionary),
  decks: many(dictDecks),
  activity: many(dailyActivity),
  progresses: many(readingProgress),

  tokenUsages: many(tokenUsage),
  llmLogs: many(llmLogs),
  highlights: many(highlights),
  customPrompts: many(customPrompts),
}))

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  user: one(users, { fields: [tokenUsage.userId], references: [users.id] }),
}))

export const llmLogsRelations = relations(llmLogs, ({ one }) => ({
  user: one(users, { fields: [llmLogs.userId], references: [users.id] }),
}))

export const dictDecksRelations = relations(dictDecks, ({ one, many }) => ({
  user: one(users, { fields: [dictDecks.userId], references: [users.id] }),
  words: many(userDictionary),
  wordToDecks: many(wordToDeck),
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
  bookTtsCache: many(bookTtsCache),
  highlights: many(highlights),
}))

export const llmCacheRelations = relations(llmCache, ({ many }) => ({
  bookLlmCache: many(bookLlmCache),
}))

export const bookLlmCacheRelations = relations(bookLlmCache, ({ one }) => ({
  book: one(books, { fields: [bookLlmCache.bookId], references: [books.id] }),
  llmCache: one(llmCache, { fields: [bookLlmCache.sentenceHash], references: [llmCache.sentenceHash] }),
}))

export const ttsCacheRelations = relations(ttsCache, ({ many }) => ({
  bookTtsCache: many(bookTtsCache),
}))

export const bookTtsCacheRelations = relations(bookTtsCache, ({ one }) => ({
  book: one(books, { fields: [bookTtsCache.bookId], references: [books.id] }),
  ttsCache: one(ttsCache, { fields: [bookTtsCache.textHash], references: [ttsCache.textHash] }),
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
  wordToDecks: many(wordToDeck),
  encounters: many(wordEncounters),
}))

export const wordToDeckRelations = relations(wordToDeck, ({ one }) => ({
  word: one(userDictionary, { fields: [wordToDeck.wordId], references: [userDictionary.id] }),
  deck: one(dictDecks, { fields: [wordToDeck.deckId], references: [dictDecks.id] }),
}))

export const dailyActivityRelations = relations(dailyActivity, ({ one }) => ({
  user: one(users, { fields: [dailyActivity.userId], references: [users.id] }),
}))

export const highlightsRelations = relations(highlights, ({ one }) => ({
  user: one(users, { fields: [highlights.userId], references: [users.id] }),
  book: one(books, { fields: [highlights.bookId], references: [books.id] }),
}))

export const customPromptsRelations = relations(customPrompts, ({ one }) => ({
  user: one(users, { fields: [customPrompts.userId], references: [users.id] }),
}))
