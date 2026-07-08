import type { LlmConfig } from '../types'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sqlite } from '~/db'
import { catalogSqlite } from '~/db/catalog'
import { generateWordAutoFill } from '../services/llm.service'
import { getAiConfig } from '../utils/ai-config'
import { normalizeLanguageCode } from '../utils/helpers'

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
  const lang = normalizeLanguageCode(data.lang || data.language || 'zh')
  const targetLang = data.targetLanguage || data.targetLang || 'ru'
  const words = data.words as any[]

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

  console.log(`🚀 Начинаем обогащение колоды: "${title}" (${words.length} слов)`)

  for (let i = 0; i < words.length; i++) {
    const item = words[i]

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
        tags: filterAllowedTags(res.tags),
        transcription: res.transcription || '',
        translation: res.translation || '',
        grammarNote: res.grammarNote || '',
        vocabularyNote: res.vocabularyNote || '',
        difficulty: res.difficulty || difficulty,
      })

      await new Promise(r => setTimeout(r, 600))
    }
    catch (e: unknown) {
      console.error(`❌ Ошибка при обработке слова "${word}":`, (e as Error).message)
    }
  }

  const finalDeck = {
    title,
    description,
    language: lang,
    targetLanguage: targetLang,
    difficulty,
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
