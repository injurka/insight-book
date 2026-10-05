import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { blob, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'

const legacyTts = sqliteTable('tts_cache', {
  textHash: text('textHash').primaryKey(),
  text: text('text').notNull(),
  audioBlob: blob('audioBlob', { mode: 'buffer' }).notNull(),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
})

test('TTS metadata migration preserves audio and links; model deletion remains selective', async () => {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite)
  try {
    db.run(sql`PRAGMA foreign_keys = ON`)
    const folder = new URL('./migrations/', import.meta.url).pathname
    const latest = '0036_superb_lockjaw.sql'
    const files = [...new Bun.Glob('*.sql').scanSync(folder)].filter(file => file < latest).sort()
    async function applyFile(file: string) {
      const source = await Bun.file(`${folder}/${file}`).text()
      for (const statement of source.split('--> statement-breakpoint')) {
        if (statement.trim())
          db.run(sql.raw(statement))
      }
    }
    for (const file of files)
      await applyFile(file)

    const audio = Buffer.from([0xFF, 0xFB, 0x90, 0x64])
    db.insert(schema.users).values({ id: 1, username: 'tts-test', passwordHash: 'test' }).run()
    db.insert(schema.books).values({ id: 1, userId: 1, title: 'Test', filePath: 'test.epub' }).run()
    db.insert(legacyTts).values({ textHash: 'old', text: 'Hello.', audioBlob: audio }).run()
    db.insert(schema.bookTtsCache).values({ bookId: 1, textHash: 'old' }).run()
    await applyFile(latest)

    const old = db.select().from(schema.ttsCache).get()!
    expect(old).toMatchObject({ model: 'unknown', provider: 'unknown', voice: 'unknown', textHash: 'old' })
    expect(Buffer.from(old.audioBlob)).toEqual(audio)
    expect(db.select().from(schema.bookTtsCache).all()).toHaveLength(1)

    db.insert(schema.ttsCache).values({ textHash: 'new', text: 'New.', model: 'gemini-3.8-flash-tts', audioBlob: audio }).run()
    db.insert(schema.bookTtsCache).values({ bookId: 1, textHash: 'new' }).run()
    db.delete(schema.ttsCache).where(eq(schema.ttsCache.model, 'gemini-3.8-flash-tts')).run()
    expect(db.select().from(schema.ttsCache).all().map(row => row.textHash)).toEqual(['old'])
    expect(db.select().from(schema.bookTtsCache).all().map(row => row.textHash)).toEqual(['old'])
  }
  finally {
    sqlite.close()
  }
})
