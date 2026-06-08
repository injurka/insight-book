/* eslint-disable no-console */
import { and, asc, eq, lte } from 'drizzle-orm'
import webpush from 'web-push'
import { LLM_API_KEY, LLM_API_URL, LLM_MODEL, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../config'
import { db } from '../db'
import * as schema from '../db/schema'
import { getGeneralPushPrompt, getWordPushPrompt } from '../prompts'
import { parseLlmJson } from '../utils/helpers'
import { callLlmApi } from '../utils/llm-api'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
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

  // Группируем подписки по юзерам
  const userSubsMap = new Map<number, typeof subscriptions>()
  subscriptions.forEach((sub) => {
    const arr = userSubsMap.get(sub.userId) || []
    arr.push(sub)
    userSubsMap.set(sub.userId, arr)
  })

  const now = new Date().toISOString()
  const config = { url: LLM_API_URL, key: LLM_API_KEY, model: LLM_MODEL }

  for (const [userId, subs] of userSubsMap.entries()) {
    // eslint-disable-next-line prefer-const
    let messageTitle = 'InsightBook'
    let messageBody = customMessage || 'Время изучать языки!'
    let targetUrl = '/'

    if (!customMessage) {
      const hardestWord = await db.query.userDictionary.findFirst({
        where: and(
          eq(schema.userDictionary.userId, userId),
          lte(schema.userDictionary.nextReviewDate, now),
        ),
        orderBy: [asc(schema.userDictionary.easeFactor)],
      })

      if (hardestWord) {
        targetUrl = '/dictionary'
        const wordStr = hardestWord.word
        const transStr = hardestWord.translation?.split(/<br>|,|;/)[0].replace(/<[^>]+>/g, '').trim() || ''
        const transcriptionStr = hardestWord.transcription ? ` [${hardestWord.transcription}]` : ''

        try {
          const prompt = getWordPushPrompt(wordStr, transStr)

          const response = await callLlmApi(
            config.model,
            [{ role: 'user', content: prompt }],
            0.8,
            AbortSignal.timeout(15000),
            config,
          )

          const parsed = parseLlmJson<{ message: string }>(response.text)

          if (parsed && parsed.message) {
            messageBody = `${parsed.message}\n\n${wordStr}${transcriptionStr} — ${transStr}`
          }
        }
        catch {
          console.warn(`[Push] LLM failed for user ${userId}, using fallback.`)
          messageBody = `Кажется, вы стали забывать это слово:\n\n${wordStr}${transcriptionStr} — ${transStr}`
        }
      }
      else {
        try {
          const prompt = getGeneralPushPrompt()
          const response = await callLlmApi(config.model, [{ role: 'user', content: prompt }], 0.8, AbortSignal.timeout(10000), config)
          const parsed = parseLlmJson<{ message: string }>(response.text)
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
    })

    // Рассылаем на все девайсы юзера
    for (const sub of subs) {
      try {
        const keys = JSON.parse(sub.keys)
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys,
        }, payload)
      }
      catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Push] Subscription expired for user ${userId}, deleting...`)
          await db.delete(schema.webPushSubscriptions).where(eq(schema.webPushSubscriptions.id, sub.id))
        }
        else {
          console.error(`[Push] Error sending to user ${userId}:`, error.message)
        }
      }
    }
  }
  console.log('✅ Push dispatch finished.')
}
