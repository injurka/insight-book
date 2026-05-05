/* eslint-disable no-console */
import * as fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { db } from './db'

const INPUT_FILE = path.resolve(process.cwd(), 'data', 'warodai.txt')
const BATCH_SIZE = 10000

interface DictEntry {
  $word: string
  $transcription: string | null
  $translation: string
}

/**
 * Строка является заголовком словарной статьи если содержит 〔...〕.
 * Например:
 *   ノー・ブレ(но:-бурэ)〔001-68-06〕
 *   ハイナン【海南】(Хайнан) [геогр.]〔004-37-32〕
 *   アゾレスしょとう【アゾレス諸島】(Адзорэсу-сёто:) [геогр.]〔002-16-83〕
 */
function isHeaderLine(line: string): boolean {
  return /〔[^〕]+〕/.test(line)
}

/**
 * Парсит заголовочную строку словарной статьи.
 */
function parseHeaderLine(line: string): {
  word: string
  transcription: string | null
  kanji: string | null
  corpusTag: string | null
} | null {
  // Убираем ID 〔...〕 — он нам нужен только как маркер, в БД не хранится
  const withoutId = line.replace(/〔[^〕]+〕/, '').trim()

  // Код корпуса: [геогр.], [г. Токио], [мера длины] и т.д.
  const corpusTagMatch = withoutId.match(/\[([^\]]+)\]/)
  const corpusTag = corpusTagMatch ? corpusTagMatch[1].trim() : null
  const withoutCorpus = withoutId.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()

  // Транскрипция — последний блок (...) в строке
  const transcriptionMatch = withoutCorpus.match(/\(([^)]+)\)\s*$/)
  const transcription = transcriptionMatch ? transcriptionMatch[1].trim() : null
  const withoutTranscription = transcriptionMatch
    ? withoutCorpus.slice(0, transcriptionMatch.index).trim()
    : withoutCorpus

  // Кандзи из 【...】
  const kanjiMatch = withoutTranscription.match(/【([^】]+)】/)
  const kanji = kanjiMatch ? kanjiMatch[1].trim() : null
  const word = withoutTranscription.replace(/【[^】]+】/, '').trim()

  if (!word)
    return null

  return { word, transcription, kanji, corpusTag }
}

/**
 * Кандзи и тег корпуса упаковываются в HTML-теги в начало translation.
 * Тело перевода уже нативный HTML (<i>, <a href="...">).
 */
function buildTranslation(rawLines: string[], kanji: string | null, corpusTag: string | null): string {
  const parts: string[] = []

  if (kanji)
    parts.push(`<span class="dict-kanji">${kanji}</span>`)

  if (corpusTag)
    parts.push(`<span class="dict-corpus">${corpusTag}</span>`)

  const body = rawLines
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

  if (body)
    parts.push(body)

  return parts.join(' ')
}

async function importDictionary() {
  console.log('Начинаем импорт японского словаря...')

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO words (word, transcription, translation)
    VALUES ($word, $transcription, $translation)
  `)

  const insertMany = db.transaction((entries: DictEntry[]) => {
    for (const entry of entries)
      insertStmt.run(entry)
    return entries.length
  })

  console.log(`Читаем файл: ${INPUT_FILE}`)
  const fileStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf16le' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let buffer: string[] = []
  let entriesBatch: DictEntry[] = []
  let totalInserted = 0
  // Пропускаем всё до первой строки с 〔...〕 (заголовочный блок файла)
  let reachedDict = false

  for await (const line of rl) {
    // Пропуск заголовочного блока словаря (строки с *, пустые и т.д.)
    if (!reachedDict) {
      if (isHeaderLine(line))
        reachedDict = true
      else
        continue
    }

    if (line.trim() === '') {
      if (buffer.length >= 1)
        processBuffer(buffer, entriesBatch)

      if (entriesBatch.length >= BATCH_SIZE) {
        totalInserted += insertMany(entriesBatch)
        console.log(`Добавлено записей: ${totalInserted}...`)
        entriesBatch = []
      }
      buffer = []
    }
    else {
      buffer.push(line)
    }
  }

  // Последняя запись без финальной пустой строки
  if (buffer.length >= 1)
    processBuffer(buffer, entriesBatch)

  if (entriesBatch.length > 0)
    totalInserted += insertMany(entriesBatch)

  console.log(`\n✅ Готово! Всего добавлено записей: ${totalInserted}.`)
  db.close()
}

function processBuffer(buffer: string[], targetArray: DictEntry[]) {
  // Первая строка буфера должна быть заголовком (содержать 〔...〕)
  // Если нет — это продолжение предыдущей статьи или мусор, пропускаем
  if (!isHeaderLine(buffer[0])) {
    console.warn('⚠️  Пропускаем строку без ID:', buffer[0])
    return
  }

  const parsed = parseHeaderLine(buffer[0])
  if (!parsed) {
    console.warn('⚠️  Не удалось разобрать заголовок:', buffer[0])
    return
  }

  const { word, transcription, kanji, corpusTag } = parsed
  const translation = buildTranslation(buffer.slice(1), kanji, corpusTag)

  targetArray.push({
    $word: word,
    $transcription: transcription,
    $translation: translation,
  })
}

importDictionary().catch((error) => {
  console.error('Произошла ошибка во время импорта:', error)
  db.close()
  process.exit(1)
})
