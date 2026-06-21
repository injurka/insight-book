import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const officialDecks = sqliteTable('official_decks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  language: text('language').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: text('difficulty'),
  tags: text('tags'),
  wordCount: integer('wordCount').default(0),
})

export const officialDeckWords = sqliteTable('official_deck_words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deckId: integer('deckId').references(() => officialDecks.id),
  word: text('word').notNull(),
  difficulty: text('difficulty'),
  tags: text('tags'),
  transcription: text('transcription'),
  translation: text('translation'),
  grammarNote: text('grammarNote'),
  vocabularyNote: text('vocabularyNote'),
}, table => ({
  deckIdIdx: index('idx_official_deck_words_deck_id').on(table.deckId),
}))

export const officialDecksRelations = relations(officialDecks, ({ many }) => ({
  words: many(officialDeckWords),
}))

export const officialDeckWordsRelations = relations(officialDeckWords, ({ one }) => ({
  deck: one(officialDecks, { fields: [officialDeckWords.deckId], references: [officialDecks.id] }),
}))
