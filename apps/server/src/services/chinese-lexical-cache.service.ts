import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { llmCache, userDictionary } from '../db/schema'
import { decompressData } from '../utils/compression'
import { hashSentence } from '../utils/helpers'

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function selectCachedFields(analysis: Buffer) {
  try {
    const parsed: unknown = JSON.parse(decompressData(analysis))

    if (!parsed || typeof parsed !== 'object')
      return null

    // Only return fields for the submitted text. Grammar examples and
    // vocabulary notes can contain context supplied by the original reader.
    const translation = readText('translation' in parsed ? parsed.translation : null)
    const transcription = readText('transcription' in parsed ? parsed.transcription : null)

    return translation || transcription ? { translation, transcription, source: 'reader' as const } : null
  }
  catch {
    return null
  }
}

export async function getCachedChineseEntry(userId: number, text: string, targetLanguage: string) {
  const word = text.trim()

  if (!/\p{Script=Han}/u.test(word))
    return null

  const personal = await db.query.userDictionary.findFirst({
    columns: { translation: true, transcription: true },
    where: and(
      eq(userDictionary.userId, userId),
      eq(userDictionary.word, word),
      eq(userDictionary.language, 'zh'),
      eq(userDictionary.targetLanguage, targetLanguage),
    ),
  })
  const translation = readText(personal?.translation)
  const transcription = readText(personal?.transcription)

  if (translation || transcription)
    return { translation, transcription, source: 'dictionary' as const }

  const cached = await db.query.llmCache.findFirst({
    columns: { analysis: true },
    where: and(eq(llmCache.sentenceHash, hashSentence(word, 'zh', targetLanguage)), eq(llmCache.language, 'zh'), eq(llmCache.targetLanguage, targetLanguage)),
  })

  return cached ? selectCachedFields(cached.analysis) : null
}
