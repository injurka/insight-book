/* eslint-disable no-console */
import * as fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as readline from 'node:readline'
import { db } from './db'

const INPUT_FILE = path.resolve(process.cwd(), 'data', 'dabkrs_260504')
const BATCH_SIZE = 10000

interface DictEntry {
  $word: string
  $pinyin: string | null
  $translation: string
}

/**
 * Парсит DSL-разметку (как в БКРС) в HTML.
 * Эта функция скопирована из вашего Vue-проекта.
 */
function parseDictionaryMarkup(text: string): string {
  if (!text)
    return ''

  // eslint-disable-next-line prefer-const
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[b\](.*?)\[\/b\]/gi, '<b>$1</b>')
    .replace(/\[i\](.*?)\[\/i\]/gi, '<i>$1</i>')
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[c\](.*?)\[\/c\]/gi, '<span class="dict-color">$1</span>')
    .replace(/\[p\](.*?)\[\/p\]/gi, '<span class="dict-pos">$1</span>')
    .replace(/\[ex\](.*?)\[\/ex\]/gi, '<span class="dict-example">$1</span>')
    .replace(/\[ref\](.*?)\[\/ref\]/gi, '<span class="dict-ref">$1</span>')
    .replace(/\[m(\d)?\](.*?)\[\/m\]/gi, '<div class="dict-margin m-$1">$2</div>')
    .replace(/\[\*\]/g, '<div class="dict-bullet">')
    .replace(/\[\/\*\]/g, '</div>')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\n/g, '<br>')

  return html
}

async function importDictionary() {
  console.log('Начинаем импорт словаря...')

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO zh_dictionary (word, pinyin, translation)
    VALUES ($word, $pinyin, $translation)
  `)

  const insertMany = db.transaction((entries: DictEntry[]) => {
    for (const entry of entries) {
      insertStmt.run(entry)
    }
    return entries.length
  })

  console.log(`Читаем файл: ${INPUT_FILE}`)
  const fileStream = fs.createReadStream(INPUT_FILE, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let buffer: string[] = []
  let entriesBatch: DictEntry[] = []
  let totalInserted = 0

  for await (const line of rl) {
    const trimmedLine = line.trim()

    if (trimmedLine === '') {
      if (buffer.length >= 2) {
        processBuffer(buffer, entriesBatch)

        if (entriesBatch.length >= BATCH_SIZE) {
          const insertedCount = insertMany(entriesBatch)
          totalInserted += insertedCount
          console.log(`Добавлено записей: ${totalInserted}...`)
          entriesBatch = []
        }
      }
      buffer = []
    }
    else {
      buffer.push(trimmedLine)
    }
  }

  if (buffer.length >= 2) {
    processBuffer(buffer, entriesBatch)
  }

  if (entriesBatch.length > 0) {
    const insertedCount = insertMany(entriesBatch)
    totalInserted += insertedCount
  }

  console.log(`\n✅ Готово! Всего добавлено записей: ${totalInserted}.`)

  db.close()
}

function processBuffer(buffer: string[], targetArray: DictEntry[]) {
  const word = buffer[0]
  const pinyin = buffer[1] === '_' ? null : buffer[1]
  const rawTranslation = buffer.slice(2).join('\n')

  const htmlTranslation = parseDictionaryMarkup(rawTranslation.trim())

  targetArray.push({
    $word: word,
    $pinyin: pinyin,
    $translation: htmlTranslation,
  })
}

importDictionary().catch((error) => {
  console.error('Произошла ошибка во время импорта:', error)
  db.close()
  process.exit(1)
})
