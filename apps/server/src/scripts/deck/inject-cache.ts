import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { cancel, intro, isCancel, select } from '@clack/prompts'
import { client, db } from '~/db'
import * as schema from '../../db/schema'
import { compressData } from '../../utils/compression'
import { hashSentence, normalizeLanguageCode } from '../../utils/helpers'
import { logger } from '../../utils/logger'

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

async function injectFile(inputFile: string): Promise<{ injected: number, skipped: number }> {
  logger.info(`📖 Чтение файла: ${inputFile}`)
  const raw = await readFile(inputFile, 'utf-8')
  const data = JSON.parse(raw)

  const lang = normalizeLanguageCode(data.lang || data.language || 'zh')
  const targetLang = data.targetLanguage || data.targetLang || 'ru'
  const words = data.words as Array<{ word?: string, transcription?: string, translation?: string, grammarRules?: unknown[], vocabulary?: unknown[] }>

  if (!words || !Array.isArray(words)) {
    logger.error(`❌ Неверный формат JSON в ${inputFile}. Ожидается: { "words": [{ "word": "...", ... }] }`)
    return { injected: 0, skipped: 0 }
  }

  let injectedCount = 0
  let skippedCount = 0

  logger.info(`🚀 Начинаем инжект ${words.length} слов в таблицу llm_cache...`)

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
        analysis: compressData(JSON.stringify(analysis)),
      }).onConflictDoNothing().returning()

      if (result.length > 0) {
        injectedCount++
        logger.info(`✅ [${sentence}] Добавлено в кэш.`)
      }
      else {
        skippedCount++
        logger.info(`⏭️ [${sentence}] Уже существует в кэше, пропущено.`)
      }
    }
    catch (e: unknown) {
      logger.error(e as Error, `❌ Ошибка при инжекте слова [${sentence}]:`)
    }
  }

  return { injected: injectedCount, skipped: skippedCount }
}

async function main() {
  const decksDir = path.resolve(process.cwd(), 'assets', 'decks')

  if (inputArg) {
    const inputFile = path.resolve(inputArg)
    if (!(await exists(inputFile))) {
      logger.error(`❌ Ошибка: Файл не найден по пути ${inputFile}`)
      process.exit(1)
    }
    const { injected, skipped } = await injectFile(inputFile)
    logger.info(`\n🎉 Инжект завершен!`)
    logger.info(`Добавлено: ${injected}`)
    logger.info(`Пропущено (уже были): ${skipped}`)
    return
  }

  const pairs = await getLanguagePairs(decksDir)
  if (pairs.length === 0) {
    logger.error(`❌ Ошибка: В папке ${decksDir} не найдено языковых пар (поддиректорий).`)
    process.exit(1)
  }

  intro('Inject Deck into LLM Cache')

  const mode = await select({
    message: '⚙️ Выберите режим работы:',
    options: [
      { value: 'single', label: 'Выбрать один файл' },
      { value: 'all_in_pair', label: 'Выбрать сразу все файлы в одной языковой паре' },
      { value: 'all', label: 'Выбрать сразу все файлы из всех языковых пар' },
    ],
  })

  if (isCancel(mode)) {
    cancel('Отменено')
    process.exit(0)
  }

  const filesToInject: string[] = []

  if (mode === 'single') {
    const selectedPair = await select({
      message: '📂 Выберите языковую пару:',
      options: pairs.map(p => ({ value: p, label: p })),
    })

    if (isCancel(selectedPair)) {
      cancel('Отменено')
      process.exit(0)
    }
    const langPair = selectedPair as string
    const resultDir = path.resolve(decksDir, langPair, 'result')

    if (!(await exists(resultDir))) {
      logger.error(`❌ Ошибка: Папка result не найдена по пути ${resultDir}. Сначала сгенерируйте колоду.`)
      process.exit(1)
    }

    const jsonFiles = await getJsonFiles(resultDir)
    if (jsonFiles.length === 0) {
      logger.error(`❌ Ошибка: В папке ${resultDir} не найдено JSON файлов.`)
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
    const relativePath = selectedFile as string
    filesToInject.push(path.resolve(resultDir, relativePath))
  }
  else if (mode === 'all_in_pair') {
    const selectedPair = await select({
      message: '📂 Выберите языковую пару:',
      options: pairs.map(p => ({ value: p, label: p })),
    })

    if (isCancel(selectedPair)) {
      cancel('Отменено')
      process.exit(0)
    }
    const langPair = selectedPair as string
    const resultDir = path.resolve(decksDir, langPair, 'result')

    if (!(await exists(resultDir))) {
      logger.error(`❌ Ошибка: Папка result не найдена по пути ${resultDir}. Сначала сгенерируйте колоду.`)
      process.exit(1)
    }

    const jsonFiles = await getJsonFiles(resultDir)
    if (jsonFiles.length === 0) {
      logger.error(`❌ Ошибка: В папке ${resultDir} не найдено JSON файлов.`)
      process.exit(1)
    }

    for (const f of jsonFiles) {
      filesToInject.push(path.resolve(resultDir, f))
    }
  }
  else if (mode === 'all') {
    for (const langPair of pairs) {
      const resultDir = path.resolve(decksDir, langPair, 'result')
      if (await exists(resultDir)) {
        const jsonFiles = await getJsonFiles(resultDir)
        for (const f of jsonFiles) {
          filesToInject.push(path.resolve(resultDir, f))
        }
      }
    }

    if (filesToInject.length === 0) {
      logger.error(`❌ Ошибка: Не найдено ни одного JSON файла в папках result всех языковых пар.`)
      process.exit(1)
    }
  }

  let totalInjected = 0
  let totalSkipped = 0

  logger.info(`\n📚 Найдено файлов для импорта: ${filesToInject.length}`)
  for (const file of filesToInject) {
    logger.info(`\n----------------------------------------`)
    const { injected, skipped } = await injectFile(file)
    totalInjected += injected
    totalSkipped += skipped
  }

  logger.info(`\n========================================`)
  logger.info(`🎉 Весь инжект завершен!`)
  logger.info(`Всего файлов обработано: ${filesToInject.length}`)
  logger.info(`Всего добавлено слов: ${totalInjected}`)
  logger.info(`Всего пропущено слов: ${totalSkipped}`)
}

main()
  .catch(e => logger.error(e, 'Критическая ошибка:'))
  .finally(() => {
    try {
      client.close()
    }
    catch {}
    process.exit(0)
  })
