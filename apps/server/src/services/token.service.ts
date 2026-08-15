import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import * as schema from '../db/schema'
import { logger } from '../utils/logger'

export interface AudioDurationMetadata {
  inputAudioSeconds?: number
  outputAudioSeconds?: number
}

export function trackTokenUsage(
  userId: number,
  action: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  inputText?: string,
  outputText?: string,
  audioDuration?: AudioDurationMetadata,
) {
  if (!userId || (!inputTokens && !outputTokens && !audioDuration?.inputAudioSeconds && !audioDuration?.outputAudioSeconds))
    return

  const date = new Date().toISOString().split('T')[0]
  const inSec = audioDuration?.inputAudioSeconds ? Math.round(audioDuration.inputAudioSeconds * 100) / 100 : 0
  const outSec = audioDuration?.outputAudioSeconds ? Math.round(audioDuration.outputAudioSeconds * 100) / 100 : 0

  Promise.resolve().then(async () => {
    try {
      // 1. Агрегация по дням
      await db.insert(schema.tokenUsage).values({
        userId,
        date,
        action,
        model,
        inputTokens,
        outputTokens,
        audioInputSeconds: inSec,
        audioOutputSeconds: outSec,
      }).onConflictDoUpdate({
        target: [schema.tokenUsage.userId, schema.tokenUsage.date, schema.tokenUsage.action, schema.tokenUsage.model],
        set: {
          inputTokens: sql`${schema.tokenUsage.inputTokens} + ${inputTokens}`,
          outputTokens: sql`${schema.tokenUsage.outputTokens} + ${outputTokens}`,
          audioInputSeconds: sql`COALESCE(${schema.tokenUsage.audioInputSeconds}, 0) + ${inSec}`,
          audioOutputSeconds: sql`COALESCE(${schema.tokenUsage.audioOutputSeconds}, 0) + ${outSec}`,
        },
      })

      // 2. Обновление общего счетчика пользователя
      await db.update(schema.users).set({
        usedTokens: sql`${schema.users.usedTokens} + ${inputTokens + outputTokens}`,
      }).where(eq(schema.users.id, userId))

      // 3. Запись подробного лога для отладки
      await db.insert(schema.llmLogs).values({
        userId,
        action,
        model,
        inputTokens,
        outputTokens,
        inputText,
        outputText,
        audioInputSeconds: inSec > 0 ? inSec : null,
        audioOutputSeconds: outSec > 0 ? outSec : null,
      })
    }
    catch (e) {
      logger.error(e, '[Token Tracker Error]')
    }
  })
}
