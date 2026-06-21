import type { LlmConfig } from '../types'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { catalogSqlite, sqlite } from '../db'
import { generateWordAutoFill } from '../services/llm.service'
import { getAiConfig } from '../utils/ai-config'
import { normalizeLanguageCode } from '../utils/helpers'

const args = process.argv.slice(2)
const inputArg = args[0]

async function main() {
  if (!inputArg) {
    console.error('❌ Использование: bun src/scripts/generate-deck.ts <имя_файла.json или путь>')
    console.error('Пример: bun src/scripts/generate-deck.ts hsk1.json')
    process.exit(1)
  }

  let inputFile = inputArg
  if (!inputArg.includes('/') && !inputArg.includes('\\')) {
    inputFile = path.resolve(process.cwd(), 'assets', 'decks', 'raw', inputArg)
  }
  else {
    inputFile = path.resolve(inputArg)
  }

  const filename = path.basename(inputFile)
  const outputFile = path.resolve(process.cwd(), 'assets', 'decks', filename)

  console.log(`📖 Чтение файла: ${inputFile}`)
  const raw = await readFile(inputFile, 'utf-8')
  const data = JSON.parse(raw)

  const title = data.title
  const description = data.description || ''
  const difficulty = data.difficulty || ''
  const lang = normalizeLanguageCode(data.lang || 'zh')
  const targetLang = data.targetLang || 'ru'
  const words = data.words as string[]

  if (!title || !words || !Array.isArray(words)) {
    console.error('❌ Неверный формат JSON. Ожидается: { "title": "...", "words": ["..."] }')
    process.exit(1)
  }

  const aiConfigObj = getAiConfig()
  const config: LlmConfig = {
    url: aiConfigObj.llm.url,
    key: aiConfigObj.llm.key,
    model: aiConfigObj.llm.model,
    fallbackModel: aiConfigObj.llm.fallbackModel,
  }

  const enrichedWords = []
  const tagsSet = new Set<string>()
  const diffCount: Record<string, number> = {}

  console.log(`🚀 Начинаем обогащение колоды: "${title}" (${words.length} слов)`)

  for (let i = 0; i < words.length; i++) {
    const item = words[i] as any

    const word = typeof item === 'string' ? item : (item.word || item.text)

    if (!word || typeof word !== 'string') {
      console.warn(`⚠️ [${i + 1}/${words.length}] Пропуск: не удалось извлечь слово из`, item)
      continue
    }

    console.log(`⏳ [${i + 1}/${words.length}] Обработка слова: ${word}...`)
    try {
      const res = await generateWordAutoFill(1, word, lang, targetLang, config)

      enrichedWords.push({
        word,
        tags: res.tags,
        difficulty,
        transcription: res.transcription || '',
        translation: res.translation || '',
        grammarNote: res.grammarNote || '',
        vocabularyNote: res.vocabularyNote || '',
      })

      if (res.difficulty) {
        diffCount[res.difficulty] = (diffCount[res.difficulty] || 0) + 1
      }
      if (res.tags) {
        res.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagsSet.add(t))
      }

      await new Promise(r => setTimeout(r, 600))
    }
    catch (e: any) {
      console.error(`❌ Ошибка при обработке слова "${word}":`, e.message)
    }
  }

  const dominantDifficulty = Object.entries(diffCount).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  const allTags = Array.from(tagsSet).slice(0, 5).join(', ')

  const finalDeck = {
    title,
    description,
    language: lang,
    difficulty: dominantDifficulty,
    tags: allTags,
    words: enrichedWords,
  }

  await writeFile(outputFile, JSON.stringify(finalDeck, null, 2), 'utf-8')
  console.log(`✅ Готово! Результат сохранен в ${outputFile}`)

  await new Promise(r => setTimeout(r, 1500))
}

main()
  .catch(e => console.error('Критическая ошибка:', e))
  .finally(() => {
    try {
      sqlite.close()
      catalogSqlite.close()
    }
    catch { }
    process.exit(0)
  })
