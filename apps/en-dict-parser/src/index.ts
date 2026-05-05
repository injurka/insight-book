/* eslint-disable no-console */
import * as fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { db } from './db'

// Все .dict файлы парсятся последовательно в одну БД
const DICT_FILES = [
  'mueller-base.dict',
  'mueller-abbrev.dict',
  'mueller-geo.dict',
  'mueller-names.dict',
  'mueller-dict.dict',
]

const DATA_DIR = path.resolve(process.cwd(), 'data')
const BATCH_SIZE = 5000

interface DictEntry {
  $word: string
  $transcription: string | null
  $translation: string
}

/**
 * Форматирует тело перевода:
 * - Убирает DSL-разметку вида _n., _v., _a., _разг. и т.д. → <span class="dict-label">n.</span>
 * - Нумерованные значения 1) 2) 3) остаются как есть (уже читаемо)
 * - *) спецпометы → <span class="dict-note">...</span>
 */
function formatTranslation(lines: string[]): string {
  return lines
    .map(line => line
      // Спецпометы *) → отдельный тег
      .replace(/^\s*\*\)\s*/, '<span class="dict-note">◆ </span>')
      // _слово → стилистические/грамматические пометы
      .replace(/_([а-яёa-z.:]+)/gi, '<span class="dict-label">$1</span>')
      .trimEnd(),
    )
    .filter(line => line.trim() !== '')
    .join('\n')
    .trim()
}

/**
 * Извлекает транскрипцию из первой строки тела.
 * Варианты:
 *   "  [kɔz] _уст. = because"          → "[kɔz]"
 *   "  [ˈʧelɪst] _n. виолончелист"     → "[ˈʧelɪst]"
 *   "  _n. (_pl. Baalim)"               → null (нет транскрипции)
 *   "  _n."                             → null
 *   "  1. _a. австралийский"            → null (многозначная, без общей транскр.)
 *
 * Иногда несколько транскрипций через ; или (полная форма)/(редуцированная):
 *   "[twɔz] (полная форма); [twəz] ..."  → берём первую
 */
function extractTranscription(firstBodyLine: string): {
  transcription: string | null
  rest: string
} {
  const match = firstBodyLine.trimStart().match(/^(\[[^\]]+\])\s*(.*)$/)
  if (!match) {
    return { transcription: null, rest: firstBodyLine }
  }
  return {
    transcription: match[1],
    rest: match[2],
  }
}

function processBuffer(
  word: string,
  bodyLines: string[],
  targetArray: DictEntry[],
) {
  // Пропускаем служебные записи DICT-формата
  if (word.startsWith('00-database') || word.startsWith('0database'))
    return

  const nonEmptyLines = bodyLines.map(l => l.trimEnd()).filter(Boolean)
  if (nonEmptyLines.length === 0)
    return

  const { transcription, rest } = extractTranscription(nonEmptyLines[0])

  // Пересобираем тело: первая строка без транскрипции + остальные
  const bodyForFormat = rest
    ? [rest, ...nonEmptyLines.slice(1)]
    : nonEmptyLines.slice(1)

  const translation = formatTranslation(bodyForFormat)

  targetArray.push({
    $word: word,
    $transcription: transcription,
    $translation: translation,
  })
}

async function parseDictFile(filePath: string, insertMany: (entries: DictEntry[]) => number): Promise<number> {
  console.log(`\n📖 Читаем: ${path.basename(filePath)}`)

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let currentWord: string | null = null
  let bodyLines: string[] = []
  let entriesBatch: DictEntry[] = []
  let totalInserted = 0

  const flush = () => {
    if (currentWord !== null && bodyLines.length > 0) {
      processBuffer(currentWord, bodyLines, entriesBatch)
      if (entriesBatch.length >= BATCH_SIZE) {
        totalInserted += insertMany(entriesBatch)
        console.log(`   Добавлено: ${totalInserted}...`)
        entriesBatch = []
      }
    }
  }

  for await (const line of rl) {
    // Строка с отступом или пустая — часть тела текущей статьи
    if (line === '' || line.startsWith(' ') || line.startsWith('\t')) {
      if (currentWord !== null)
        bodyLines.push(line)
      continue
    }

    // Новое слово — непробельная непустая строка
    flush()
    currentWord = line.trim()
    bodyLines = []
  }

  // Последняя запись
  flush()

  if (entriesBatch.length > 0)
    totalInserted += insertMany(entriesBatch)

  return totalInserted
}

async function importDictionary() {
  console.log('Начинаем импорт словаря Мюллера...')

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO words (word, transcription, translation)
    VALUES ($word, $transcription, $translation)
  `)

  const insertMany = db.transaction((entries: DictEntry[]) => {
    for (const entry of entries)
      insertStmt.run(entry)
    return entries.length
  })

  let grandTotal = 0

  for (const filename of DICT_FILES) {
    const filePath = path.join(DATA_DIR, filename)
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Файл не найден, пропускаем: ${filename}`)
      continue
    }
    const count = await parseDictFile(filePath, insertMany)
    grandTotal += count
    console.log(`   ✅ ${filename}: ${count} записей`)
  }

  console.log(`\n✅ Готово! Всего добавлено записей: ${grandTotal}.`)
  db.close()
}

importDictionary().catch((error) => {
  console.error('Произошла ошибка во время импорта:', error)
  db.close()
  process.exit(1)
})
