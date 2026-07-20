import * as admin from 'firebase-admin'
import { getMessaging } from 'firebase-admin/messaging'
import webpush from 'web-push'
import { z } from 'zod'
import { getAiConfig } from '~/utils/ai-config'
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '../config'
import { getGeneralPushPrompt, getWordPushPrompt } from '../prompts'

import { pushRepository } from '../repositories/push.repository'
import { callLlmStructured } from '../utils/llm-api'
import { logger } from '../utils/logger'
import { checkTokenLimit } from './limits.service'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp()
  }
  else {
    // Attempt default initialization if service account is provided in environment implicitly
    admin.initializeApp()
  }
}
catch {
  // Ignore already initialized or missing credentials at startup
}

function getSeededRandom(seedStr: string) {
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0
  }
  const x = Math.sin(hash) * 10000
  return x - Math.floor(x)
}

function getTargetUtcTimesForDate(dateObj: Date, user: { id: number, timezone?: string | null, pushTimeStart?: string | null, pushTimeEnd?: string | null, pushCount?: number | null }): number[] {
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
      hourCycle: 'h23', // Гарантирует часы от 00 до 23 вместо '24'
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
      hourCycle: 'h23',
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

function shouldSendPush(user: { id: number, pushCount?: number | null, lastPushSentAt?: string | null, timezone?: string | null, pushTimeStart?: string | null, pushTimeEnd?: string | null }, now: Date): boolean {
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
    logger.info('[Push] VAPID keys not set. Skipping push dispatch.')
    return
  }

  logger.info('🚀 Starting push notifications dispatch...')
  const [webSubscriptions, fcmSubscriptions] = await Promise.all([
    pushRepository.getAllWebSubscriptionsWithUsers(),
    pushRepository.getAllFcmSubscriptionsWithUsers(),
  ])

  if (!webSubscriptions.length && !fcmSubscriptions.length) {
    logger.info('[Push] No active subscriptions found.')
    return
  }

  const userSubsMap = new Map<number, { user: { id: number, pushCount?: number | null, lastPushSentAt?: string | null, timezone?: string | null, pushTimeStart?: string | null, pushTimeEnd?: string | null, uiLanguage?: string | null, pushTargetDeckId?: number | null }, web: typeof webSubscriptions, fcm: typeof fcmSubscriptions }>()

  webSubscriptions.forEach((sub) => {
    if (!userSubsMap.has(sub.userId)) {
      userSubsMap.set(sub.userId, { user: sub.user, web: [], fcm: [] })
    }
    userSubsMap.get(sub.userId)!.web.push(sub)
  })

  fcmSubscriptions.forEach((sub) => {
    if (!userSubsMap.has(sub.userId)) {
      userSubsMap.set(sub.userId, { user: sub.user, web: [], fcm: [] })
    }
    userSubsMap.get(sub.userId)!.fcm.push(sub)
  })

  const now = new Date()
  const nowIso = now.toISOString()

  const aiConfig = getAiConfig()
  const config = { url: aiConfig.llm.url, key: aiConfig.llm.key, model: aiConfig.llm.model }

  // Асинхронный батчинг по 10 пользователей за раз, чтобы избежать блокировки (Bottle-neck)
  const userEntries = Array.from(userSubsMap.entries())
  const batchSize = 10

  for (let i = 0; i < userEntries.length; i += batchSize) {
    const batch = userEntries.slice(i, i + batchSize)

    await Promise.all(batch.map(async ([userId, data]) => {
      const user = data.user
      const uiLanguage = user.uiLanguage || 'ru'

      if (!customMessage && !shouldSendPush(user, now)) {
        return
      }

      const messageTitle = 'InsightBook'
      let messageBody = customMessage || 'Время изучать языки!'
      let targetUrl = '/'
      let wordStrForTag = ''

      if (!customMessage) {
        const randomWord = await pushRepository.getRandomWordForPush(userId, nowIso, user.pushTargetDeckId)

        if (randomWord) {
          targetUrl = `/dictionary?word=${encodeURIComponent(randomWord.word)}`
          wordStrForTag = randomWord.word
          const wordStr = randomWord.word
          const transStr = randomWord.translation?.split(/<br>|,|;/)[0].replace(/<[^>]+>/g, '').trim() || ''
          const transcriptionStr = randomWord.transcription ? ` [${randomWord.transcription}]` : ''

          try {
            await checkTokenLimit(userId) // Критично: проверяем лимиты перед LLM
            const prompt = getWordPushPrompt(wordStr, transStr, uiLanguage)

            const { parsed } = await callLlmStructured<{ message: string }>(
              config.model,
              [{ role: 'user', content: prompt }],
              0.8,
              AbortSignal.timeout(15000),
              config,
              z.object({ message: z.string() }),
            )

            if (parsed && parsed.message) {
              messageBody = `${parsed.message}\n\n${wordStr}${transcriptionStr} — ${transStr}`
            }
          }
          catch {
            logger.warn(`[Push] LLM failed/limit reached for user ${userId}, using fallback.`)
            messageBody = uiLanguage === 'ru'
              ? `Пора повторить слово:\n\n${wordStr}${transcriptionStr} — ${transStr}`
              : `Time to review this word:\n\n${wordStr}${transcriptionStr} — ${transStr}`
          }
        }
        else {
          try {
            await checkTokenLimit(userId)
            const prompt = getGeneralPushPrompt(uiLanguage)
            const { parsed } = await callLlmStructured<{ message: string }>(
              config.model,
              [{ role: 'user', content: prompt }],
              0.8,
              AbortSignal.timeout(10000),
              config,
              z.object({ message: z.string() }),
            )
            if (parsed && parsed.message) {
              messageBody = parsed.message
            }
          }
          catch {
            messageBody = uiLanguage === 'ru' ? 'Самое время немного позаниматься!' : 'It is a good time to study!'
          }
        }
      }

      const payload = JSON.stringify({
        title: messageTitle,
        body: messageBody,
        url: targetUrl,
        icon: '/logo.png',
        tag: `insight-book-daily-${wordStrForTag || Date.now()}`, // Уникальный тег для каждого слова
      })

      let sentCount = 0

      for (const sub of data.web) {
        try {
          const keys = JSON.parse(sub.keys)
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys,
          }, payload)
          sentCount++
        }
        catch (error: unknown) {
          if ((error as { statusCode?: number }).statusCode === 410 || (error as { statusCode?: number }).statusCode === 404) {
            logger.info(`[Push] Subscription expired for user ${userId}, deleting...`)
            await pushRepository.deleteWebSubscriptionById(sub.id)
          }
          else {
            logger.error(error as Error, `[Push] Error sending to user ${userId}:`)
          }
        }
      }

      for (const sub of data.fcm) {
        try {
          await getMessaging().send({
            token: sub.token,
            notification: {
              title: messageTitle,
              body: messageBody,
            },
            data: {
              url: targetUrl,
            },
            android: {
              notification: {
                icon: 'ic_notification',
                color: '#fde047',
                tag: `insight-book-daily-${wordStrForTag || Date.now()}`,
              },
            },
          })
          sentCount++
        }
        catch (error: unknown) {
          const fcmError = error as { code?: string, message?: string }
          if (fcmError.code === 'messaging/registration-token-not-registered' || fcmError.code === 'messaging/invalid-registration-token') {
            logger.info(`[FCM] Token expired for user ${userId}, deleting...`)
            await pushRepository.deleteFcmSubscriptionById(sub.id)
          }
          else {
            logger.error(fcmError.message, `[FCM] Error sending to user ${userId}:`)
          }
        }
      }

      if (sentCount > 0) {
        await pushRepository.updateLastPushSentAt(userId, now.toISOString())
      }
    }))
  }
  logger.info('✅ Push dispatch finished.')
}

export const pushService = {
  async getVapidKey() {
    return { publicKey: VAPID_PUBLIC_KEY }
  },

  async subscribeWebPush(userId: number, endpoint: string, keys: Record<string, string>) {
    if (!endpoint || !keys)
      throw new Error('Invalid subscription object')
    await pushRepository.upsertWebSubscription(userId, endpoint, keys)
    return { success: true }
  },

  async unsubscribeWebPush(userId: number, endpoint: string) {
    if (endpoint) {
      await pushRepository.deleteWebSubscription(userId, endpoint)
    }
    return { success: true }
  },

  async subscribeFcm(userId: number, token: string) {
    if (!token)
      throw new Error('Invalid FCM token')
    await pushRepository.upsertFcmSubscription(userId, token)
    return { success: true }
  },

  async unsubscribeFcm(userId: number, token: string) {
    if (token) {
      await pushRepository.deleteFcmSubscription(userId, token)
    }
    return { success: true }
  },

  async updatePushSettings(userId: number, settings: { targetDeckId?: number | 'all' | null, timeStart?: string, timeEnd?: string, timezone?: string, uiLanguage?: string, pushCount?: number }) {
    const { targetDeckId, timeStart, timeEnd, timezone, uiLanguage, pushCount } = settings

    await pushRepository.updatePushSettings(userId, {
      pushTargetDeckId: targetDeckId === 'all' || !targetDeckId ? null : targetDeckId,
      pushTimeStart: timeStart || '10:00',
      pushTimeEnd: timeEnd || '21:00',
      pushCount: typeof pushCount === 'number' ? pushCount : 1,
      timezone: timezone || 'UTC',
      uiLanguage: uiLanguage || 'ru',
    })
    return { success: true }
  },
}
