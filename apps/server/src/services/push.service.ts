import { and, eq, lte, sql } from 'drizzle-orm'
import webpush from 'web-push'
import { getAiConfig } from '~/utils/ai-config'
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { getGeneralPushPrompt, getWordPushPrompt } from '../prompts'
import { parseLlmJson } from '../utils/helpers'
import { callLlmJsonWithRetry } from '../utils/llm-api'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

function getSeededRandom(seedStr: string) {
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0
  }
  const x = Math.sin(hash) * 10000
  return x - Math.floor(x)
}

function getTargetUtcTimesForDate(dateObj: Date, user: any): number[] {
  let timezone = user.timezone || 'UTC'
  let formatter: Intl.DateTimeFormat

  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }
  catch {
    timezone = 'UTC'
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const parts = formatter.formatToParts(dateObj)
  const p: Record<string, string> = {}
  parts.forEach((part) => {
    p[part.type] = part.value
  })

  const dateStr = `${p.year}-${p.month}-${p.day}`
  const currentLocalMs = (Number(p.hour) * 60 * 60 + Number(p.minute) * 60 + Number(p.second)) * 1000

  const timeStart = user.pushTimeStart || '10:00'
  const timeEnd = user.pushTimeEnd || '21:00'
  const count = user.pushCount || 1

  const [startH, startM] = timeStart.split(':').map(Number)
  const [endH, endM] = timeEnd.split(':').map(Number)

  const startMs = (startH * 60 + startM) * 60 * 1000
  let endMs = (endH * 60 + endM) * 60 * 1000
  if (endMs <= startMs) {
    endMs += 24 * 60 * 60 * 1000
  }

  const segmentMs = (endMs - startMs) / count
  const targets: number[] = []

  for (let i = 0; i < count; i++) {
    const segStart = startMs + i * segmentMs
    const randomFraction = getSeededRandom(`${user.id}-${dateStr}-${i}`)
    const targetLocalMs = segStart + randomFraction * segmentMs

    const targetUtcMs = dateObj.getTime() - currentLocalMs + targetLocalMs
    targets.push(targetUtcMs)
  }

  return targets
}

function shouldSendPush(user: any, now: Date): boolean {
  if (!user.pushCount || user.pushCount <= 0)
    return false

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const targetsYesterday = getTargetUtcTimesForDate(yesterday, user)
  const targetsToday = getTargetUtcTimesForDate(now, user)

  const allTargets = [...targetsYesterday, ...targetsToday].sort((a, b) => a - b)

  let latestPassedTarget = 0
  for (const t of allTargets) {
    if (t <= now.getTime()) {
      latestPassedTarget = t
    }
  }

  const lastPushMs = user.lastPushSentAt ? new Date(user.lastPushSentAt).getTime() : 0
  const isUnsent = latestPassedTarget > lastPushMs

  const isNotTooLate = (now.getTime() - latestPassedTarget) < 2 * 60 * 60 * 1000

  return isUnsent && isNotTooLate
}

export async function sendDailyMotivations(customMessage?: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[Push] VAPID keys not set. Skipping push dispatch.')
    return
  }

  console.log('🚀 Starting push notifications dispatch...')
  const subscriptions = await db.query.webPushSubscriptions.findMany({
    with: { user: true },
  })

  if (!subscriptions.length) {
    console.log('[Push] No active subscriptions found.')
    return
  }

  const userSubsMap = new Map<number, typeof subscriptions>()
  subscriptions.forEach((sub) => {
    const arr = userSubsMap.get(sub.userId) || []
    arr.push(sub)
    userSubsMap.set(sub.userId, arr)
  })

  const now = new Date()
  const nowIso = now.toISOString()

  const aiConfig = getAiConfig()
  const config = { url: aiConfig.llm.url, key: aiConfig.llm.key, model: aiConfig.llm.model }

  for (const [userId, subs] of userSubsMap.entries()) {
    const user = subs[0].user
    const uiLanguage = user.uiLanguage || 'ru'

    if (!customMessage && !shouldSendPush(user, now)) {
      continue
    }

    const messageTitle = 'InsightBook'
    let messageBody = customMessage || 'Время изучать языки!'
    let targetUrl = '/'

    if (!customMessage) {
      const filters: any[] = [
        eq(schema.userDictionary.userId, userId),
        lte(schema.userDictionary.nextReviewDate, nowIso),
      ]

      if (user.pushTargetDeckId) {
        filters.push(eq(schema.userDictionary.deckId, user.pushTargetDeckId))
      }

      const randomWord = await db.query.userDictionary.findFirst({
        where: and(...filters),
        orderBy: [sql`RANDOM()`],
      })

      if (randomWord) {
        targetUrl = '/dictionary'
        const wordStr = randomWord.word
        const transStr = randomWord.translation?.split(/<br>|,|;/)[0].replace(/<[^>]+>/g, '').trim() || ''
        const transcriptionStr = randomWord.transcription ? ` [${randomWord.transcription}]` : ''

        try {
          const prompt = getWordPushPrompt(wordStr, transStr, uiLanguage)

          const { parsed } = await callLlmJsonWithRetry<{ message: string }>(
            config.model,
            [{ role: 'user', content: prompt }],
            0.8,
            AbortSignal.timeout(15000),
            config,
            raw => parseLlmJson<{ message: string }>(raw),
          )

          if (parsed && parsed.message) {
            messageBody = `${parsed.message}\n\n${wordStr}${transcriptionStr} — ${transStr}`
          }
        }
        catch {
          console.warn(`[Push] LLM failed for user ${userId}, using fallback.`)
          messageBody = uiLanguage === 'ru'
            ? `Кажется, вы стали забывать это слово:\n\n${wordStr}${transcriptionStr} — ${transStr}`
            : `It seems you're starting to forget this word:\n\n${wordStr}${transcriptionStr} — ${transStr}`
        }
      }
      else {
        try {
          const prompt = getGeneralPushPrompt(uiLanguage)
          const { parsed } = await callLlmJsonWithRetry<{ message: string }>(
            config.model,
            [{ role: 'user', content: prompt }],
            0.8,
            AbortSignal.timeout(10000),
            config,
            raw => parseLlmJson<{ message: string }>(raw),
          )
          if (parsed && parsed.message) {
            messageBody = parsed.message
          }
        }
        catch { }
      }
    }

    const payload = JSON.stringify({
      title: messageTitle,
      body: messageBody,
      url: targetUrl,
      icon: '/logo.png',
      tag: 'insight-book-daily',
    })

    let sentCount = 0
    for (const sub of subs) {
      try {
        const keys = JSON.parse(sub.keys)
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys,
        }, payload)
        sentCount++
      }
      catch (error: unknown) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push] Subscription expired for user ${userId}, deleting...`)
          await db.delete(schema.webPushSubscriptions).where(eq(schema.webPushSubscriptions.id, sub.id))
        }
        else {
          console.error(`[Push] Error sending to user ${userId}:`, error.message)
        }
      }
    }

    if (sentCount > 0) {
      await db.update(schema.users).set({ lastPushSentAt: now.toISOString() }).where(eq(schema.users.id, userId))
    }
  }
  console.log('✅ Push dispatch finished.')
}
