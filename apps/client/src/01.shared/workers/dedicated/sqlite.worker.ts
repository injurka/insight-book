import type { Book, DictDeck, Highlight, LlmAnalysis, PagePayload, TocItem, UserDictItem } from '~/01.shared/types/models'
import type { ClientToWorkerRPC, DictionaryQueryParams, WorkerToClientRPC } from '~/01.shared/types/rpc'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { createBirpc } from 'birpc'
import { unzipSync } from 'fflate'

let db: any = null
let rpcClient: WorkerToClientRPC | null = null

// --- OPFS Media Helpers ---
async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory()
}

async function writeOpfsFile(relativePath: string, buffer: ArrayBuffer): Promise<void> {
  const root = await getOpfsRoot()
  const cleanPath = relativePath.replace(/^\/+/, '')
  const parts = cleanPath.split('/')

  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true })
  }

  const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(buffer)
  await writable.close()
}

async function readOpfsFile(relativePath: string): Promise<ArrayBuffer | null> {
  try {
    const root = await getOpfsRoot()
    const cleanPath = relativePath.replace(/^\/+/, '')
    const parts = cleanPath.split('/')

    let dir = root
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }

    const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
    const file = await fileHandle.getFile()

    return await file.arrayBuffer()
  }
  catch {
    return null
  }
}

async function deleteOpfsFile(relativePath: string): Promise<void> {
  try {
    const root = await getOpfsRoot()
    const cleanPath = relativePath.replace(/^\/+/, '')
    const parts = cleanPath.split('/')

    let dir = root
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }

    await dir.removeEntry(parts[parts.length - 1])
  }
  catch {
    // Ignore if not existing
  }
}

async function attachAndMergeDb(tempDbName: string): Promise<void> {
  db.exec(`ATTACH DATABASE '/${tempDbName}' AS remote;`)
  try {
    db.exec(`
      INSERT OR IGNORE INTO main.dictionary (
        word, transcription, translation, language, target_language, notes, tags, difficulty,
        grammar_note, vocabulary_note, deck_ids_json, state, due, stability, difficulty_fsrs,
        scheduled_days, reps, lapses, last_review, learning_steps, created_at, updated_at, raw_json
      ) SELECT
        word, transcription, translation, language, target_language, notes, tags, difficulty,
        grammar_note, vocabulary_note, deck_ids_json, state, due, stability, difficulty_fsrs,
        scheduled_days, reps, lapses, last_review, learning_steps, created_at, updated_at, raw_json
      FROM remote.dictionary;
    `)
  }
  catch (e) {
    console.warn('[SQLite Worker] Merging remote dictionary info:', e)
  }

  try {
    db.exec(`
      INSERT OR IGNORE INTO main.analyses (text_key, language, analysis_json)
      SELECT text_key, language, analysis_json FROM remote.analyses;
    `)
  }
  catch (e) {
    console.warn('[SQLite Worker] Merging remote analyses info:', e)
  }

  db.exec('DETACH DATABASE remote;')
}

function notifySyncProgress(stage: string, loaded: number, total: number): void {
  rpcClient?.onSyncProgress({ stage, loaded, total })
}

function buildAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}

  if (token)
    headers.Authorization = `Bearer ${token}`

  return headers
}

function appendCacheBustParam(url: string): string {
  const separator = url.includes('?') ? '&' : '?'

  return `${url}${separator}t=${Date.now()}`
}

async function downloadPublicDictBuffer(dbUrl: string, token?: string): Promise<ArrayBuffer> {
  const headers = buildAuthHeaders(token)
  const finalUrl = appendCacheBustParam(dbUrl)
  const res = await fetch(finalUrl, { headers, cache: 'no-store' })

  if (!res.ok) {
    throw new Error(`Failed to download database: ${res.status} ${res.statusText}`)
  }

  const contentLength = res.headers.get('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

  if (totalBytes > 0) {
    notifySyncProgress('Downloading...', 10, 100)
  }

  return await res.arrayBuffer()
}

async function unpackMediaZip(mediaZipUrl: string, token?: string): Promise<void> {
  notifySyncProgress('Downloading media package...', 75, 100)
  const headers = buildAuthHeaders(token)
  const zipRes = await fetch(mediaZipUrl, { headers })

  if (!zipRes.ok)
    return

  const zipBuffer = new Uint8Array(await zipRes.arrayBuffer())
  notifySyncProgress('Unpacking media files into OPFS...', 90, 100)
  const unzipped = unzipSync(zipBuffer)

  for (const [filename, fileData] of Object.entries(unzipped)) {
    if (!filename.endsWith('/')) {
      await writeOpfsFile(`opfs-media/tts/${filename}`, fileData.buffer as ArrayBuffer)
    }
  }
}

// --- DB Initialization ---
async function initDb(): Promise<void> {
  if (db)
    return

  const sqlite3 = await sqlite3InitModule()

  if ('opfs' in sqlite3) {
    try {
      db = new sqlite3.oo1.OpfsDb('/insight_book.sqlite', 'c')
    }
    catch (e) {
      console.warn('[SQLite Worker] Fallback to standard DB:', e)
      db = new sqlite3.oo1.DB('/insight_book.sqlite', 'c')
    }
  }
  else {
    db = new sqlite3.oo1.DB('/insight_book.sqlite', 'c')
  }

  if (db && db.pointer && sqlite3.capi && typeof sqlite3.capi.sqlite3_trace_v2 === 'function') {
    ; (sqlite3.capi.sqlite3_trace_v2 as any)(
      db.pointer,
      0,
      0,
      0,
    )
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      cover_url TEXT,
      local_cover_url TEXT,
      file_path TEXT,
      language TEXT,
      total_pages INTEGER,
      current_page INTEGER,
      created_at TEXT,
      updated_at TEXT,
      toc_json TEXT,
      stats_json TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS pages (
      book_id INTEGER,
      page_num INTEGER,
      content TEXT,
      page_dict_json TEXT,
      type TEXT,
      image_url TEXT,
      local_image_url TEXT,
      image_width INTEGER,
      image_height INTEGER,
      ocr_blocks_json TEXT,
      PRIMARY KEY (book_id, page_num)
    );

    CREATE TABLE IF NOT EXISTS dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      transcription TEXT,
      translation TEXT,
      language TEXT,
      target_language TEXT,
      notes TEXT,
      tags TEXT,
      difficulty TEXT,
      grammar_note TEXT,
      vocabulary_note TEXT,
      deck_ids_json TEXT,
      state INTEGER DEFAULT 0,
      due TEXT,
      stability REAL DEFAULT 0,
      difficulty_fsrs REAL DEFAULT 0,
      scheduled_days INTEGER DEFAULT 0,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      last_review TEXT,
      learning_steps INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
      word,
      translation,
      transcription,
      tags,
      content='dictionary',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS dictionary_ai AFTER INSERT ON dictionary BEGIN
      INSERT INTO dictionary_fts(rowid, word, translation, transcription, tags)
      VALUES (new.id, new.word, new.translation, new.transcription, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS dictionary_ad AFTER DELETE ON dictionary BEGIN
      INSERT INTO dictionary_fts(dictionary_fts, rowid, word, translation, transcription, tags)
      VALUES('delete', old.id, old.word, old.translation, old.transcription, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS dictionary_au AFTER UPDATE ON dictionary BEGIN
      INSERT INTO dictionary_fts(dictionary_fts, rowid, word, translation, transcription, tags)
      VALUES('delete', old.id, old.word, old.translation, old.transcription, old.tags);
      INSERT INTO dictionary_fts(rowid, word, translation, transcription, tags)
      VALUES (new.id, new.word, new.translation, new.transcription, new.tags);
    END;

    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      name TEXT,
      language TEXT,
      target_language TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      book_id INTEGER,
      text TEXT,
      translation TEXT,
      note TEXT,
      color TEXT,
      chapter TEXT,
      page_num INTEGER,
      analysis_data_json TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_key TEXT UNIQUE,
      language TEXT,
      analysis_json TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

function ensureValue<T>(val: T | undefined | null, fallback: unknown = null): unknown {
  return val ?? fallback
}

function getWordBindValues(w: UserDictItem, lang: string): unknown[] {
  const now = new Date().toISOString()

  return [
    ensureValue(w.id),
    w.word,
    ensureValue(w.transcription),
    ensureValue(w.translation),
    ensureValue(w.language, lang),
    ensureValue(w.targetLanguage, 'en'),
    ensureValue(w.notes),
    ensureValue(w.tags),
    ensureValue(w.difficulty),
    ensureValue(w.grammarNote),
    ensureValue(w.vocabularyNote),
    JSON.stringify(ensureValue(w.deckIds, [])),
    ensureValue(w.state, 0),
    ensureValue(w.due, now),
    ensureValue(w.stability, 0),
    ensureValue(w.difficultyFsrs, 0),
    ensureValue(w.scheduledDays, 0),
    ensureValue(w.reps, 0),
    ensureValue(w.lapses, 0),
    ensureValue(w.lastReview),
    ensureValue(w.learningSteps, 0),
    ensureValue(w.createdAt, now),
    ensureValue(w.updatedAt, now),
    JSON.stringify(w),
  ]
}

function bindWordStmt(stmt: { bind: (vals: unknown[]) => void, step: () => void, reset: () => void }, w: UserDictItem, lang: string) {
  stmt.bind(getWordBindValues(w, lang))
  stmt.step()
  stmt.reset()
}

function buildQueryParams(params: DictionaryQueryParams) {
  const conditions: string[] = []
  const sqlParams: unknown[] = []

  if (params.language) {
    conditions.push('d.language = ?')
    sqlParams.push(params.language)
  }

  if (params.deckId) {
    conditions.push('d.deck_ids_json LIKE ?')
    sqlParams.push(`%${params.deckId}%`)
  }

  if (params.state !== undefined) {
    conditions.push('d.state = ?')
    sqlParams.push(params.state)
  }

  let searchJoin = ''
  if (params.query?.trim()) {
    searchJoin = 'JOIN dictionary_fts fts ON d.id = fts.rowid'
    conditions.push('dictionary_fts MATCH ?')
    sqlParams.push(`${params.query.trim()}*`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  return { searchJoin, whereClause, sqlParams }
}

function getBookBindValues(info: Book): unknown[] {
  const now = new Date().toISOString()

  return [
    info.id,
    info.title,
    ensureValue(info.author),
    ensureValue(info.coverUrl),
    ensureValue(info.localCoverUrl),
    ensureValue(info.filePath, ''),
    ensureValue(info.language, 'ru'),
    ensureValue(info.totalPages, 0),
    ensureValue(info.currentPage),
    ensureValue(info.createdAt, now),
    ensureValue(info.updatedAt, now),
    JSON.stringify(ensureValue(info.toc, [])),
    JSON.stringify(ensureValue(info.stats, null)),
    JSON.stringify(info),
  ]
}

function getPageBindValues(p: { bookId: number, pageNum: number, payload: PagePayload }): unknown[] {
  return [
    p.bookId,
    p.pageNum,
    ensureValue(p.payload.content, ''),
    JSON.stringify(ensureValue(p.payload.pageDictionary, {})),
    ensureValue(p.payload.type, 'epub'),
    ensureValue(p.payload.imageUrl),
    ensureValue(p.payload.localImageUrl),
    ensureValue(p.payload.imageWidth),
    ensureValue(p.payload.imageHeight),
    JSON.stringify(ensureValue(p.payload.ocrBlocks, [])),
  ]
}

function getHighlightBindValues(h: Highlight, bookId: number): unknown[] {
  return [
    ensureValue(h.id),
    ensureValue(h.userId, 1),
    bookId,
    h.text,
    ensureValue(h.translation),
    ensureValue(h.note),
    ensureValue(h.color, '#ff0'),
    ensureValue(h.chapter),
    ensureValue(h.pageNum, 1),
    JSON.stringify(ensureValue(h.analysisData, null)),
    ensureValue(h.createdAt, new Date().toISOString()),
  ]
}

// --- Implementation of RPC Server Methods ---
const rpcHandlers: ClientToWorkerRPC = {
  async initDb() {
    await initDb()
  },

  async saveSetting(key: string, value: string): Promise<void> {
    await initDb()
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value;
    `)
    stmt.bind([key, value])
    stmt.step()
    stmt.finalize()
  },

  async getSetting(key: string): Promise<string | null> {
    await initDb()
    let result: string | null = null
    db.exec({
      sql: 'SELECT value FROM settings WHERE key = ?',
      bind: [key],
      callback: (row: string[]) => {
        result = row[0]
      },
    })

    return result
  },

  async deleteSetting(key: string): Promise<void> {
    await initDb()
    db.exec({ sql: 'DELETE FROM settings WHERE key = ?', bind: [key] })
  },

  async saveDictionary(words: UserDictItem[], lang = 'ru') {
    await initDb()
    db.exec('BEGIN TRANSACTION;')
    try {
      const stmt = db.prepare(`
        INSERT INTO dictionary (
          id, word, transcription, translation, language, target_language, notes, tags, difficulty,
          grammar_note, vocabulary_note, deck_ids_json, state, due, stability, difficulty_fsrs,
          scheduled_days, reps, lapses, last_review, learning_steps, created_at, updated_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          word=excluded.word, transcription=excluded.transcription, translation=excluded.translation,
          notes=excluded.notes, tags=excluded.tags, state=excluded.state, due=excluded.due,
          stability=excluded.stability, difficulty_fsrs=excluded.difficulty_fsrs,
          scheduled_days=excluded.scheduled_days, reps=excluded.reps, lapses=excluded.lapses,
          last_review=excluded.last_review, updated_at=excluded.updated_at, raw_json=excluded.raw_json;
      `)

      for (const w of words) {
        bindWordStmt(stmt, w, lang)
      }

      stmt.finalize()
      db.exec('COMMIT;')
    }
    catch (e) {
      db.exec('ROLLBACK;')
      throw e
    }
  },

  async getDictionary(params: DictionaryQueryParams = {}): Promise<{ items: UserDictItem[], total: number }> {
    await initDb()

    const { searchJoin, whereClause, sqlParams } = buildQueryParams(params)
    const countSql = `SELECT COUNT(*) as total FROM dictionary d ${searchJoin} ${whereClause}`

    let total = 0
    db.exec({
      sql: countSql,
      bind: sqlParams,
      callback: (row: (number | string)[]) => {
        total = Number(row[0])
      },
    })

    let orderClause = 'ORDER BY d.id DESC'
    if (params.sortBy) {
      const dir = params.sortOrder === 'asc' ? 'ASC' : 'DESC'
      orderClause = `ORDER BY d.${params.sortBy} ${dir}`
    }

    const limitClause = params.limit ? `LIMIT ${params.limit} OFFSET ${params.offset || 0}` : ''
    const selectSql = `SELECT d.raw_json FROM dictionary d ${searchJoin} ${whereClause} ${orderClause} ${limitClause}`

    const items: UserDictItem[] = []
    db.exec({
      sql: selectSql,
      bind: sqlParams,
      callback: (row: string[]) => {
        try {
          items.push(JSON.parse(row[0]))
        }
        catch { }
      },
    })

    return { items, total }
  },

  async getAllDictionaryWords(lang = 'ru'): Promise<UserDictItem[]> {
    await initDb()
    const items: UserDictItem[] = []
    db.exec({
      sql: 'SELECT raw_json FROM dictionary WHERE language = ? OR language IS NULL ORDER BY id DESC',
      bind: [lang],
      callback: (row: string[]) => {
        try {
          items.push(JSON.parse(row[0]))
        }
        catch { }
      },
    })

    return items
  },

  async saveDecks(decks: DictDeck[], lang = 'ru'): Promise<void> {
    await initDb()
    db.exec('BEGIN TRANSACTION;')
    try {
      const stmt = db.prepare(`
        INSERT INTO decks (id, user_id, name, language, target_language, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, language=excluded.language, target_language=excluded.target_language;
      `)
      for (const d of decks) {
        stmt.bind([d.id, d.userId, d.name, d.language || lang, d.targetLanguage || 'en', d.createdAt || new Date().toISOString()])
        stmt.step()
        stmt.reset()
      }

      stmt.finalize()
      db.exec('COMMIT;')
    }
    catch (e) {
      db.exec('ROLLBACK;')
      throw e
    }
  },

  async getDecks(lang = 'ru'): Promise<DictDeck[]> {
    await initDb()
    const decks: DictDeck[] = []
    db.exec({
      sql: 'SELECT id, user_id, name, language, target_language, created_at FROM decks WHERE language = ?',
      bind: [lang],
      callback: (row: [number, number, string, string, string, string]) => {
        decks.push({
          id: row[0],
          userId: row[1],
          name: row[2],
          language: row[3],
          targetLanguage: row[4],
          createdAt: row[5],
        })
      },
    })

    return decks
  },

  async getReviewQueue(limit = 50): Promise<UserDictItem[]> {
    await initDb()
    const items: UserDictItem[] = []
    const nowIso = new Date().toISOString()

    db.exec({
      sql: `SELECT raw_json FROM dictionary
            WHERE state IN (1, 3) OR due <= ?
            ORDER BY RANDOM() LIMIT ?`,
      bind: [nowIso, limit],
      callback: (row: string[]) => {
        try {
          items.push(JSON.parse(row[0]))
        }
        catch { }
      },
    })

    return items
  },

  async updateWordFsrs(id: number, fsrsData: Partial<UserDictItem>): Promise<void> {
    await initDb()
    const stmt = db.prepare(`
      UPDATE dictionary SET
        state = COALESCE(?, state),
        due = COALESCE(?, due),
        stability = COALESCE(?, stability),
        difficulty_fsrs = COALESCE(?, difficulty_fsrs),
        scheduled_days = COALESCE(?, scheduled_days),
        reps = COALESCE(?, reps),
        lapses = COALESCE(?, lapses),
        last_review = COALESCE(?, last_review),
        updated_at = ?
      WHERE id = ?;
    `)
    stmt.bind([
      fsrsData.state ?? null,
      fsrsData.due ?? null,
      fsrsData.stability ?? null,
      fsrsData.difficultyFsrs ?? null,
      fsrsData.scheduledDays ?? null,
      fsrsData.reps ?? null,
      fsrsData.lapses ?? null,
      fsrsData.lastReview ?? null,
      new Date().toISOString(),
      id,
    ])
    stmt.step()
    stmt.finalize()
  },

  async saveBookInfo(info: Book): Promise<void> {
    await initDb()
    const stmt = db.prepare(`
      INSERT INTO books (
        id, title, author, cover_url, local_cover_url, file_path, language, total_pages,
        current_page, created_at, updated_at, toc_json, stats_json, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, author=excluded.author, cover_url=excluded.cover_url,
        local_cover_url=excluded.local_cover_url, total_pages=excluded.total_pages,
        current_page=excluded.current_page, updated_at=excluded.updated_at,
        toc_json=excluded.toc_json, stats_json=excluded.stats_json, raw_json=excluded.raw_json;
    `)
    stmt.bind(getBookBindValues(info))
    stmt.step()
    stmt.finalize()
  },

  async getBookInfo(id: number): Promise<Book | null> {
    await initDb()
    let result: Book | null = null
    db.exec({
      sql: 'SELECT raw_json FROM books WHERE id = ?',
      bind: [id],
      callback: (row: string[]) => {
        try {
          result = JSON.parse(row[0])
        }
        catch { }
      },
    })

    return result
  },

  async saveBooksList(books: Book[]): Promise<void> {
    await initDb()
    db.exec('BEGIN TRANSACTION;')
    try {
      for (const b of books) {
        await rpcHandlers.saveBookInfo(b)
      }

      db.exec('COMMIT;')
    }
    catch (e) {
      db.exec('ROLLBACK;')
      throw e
    }
  },

  async getBooksList(): Promise<Book[]> {
    await initDb()
    const books: Book[] = []
    db.exec({
      sql: 'SELECT raw_json FROM books ORDER BY updated_at DESC',
      callback: (row: string[]) => {
        try {
          books.push(JSON.parse(row[0]))
        }
        catch { }
      },
    })

    return books
  },

  async savePage(bookId: number, pageNum: number, payload: PagePayload): Promise<void> {
    await initDb()
    const stmt = db.prepare(`
      INSERT INTO pages (
        book_id, page_num, content, page_dict_json, type, image_url, local_image_url,
        image_width, image_height, ocr_blocks_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(book_id, page_num) DO UPDATE SET
        content=excluded.content, page_dict_json=excluded.page_dict_json, type=excluded.type,
        image_url=excluded.image_url, local_image_url=excluded.local_image_url,
        image_width=excluded.image_width, image_height=excluded.image_height,
        ocr_blocks_json=excluded.ocr_blocks_json;
    `)
    stmt.bind(getPageBindValues({ bookId, pageNum, payload }))
    stmt.step()
    stmt.finalize()
  },

  async getPage(bookId: number, pageNum: number): Promise<PagePayload | null> {
    await initDb()
    let res: PagePayload | null = null
    db.exec({
      sql: 'SELECT content, page_dict_json, type, image_url, local_image_url, image_width, image_height, ocr_blocks_json FROM pages WHERE book_id = ? AND page_num = ?',
      bind: [bookId, pageNum],
      callback: (row: [string, string, string, string, string, number, number, string]) => {
        res = {
          bookId,
          pageNum,
          totalPages: 0,
          content: row[0] || '',
          pageDictionary: row[1] ? JSON.parse(row[1]) : undefined,
          type: (row[2] as any) || undefined,
          imageUrl: row[3] || undefined,
          localImageUrl: row[4] || undefined,
          imageWidth: row[5] || undefined,
          imageHeight: row[6] || undefined,
          ocrBlocks: row[7] ? JSON.parse(row[7]) : undefined,
        }
      },
    })

    return res
  },

  async savePagesBatch(pages: { bookId: number, pageNum: number, payload: PagePayload }[]): Promise<void> {
    await initDb()
    db.exec('BEGIN TRANSACTION;')
    try {
      const stmt = db.prepare(`
        INSERT INTO pages (
          book_id, page_num, content, page_dict_json, type, image_url, local_image_url,
          image_width, image_height, ocr_blocks_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(book_id, page_num) DO UPDATE SET
          content=excluded.content, page_dict_json=excluded.page_dict_json, type=excluded.type,
          image_url=excluded.image_url, local_image_url=excluded.local_image_url,
          image_width=excluded.image_width, image_height=excluded.image_height,
          ocr_blocks_json=excluded.ocr_blocks_json;
      `)

      for (const p of pages) {
        stmt.bind(getPageBindValues(p))
        stmt.step()
        stmt.reset()
      }

      stmt.finalize()
      db.exec('COMMIT;')
    }
    catch (e) {
      db.exec('ROLLBACK;')
      throw e
    }
  },

  async saveToc(bookId: number, toc: TocItem[]): Promise<void> {
    await initDb()
    const stmt = db.prepare('UPDATE books SET toc_json = ? WHERE id = ?;')
    stmt.bind([JSON.stringify(toc), bookId])
    stmt.step()
    stmt.finalize()
  },

  async getToc(bookId: number): Promise<TocItem[] | null> {
    await initDb()
    let toc: TocItem[] | null = null
    db.exec({
      sql: 'SELECT toc_json FROM books WHERE id = ?',
      bind: [bookId],
      callback: (row: string[]) => {
        if (row[0]) {
          try {
            toc = JSON.parse(row[0])
          }
          catch { }
        }
      },
    })

    return toc
  },

  async saveHighlights(bookId: number, highlights: Highlight[]): Promise<void> {
    await initDb()
    db.exec('BEGIN TRANSACTION;')
    try {
      db.exec({ sql: 'DELETE FROM highlights WHERE book_id = ?', bind: [bookId] })
      const stmt = db.prepare(`
        INSERT INTO highlights (id, user_id, book_id, text, translation, note, color, chapter, page_num, analysis_data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `)
      for (const h of highlights) {
        stmt.bind(getHighlightBindValues(h, bookId))
        stmt.step()
        stmt.reset()
      }

      stmt.finalize()
      db.exec('COMMIT;')
    }
    catch (e) {
      db.exec('ROLLBACK;')
      throw e
    }
  },

  async getHighlights(bookId: number): Promise<Highlight[] | null> {
    await initDb()
    const highlights: Highlight[] = []
    db.exec({
      sql: 'SELECT id, user_id, book_id, text, translation, note, color, chapter, page_num, analysis_data_json, created_at FROM highlights WHERE book_id = ?',
      bind: [bookId],
      callback: (row: [number, number, number, string, string, string, string, string, number, string, string]) => {
        highlights.push({
          id: row[0],
          userId: row[1],
          bookId: row[2],
          text: row[3],
          translation: row[4],
          note: row[5],
          color: row[6],
          chapter: row[7],
          pageNum: row[8],
          analysisData: row[9] ? JSON.parse(row[9]) : undefined,
          createdAt: row[10],
        })
      },
    })

    return highlights
  },

  async saveAnalysis(text: string, analysis: LlmAnalysis, lang = 'ru'): Promise<void> {
    await initDb()
    const textKey = `${lang}_${text.trim().toLowerCase()}`
    const stmt = db.prepare(`
      INSERT INTO analyses (text_key, language, analysis_json)
      VALUES (?, ?, ?)
      ON CONFLICT(text_key) DO UPDATE SET analysis_json=excluded.analysis_json;
    `)
    stmt.bind([textKey, lang, JSON.stringify(analysis)])
    stmt.step()
    stmt.finalize()
  },

  async getAnalysis(text: string, lang = 'ru'): Promise<LlmAnalysis | null> {
    await initDb()
    const textKey = `${lang}_${text.trim().toLowerCase()}`
    let analysis: LlmAnalysis | null = null
    db.exec({
      sql: 'SELECT analysis_json FROM analyses WHERE text_key = ?',
      bind: [textKey],
      callback: (row: string[]) => {
        try {
          analysis = JSON.parse(row[0])
        }
        catch { }
      },
    })

    return analysis
  },

  async saveMedia(path: string, buffer: ArrayBuffer, _mimeType: string): Promise<void> {
    await writeOpfsFile(path, buffer)
  },

  async getMedia(path: string): Promise<{ buffer: ArrayBuffer, mimeType: string } | null> {
    const buffer = await readOpfsFile(path)
    if (!buffer)
      return null
    const ext = path.split('.').pop()?.toLowerCase() || ''
    let mimeType = 'application/octet-stream'
    if (ext === 'jpg' || ext === 'jpeg')
      mimeType = 'image/jpeg'
    else if (ext === 'png')
      mimeType = 'image/png'
    else if (ext === 'webp')
      mimeType = 'image/webp'
    else if (ext === 'mp3')
      mimeType = 'audio/mp3'
    else if (ext === 'wav')
      mimeType = 'audio/wav'

    return { buffer, mimeType }
  },

  async deleteMedia(path: string): Promise<void> {
    await deleteOpfsFile(path)
  },

  async downloadAndAttachPublicDict(dbUrl: string, mediaZipUrl?: string, token?: string): Promise<void> {
    await initDb()

    notifySyncProgress('Downloading public LLM cache database...', 0, 100)

    const arrayBuffer = await downloadPublicDictBuffer(dbUrl, token)

    notifySyncProgress('Saving database to OPFS...', 90, 100)

    const tempDbName = `public_dict_${Date.now()}_${Math.random().toString(36).substring(7)}.sqlite`
    await writeOpfsFile(tempDbName, arrayBuffer)

    notifySyncProgress('Attaching & merging LLM cache database...', 95, 100)
    await attachAndMergeDb(tempDbName)

    await deleteOpfsFile(tempDbName)

    if (mediaZipUrl) {
      await unpackMediaZip(mediaZipUrl, token)
    }

    notifySyncProgress('Completed', 100, 100)
  },

  async getStorageStats() {
    await initDb()

    const books = await rpcHandlers.getBooksList()
    const bookStats: Record<number, { title: string, totalPages: number, cachedPages: number[], analysesCount: number, sizeBytes: number, imagesCount: number, ttsCount: number, dictPagesCount: number }> = {}

    for (const b of books) {
      let cachedPagesCount = 0
      db.exec({
        sql: 'SELECT COUNT(*) FROM pages WHERE book_id = ?',
        bind: [b.id],
        callback: (row: (number | string)[]) => {
          cachedPagesCount = Number(row[0])
        },
      })

      bookStats[b.id] = {
        title: b.title,
        totalPages: b.totalPages || 0,
        cachedPages: Array.from({ length: cachedPagesCount }, (_, i) => i + 1),
        analysesCount: b.analysesCount || 0,
        sizeBytes: 0,
        imagesCount: 0,
        ttsCount: 0,
        dictPagesCount: 0,
      }
    }

    let totalDictionaryWords = 0
    db.exec({
      sql: 'SELECT COUNT(*) FROM dictionary',
      callback: (row: (number | string)[]) => {
        totalDictionaryWords = Number(row[0])
      },
    })

    const languageStats: Record<string, { analysesCount: number, dictionaryWords: number, sizeBytes: number }> = {}

    try {
      db.exec({
        sql: 'SELECT language, COUNT(*), SUM(length(analysis_json) + length(text_key)) FROM analyses GROUP BY language',
        callback: (row: (number | string)[]) => {
          const lang = String(row[0])
          if (!languageStats[lang])
            languageStats[lang] = { analysesCount: 0, dictionaryWords: 0, sizeBytes: 0 }
          languageStats[lang].analysesCount = Number(row[1])
          languageStats[lang].sizeBytes += Number(row[2]) || 0
        },
      })
    }
    catch { }

    try {
      db.exec({
        sql: 'SELECT language, COUNT(*), SUM(length(word) + length(translation) + length(raw_json)) FROM dictionary GROUP BY language',
        callback: (row: (number | string)[]) => {
          const lang = String(row[0])
          if (!languageStats[lang])
            languageStats[lang] = { analysesCount: 0, dictionaryWords: 0, sizeBytes: 0 }
          languageStats[lang].dictionaryWords = Number(row[1])
          languageStats[lang].sizeBytes += Number(row[2]) || 0
        },
      })
    }
    catch { }

    let totalSizeBytes = 0
    try {
      const root = await navigator.storage.getDirectory()
      const dbFile = await root.getFileHandle('insight_book.sqlite')
      const file = await dbFile.getFile()
      totalSizeBytes = file.size
    }
    catch {
      const estimate = await navigator.storage.estimate()
      totalSizeBytes = estimate.usage || 0
    }

    return { bookStats, totalDictionaryWords, totalSizeBytes, languageStats }
  },

  async deleteLanguage(lang: string): Promise<void> {
    await initDb()
    try {
      db.exec({ sql: 'DELETE FROM analyses WHERE language = ?', bind: [lang] })
      db.exec({ sql: 'DELETE FROM dictionary WHERE language = ?', bind: [lang] })
      db.exec('VACUUM')
    }
    catch (e) {
      console.error('[SQLite Worker] Failed to delete language:', e)
    }
  },

  async clearBookCache(bookId: number): Promise<void> {
    await initDb()
    db.exec({ sql: 'DELETE FROM pages WHERE book_id = ?', bind: [bookId] })
    db.exec({ sql: 'DELETE FROM books WHERE id = ?', bind: [bookId] })
    db.exec({ sql: 'DELETE FROM highlights WHERE book_id = ?', bind: [bookId] })

    try {
      const root = await getOpfsRoot()
      const mediaDir = await root.getDirectoryHandle('opfs-media', { create: false })
      const mangaDir = await mediaDir.getDirectoryHandle('manga', { create: false })
      await mangaDir.removeEntry(`${bookId}`, { recursive: true })
    }
    catch { }
  },

  async clearAllData(): Promise<void> {
    await initDb()
    db.exec('DELETE FROM dictionary;')
    db.exec('DELETE FROM dictionary_fts;')
    db.exec('DELETE FROM books;')
    db.exec('DELETE FROM pages;')
    db.exec('DELETE FROM decks;')
    db.exec('DELETE FROM highlights;')
    db.exec('DELETE FROM analyses;')

    try {
      const root = await getOpfsRoot()
      const mediaDir = await root.getDirectoryHandle('opfs-media', { create: false })
      await mediaDir.removeEntry('manga', { recursive: true })
      await mediaDir.removeEntry('tts', { recursive: true })
      await mediaDir.removeEntry('covers', { recursive: true })
    }
    catch { }
  },
}

// Setup birpc
rpcClient = createBirpc<WorkerToClientRPC, ClientToWorkerRPC>(rpcHandlers, {
  post: data => globalThis.postMessage(data),
  on: cb => globalThis.addEventListener('message', (e) => {
    if (e.data && typeof e.data === 'object' && !('type' in e.data && e.data.type === 'SERVICE_WORKER')) {
      cb(e.data)
    }
  }),
})
