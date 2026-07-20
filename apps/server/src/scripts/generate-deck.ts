import type { LlmAnalysis, LlmConfig, ModelMessage } from '../types'
import type { TokenUsage } from '../utils/llm-api'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cancel, intro, isCancel, select } from '@clack/prompts'
import { eq } from 'drizzle-orm'
import { db, sqlite } from '~/db'
import { catalogSqlite } from '~/db/catalog'
import * as schema from '../db/schema'
import { getSystemPrompt } from '../prompts'
import { LlmAnalysisSchema } from '../types/schemas'
import { getAiConfig } from '../utils/ai-config'
import { hashSentence, normalizeLanguageCode } from '../utils/helpers'
import { callLlmStructured } from '../utils/llm-api'
import { logger } from '../utils/logger'

const args = process.argv.slice(2)
const inputArg = args[0]

const ALLOWED_TAGS = [
  'sci_fi',
  'fantasy',
  'adventure',
  'shounen',
  'shoujo',
  'seinen',
  'josei',
  'romance',
  'comedy',
  'drama',
  'slice_of_life',
  'action',
  'thriller',
  'mystery',
  'horror',
  'post_apocalyptic',
  'cyberpunk',
  'historical',
  'martial_arts',
  'psychological',
  'supernatural',
  'magic',
  'school',
  'mecha',
  'isekai',
  'game',
  'dystopia',
  'music',
  'sports',
  'tragedy',
  'space',
  'vampire',
  'zombie',
  'military',
  'wuxia',
  'xianxia',
]

function filterAllowedTags(rawTags: string | undefined | null): string {
  if (!rawTags)
    return ''

  const parsedTags = rawTags.split(',').map(t => t.trim().toLowerCase())

  const validTags = parsedTags.filter(t => ALLOWED_TAGS.includes(t))

  return validTags.join(', ')
}

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

function isOldFormatAnalysis(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object')
    return true
  const obj = parsed as Record<string, unknown>
  if (Array.isArray(obj.grammarRules)) {
    if (obj.grammarRules.some((r: unknown) => typeof r !== 'object' || r === null))
      return true
  }
  if (Array.isArray(obj.vocabulary)) {
    if (obj.vocabulary.some((v: unknown) => typeof v !== 'object' || v === null))
      return true
  }
  return false
}

interface AnalysisResult {
  analysis: LlmAnalysis
  cached: boolean
  usage?: TokenUsage
}

async function analyzeWordForDeck(
  word: string,
  language: string,
  targetLang: string,
  config: LlmConfig,
): Promise<AnalysisResult> {
  const hash = hashSentence(word, language, targetLang)

  const cached = await db.query.llmCache.findFirst({
    where: eq(schema.llmCache.sentenceHash, hash),
  })

  if (cached) {
    try {
      const parsed = JSON.parse(cached.analysis)
      if (!isOldFormatAnalysis(parsed)) {
        return { analysis: parsed as LlmAnalysis, cached: true }
      }
    }
    catch { }
  }

  if (!config.url)
    throw new Error('LLM API не настроен')

  const messages: ModelMessage[] = [
    { role: 'system', content: getSystemPrompt(language, targetLang) },
    { role: 'user', content: `Текст: ${word}` },
  ]

  const modelsToTry = [config.model, config.fallbackModel].filter(Boolean) as string[]
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const { parsed: analysis, usage } = await callLlmStructured<LlmAnalysis>(
        model,
        messages,
        0.2,
        AbortSignal.timeout(60000),
        config,
        LlmAnalysisSchema,
        () => { },
      )

      return { analysis, cached: false, usage }
    }
    catch (e) {
      lastError = e as Error
      logger.warn({ err: lastError }, `[LLM] Failed with model [${model}]:`)
    }
  }

  throw new Error(`Не удалось получить валидный ответ от ИИ: ${lastError?.message || 'Unknown error'}`)
}

async function main() {
  let langPair = ''
  let relativeRawPath = ''
  let inputFile = ''
  let outputFile = ''

  const decksDir = path.resolve(process.cwd(), 'assets', 'decks')

  if (inputArg) {
    const absolutePath = path.resolve(inputArg)
    if (absolutePath.startsWith(decksDir)) {
      const relativeToDecks = path.relative(decksDir, absolutePath)
      const parts = relativeToDecks.split(path.sep)
      if (parts.length >= 3 && parts[1] === 'raw') {
        langPair = parts[0]
        relativeRawPath = parts.slice(2).join(path.sep)
        inputFile = absolutePath
        outputFile = path.resolve(decksDir, langPair, 'result', relativeRawPath)
      }
    }

    if (!inputFile) {
      logger.error(`❌ Ошибка: Указанный файл должен находиться внутри структуры assets/decks/<lang-pair>/raw/`)
      logger.error(`Пример корректного пути: assets/decks/zh-ru/raw/hsk1.json`)
      logger.error(`Или запустите скрипт без аргументов для интерактивного выбора.`)
      process.exit(1)
    }
  }
  else {
    const pairs = await getLanguagePairs(decksDir)
    if (pairs.length === 0) {
      logger.error(`❌ Ошибка: В папке ${decksDir} не найдено языковых пар (поддиректорий).`)
      process.exit(1)
    }

    intro('Deck Generator')

    const selectedPair = await select({
      message: '📂 Выберите языковую пару:',
      options: pairs.map(p => ({ value: p, label: p })),
    })

    if (isCancel(selectedPair)) {
      cancel('Отменено')
      process.exit(0)
    }
    langPair = selectedPair as string

    const rawDir = path.resolve(decksDir, langPair, 'raw')
    if (!(await exists(rawDir))) {
      logger.error(`❌ Ошибка: Папка raw не найдена по пути ${rawDir}`)
      process.exit(1)
    }

    const jsonFiles = await getJsonFiles(rawDir)
    if (jsonFiles.length === 0) {
      logger.error(`❌ Ошибка: В папке ${rawDir} не найдено JSON файлов.`)
      process.exit(1)
    }

    const selectedFile = await select({
      message: '📄 Выберите JSON файл в папке raw:',
      options: jsonFiles.map(f => ({ value: f, label: f })),
    })

    if (isCancel(selectedFile)) {
      cancel('Отменено')
      process.exit(0)
    }
    relativeRawPath = selectedFile as string

    inputFile = path.resolve(rawDir, relativeRawPath)
    outputFile = path.resolve(decksDir, langPair, 'result', relativeRawPath)
  }

  await mkdir(path.dirname(outputFile), { recursive: true })

  logger.info(`📖 Чтение файла: ${inputFile}`)
  const raw = await readFile(inputFile, 'utf-8')
  const data = JSON.parse(raw)

  const title = data.title
  const description = data.description || ''
  const difficulty = data.difficulty || ''
  const lang = normalizeLanguageCode(data.lang || data.language || 'zh')
  const targetLang = data.targetLanguage || data.targetLang || 'ru'
  const words = data.words as Array<string | Record<string, unknown>>

  if (!title || !words || !Array.isArray(words)) {
    logger.error('❌ Неверный формат JSON. Ожидается: { "title": "...", "words": ["..."] }')
    process.exit(1)
  }

  const aiConfigObj = getAiConfig()
  const config: LlmConfig = {
    url: aiConfigObj.llm.url,
    key: aiConfigObj.llm.key,
    model: aiConfigObj.llm.model,
    fallbackModel: aiConfigObj.llm.fallbackModel,
  }

  const enrichedWords: Record<string, unknown>[] = []

  try {
    const existingRaw = await readFile(outputFile, 'utf-8')
    const existingData = JSON.parse(existingRaw)
    if (existingData && Array.isArray(existingData.words)) {
      enrichedWords.push(...existingData.words)
      logger.info(`ℹ️ Найдено ${enrichedWords.length} уже обработанных слов. Возобновляем прогресс...`)
    }
  }
  catch {
    // Файл не существует или поврежден, начнем заново
  }

  logger.info(`🚀 Начинаем обогащение колоды: "${title}" (${words.length} слов)`)

  let cachedCount = 0
  let generatedCount = 0
  let totalPromptTokens = 0
  let totalCompletionTokens = 0

  for (let i = 0; i < words.length; i++) {
    const item = words[i]

    const wordObj = typeof item === 'string' ? null : (item as Record<string, unknown>)
    const word = typeof item === 'string' ? item : (wordObj?.word || wordObj?.text)

    if (!word || typeof word !== 'string') {
      logger.warn(item, `⚠️ [${i + 1}/${words.length}] Пропуск: не удалось извлечь слово из`)
      continue
    }

    const alreadyProcessed = enrichedWords.find(w => w.word === word)
    if (alreadyProcessed) {
      continue
    }

    try {
      const res = await analyzeWordForDeck(word, lang, targetLang, config)

      if (res.cached) {
        cachedCount++
        logger.info(`✅ [${i + 1}/${words.length}] [${word}] Взято из кэша.`)
      }
      else {
        generatedCount++
        if (res.usage) {
          totalPromptTokens += res.usage.promptTokens
          totalCompletionTokens += res.usage.completionTokens
          logger.info(`✅ [${i + 1}/${words.length}] [${word}] Сгенерировано (Токены: ${res.usage.promptTokens} in / ${res.usage.completionTokens} out).`)
        }
        else {
          logger.info(`✅ [${i + 1}/${words.length}] [${word}] Сгенерировано.`)
        }
      }

      enrichedWords.push({
        word,
        tags: typeof item === 'string' ? '' : filterAllowedTags(wordObj?.tags as string),
        difficulty: typeof item === 'string' ? difficulty : ((wordObj?.difficulty as string) || difficulty),
        transcription: res.analysis.transcription || '',
        translation: res.analysis.translation || '',
        grammarRules: res.analysis.grammarRules || [],
        vocabulary: res.analysis.vocabulary || [],
      })

      const finalDeck = {
        title,
        description,
        language: lang,
        targetLanguage: targetLang,
        difficulty,
        words: enrichedWords,
      }

      await writeFile(outputFile, JSON.stringify(finalDeck, null, 2), 'utf-8')

      await new Promise(r => setTimeout(r, 600))
    }
    catch (e: unknown) {
      logger.error(e as Error, `❌ Ошибка при обработке слова "${word}":`)
    }
  }

  logger.info(`✅ Готово! Результат сохранен в ${outputFile}`)
  logger.info(`\n📊 Сводка:`)
  logger.info(`   Взято из кэша: ${cachedCount}`)
  logger.info(`   Сгенерировано: ${generatedCount}`)
  if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
    logger.info(`   Токены: ${totalPromptTokens} in / ${totalCompletionTokens} out (всего: ${totalPromptTokens + totalCompletionTokens})`)
  }

  await new Promise(r => setTimeout(r, 1500))
}

main()
  .catch(e => logger.error(e, 'Критическая ошибка:'))
  .finally(() => {
    try {
      sqlite.close()
      catalogSqlite.close()
    }
    catch { }
    process.exit(0)
  })
