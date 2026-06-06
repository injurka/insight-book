import { Database } from 'bun:sqlite'
import { DB_PATH } from '../config'

const db = new Database(DB_PATH)

console.log('🔄 Начинаем миграцию словарей на мульти-язычность...')

try {
  db.run('BEGIN TRANSACTION')

  // 1. Добавляем колонку в dict_decks если её нет
  try {
    db.run(`ALTER TABLE dict_decks ADD COLUMN targetLanguage text NOT NULL DEFAULT 'ru'`)
    console.log('✅ Колонка targetLanguage добавлена в dict_decks')
  }
  catch (e: any) {
    if (!e.message.includes('duplicate column name'))
      throw e
  }

  // 2. Пересоздаем user_dictionary для обновления UNIQUE констрейнта
  db.run(`
    CREATE TABLE IF NOT EXISTS user_dictionary_new (
      id integer PRIMARY KEY AUTOINCREMENT,
      userId integer NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
      deckId integer REFERENCES dict_decks(id) ON DELETE SET NULL,
      word text NOT NULL,
      transcription text,
      translation text,
      language text NOT NULL DEFAULT 'en',
      targetLanguage text NOT NULL DEFAULT 'ru',
      notes text,
      tags text,
      difficulty text,
      grammarNote text,
      vocabularyNote text,
      status integer NOT NULL DEFAULT 0,
      repetitions integer NOT NULL DEFAULT 0,
      interval real NOT NULL DEFAULT 0,
      easeFactor real NOT NULL DEFAULT 2.5,
      nextReviewDate text NOT NULL DEFAULT (datetime('now')),
      createdAt text NOT NULL DEFAULT (datetime('now')),
      updatedAt text NOT NULL DEFAULT (datetime('now')),
      UNIQUE(userId, word, targetLanguage)
    )
  `)

  db.run(`
    INSERT INTO user_dictionary_new (
      id, userId, deckId, word, transcription, translation, language, targetLanguage,
      notes, tags, difficulty, grammarNote, vocabularyNote, status, repetitions, 
      interval, easeFactor, nextReviewDate, createdAt, updatedAt
    )
    SELECT 
      id, userId, deckId, word, transcription, translation, language, 'ru',
      notes, tags, difficulty, grammarNote, vocabularyNote, status, repetitions, 
      interval, easeFactor, nextReviewDate, createdAt, updatedAt
    FROM user_dictionary
  `)

  db.run(`DROP TABLE user_dictionary`)
  db.run(`ALTER TABLE user_dictionary_new RENAME TO user_dictionary`)

  console.log('✅ Таблица user_dictionary успешно мигрирована')

  db.run('COMMIT')
  console.log('🎉 Миграция успешно завершена!')
}
catch (e) {
  db.run('ROLLBACK')
  console.error('❌ Ошибка миграции:', e)
}
finally {
  db.close()
}
