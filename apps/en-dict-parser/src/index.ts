/* eslint-disable no-console */
import * as fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { db } from './db'

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

function getLeadingSpaces(line: string): number {
  const match = line.match(/^(\s+)/)
  return match ? match[1].length : 0
}

/**
 * Форматирует тело перевода под стиль китайского словаря:
 * - Использует m-1, m-2, m-3 для отступов вместо inline-стилей.
 * - Оборачивает части речи (n., v.) в <span class="dict-pos">.
 * - Делает римские и обычные цифры жирными <b>.
 */
function formatTranslation(lines: string[]): string {
  if (lines.length === 0)
    return ''

  // === КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ОПРЕДЕЛЯЕМ БАЗОВЫЙ ОТСТУП ===
  // Находим минимальное количество пробелов среди всех непустых строк.
  // Это будет наш "нулевой" уровень (m-1).
  const nonEmptyLines = lines.filter(line => line.trim() !== '')
  if (nonEmptyLines.length === 0)
    return ''

  const baseIndent = Math.min(...nonEmptyLines.map(getLeadingSpaces))

  return nonEmptyLines
    .map((line) => {
      const currentIndent = getLeadingSpaces(line)
      // Вычисляем относительный отступ
      const relativeIndent = currentIndent - baseIndent

      // Определяем уровень класса отступа на основе относительного значения
      let mLevel = 1
      if (relativeIndent <= 0)
        mLevel = 1 // Базовый уровень
      else if (relativeIndent <= 2)
        mLevel = 2 // Первый уровень вложенности
      else if (relativeIndent <= 4)
        mLevel = 3 // Второй уровень
      else
        mLevel = 4 // Глубокая вложенность

      let text = line.trimStart()

      text = text
        .replace(/^([IVX]+)(?=\s|$)/, '<b>$1</b>')
        .replace(/^(\d+)\.\s+/g, '<b>$1.</b> ')
        // eslint-disable-next-line regexp/no-obscure-range
        .replace(/^(\d+|[a-zа-яё])\)\s+/gi, '<b>$1)</b> ')
        .replace(/^(\*\)|#\)|◆)\s*/, '')
        // eslint-disable-next-line regexp/no-obscure-range
        .replace(/_([а-яёa-z.:]+)/gi, '<span class="dict-pos">$1</span>')

      if (mLevel >= 4 && !text.startsWith('<b>'))
        return `<div class="dict-margin m-${mLevel}"><div class="dict-bullet"><span class="dict-example">${text}</span></div></div>`

      return `<div class="dict-margin m-${mLevel}">${text}</div>`
    })
    .join('')
}

function extractTranscription(firstBodyLine: string): {
  transcription: string | null
  rest: string
} {
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const match = firstBodyLine.trimStart().match(/^([IVX]+\s+)?(\[[^\]]+\])\s*(.*)$/)
  if (!match)
    return { transcription: null, rest: firstBodyLine }

  const romanNumeral = match[1] ? `${match[1].trim()} ` : ''

  // Мы возвращаем rest БЕЗ начальных пробелов. Пробелы будут обработаны в formatTranslation.
  return {
    transcription: match[2],
    rest: (romanNumeral + match[3]).trimStart(),
  }
}

function processBuffer(
  word: string,
  bodyLines: string[],
  targetArray: DictEntry[],
) {
  if (word.startsWith('00-database') || word.startsWith('0database'))
    return

  const nonEmptyLines = bodyLines.map(l => l.trimEnd()).filter(Boolean)
  if (nonEmptyLines.length === 0)
    return

  // Извлекаем транскрипцию из первой строки
  const { transcription, rest } = extractTranscription(nonEmptyLines[0])

  // Собираем тело для форматирования
  const bodyForFormat = [...nonEmptyLines]
  // Если в первой строке что-то осталось после извлечения транскрипции, заменяем ее.
  // Если не осталось, то просто удаляем.
  if (rest.trim()) {
    // Важно: сохраняем исходные пробелы первой строки, чтобы правильно вычислить baseIndent
    const originalIndent = ' '.repeat(getLeadingSpaces(nonEmptyLines[0]))
    bodyForFormat[0] = originalIndent + rest
  }
  else {
    bodyForFormat.shift()
  }

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
    if (line === '' || line.startsWith(' ') || line.startsWith('\t')) {
      if (currentWord !== null)
        bodyLines.push(line)
      continue
    }

    flush()
    currentWord = line.trim()
    bodyLines = []
  }

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
