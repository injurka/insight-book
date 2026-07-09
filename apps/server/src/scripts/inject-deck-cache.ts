import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { cancel, intro, isCancel, select } from '@clack/prompts'
import { db, sqlite } from '~/db'
import * as schema from '../db/schema'
import { hashSentence, normalizeLanguageCode } from '../utils/helpers'

const args = process.argv.slice(2)
const inputArg = args[0]

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  }
  catch {
    return false
  }
}

async function getLanguagePairs(decksDir: string): Promise<string[]> {
  const entries = await readdir(decksDir, { withFileTypes: true })
  const pairs: string[] = []

  for (const entry of entries) {
    if (entry.name === 'old') {
      continue
    }
    if (entry.isDirectory()) {
      pairs.push(entry.name)
    }
  }

  return pairs
}

async function getJsonFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === 'old') {
      continue
    }

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await getJsonFiles(fullPath, baseDir)
      files.push(...subFiles)
    }
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const relativePath = path.relative(baseDir, fullPath)
      files.push(relativePath)
    }
  }

  return files
}

async function main() {
  let langPair = ''
  let relativePath = ''
  let inputFile = ''

  const decksDir = path.resolve(process.cwd(), 'assets', 'decks')

  if (inputArg) {
    inputFile = path.resolve(inputArg)
    if (!(await exists(inputFile))) {
      console.error(`❌ Ошибка: Файл не найден по пути ${inputFile}`)
      process.exit(1)
    }
  }
  else {
    const pairs = await getLanguagePairs(decksDir)
    if (pairs.length === 0) {
      console.error(`❌ Ошибка: В папке ${decksDir} не найдено языковых пар (поддиректорий).`)
      process.exit(1)
    }

    intro('Inject Deck into LLM Cache')

    const selectedPair = await select({
      message: '📂 Выберите языковую пару:',
      options: pairs.map(p => ({ value: p, label: p })),
    })

    if (isCancel(selectedPair)) {
      cancel('Отменено')
      process.exit(0)
    }
    langPair = selectedPair as string

    // Choose from "result" folder since this is where the enriched JSONs are
    const resultDir = path.resolve(decksDir, langPair, 'result')
    if (!(await exists(resultDir))) {
      console.error(`❌ Ошибка: Папка result не найдена по пути ${resultDir}. Сначала сгенерируйте колоду.`)
      process.exit(1)
    }

    const jsonFiles = await getJsonFiles(resultDir)
    if (jsonFiles.length === 0) {
      console.error(`❌ Ошибка: В папке ${resultDir} не найдено JSON файлов.`)
      process.exit(1)
    }

    const selectedFile = await select({
      message: '📄 Выберите JSON файл из папки result:',
      options: jsonFiles.map(f => ({ value: f, label: f })),
    })

    if (isCancel(selectedFile)) {
      cancel('Отменено')
      process.exit(0)
    }
    relativePath = selectedFile as string
    inputFile = path.resolve(resultDir, relativePath)
  }

  console.log(`📖 Чтение файла: ${inputFile}`)
  const raw = await readFile(inputFile, 'utf-8')
  const data = JSON.parse(raw)

  const lang = normalizeLanguageCode(data.lang || data.language || 'zh')
  const targetLang = data.targetLanguage || data.targetLang || 'ru'
  const words = data.words as any[]

  if (!words || !Array.isArray(words)) {
    console.error('❌ Неверный формат JSON. Ожидается: { "words": [{ "word": "...", ... }] }')
    process.exit(1)
  }

  let injectedCount = 0
  let skippedCount = 0

  console.log(`🚀 Начинаем инжект ${words.length} слов в таблицу llm_cache...`)

  for (const item of words) {
    if (!item.word || typeof item.word !== 'string') {
      continue
    }

    const sentence = item.word.trim()
    const sentenceHash = hashSentence(sentence, lang, targetLang)

    const analysis = {
      transcription: item.transcription || '',
      translation: item.translation || '',
      grammarRules: Array.isArray(item.grammarRules) ? item.grammarRules : [],
      vocabulary: Array.isArray(item.vocabulary) ? item.vocabulary : [],
    }

    try {
      const result = await db.insert(schema.llmCache).values({
        sentenceHash,
        language: lang,
        targetLanguage: targetLang,
        sentence,
        analysis: JSON.stringify(analysis),
      }).onConflictDoNothing().returning()

      if (result.length > 0) {
        injectedCount++
        console.log(`✅ [${sentence}] Добавлено в кэш.`)
      }
      else {
        skippedCount++
        console.log(`⏭️ [${sentence}] Уже существует в кэше, пропущено.`)
      }
    }
    catch (e: any) {
      console.error(`❌ Ошибка при инжекте слова [${sentence}]:`, e.message)
    }
  }

  console.log(`\n🎉 Инжект завершен!`)
  console.log(`Добавлено: ${injectedCount}`)
  console.log(`Пропущено (уже были): ${skippedCount}`)
}

main()
  .catch(e => console.error('Критическая ошибка:', e))
  .finally(() => {
    try {
      sqlite.close()
    }
    catch {}
    process.exit(0)
  })
