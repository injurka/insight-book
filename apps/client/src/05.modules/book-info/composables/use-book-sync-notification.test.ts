import type { SyncNotificationProgress, SyncNotificationSelection } from '~/05.modules/library/model'
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '~/01.shared/locales/en.json'
import ru from '~/01.shared/locales/ru.json'
import zh from '~/01.shared/locales/zh.json'
import { useBookSyncNotification } from './use-book-sync-notification'

const progress: SyncNotificationProgress = {
  phase: 'audio',
  currentPage: 7,
  pagesDone: 6,
  pagesTotal: 536,
  sentencesDone: 125,
  sentencesFromCache: 100,
  wordsDone: 450,
  wordsFromCache: 400,
  ttsDone: 82,
  ttsFromCache: 65,
}

function renderNotification(locale: string, selection: SyncNotificationSelection) {
  let body = ''
  let title = ''
  const app = createApp({
    setup() {
      const options = useBookSyncNotification().createNotificationOptions('Book title', selection)
      title = options.title
      body = options.formatProgress(progress)

      return () => null
    },
  })

  app.use(createI18n({ legacy: false, locale, messages: { en, ru, zh } }))
  app.mount(document.createElement('div'))
  app.unmount()

  return { title, body }
}

describe('book sync notification content', () => {
  it('shows the book, active stage and selected tasks without inventing book-wide word totals', () => {
    const notification = renderNotification('ru', {
      analyzeSentences: true,
      analyzeWords: false,
      ttsSentences: true,
      ttsWords: false,
    })

    expect(notification.title).toBe('Book title')
    expect(notification.body).toContain('Подготовка озвучки · страница 7 из 536')
    expect(notification.body).toContain('Обработано страниц: 6 / 536')
    expect(notification.body).toContain('Предложения: 125 · из кэша 100')
    expect(notification.body).toContain('Аудио: 82 · из кэша 65')
    expect(notification.body).not.toContain('Слова:')
    expect(notification.body.split('\n')).toHaveLength(4)
  })

  it.each([
    ['en', 'Preparing audio · page 7 of 536', 'Words: 450 · cached 400'],
    ['zh', '正在准备语音 · 第 7 / 536 页', '词语：450 · 缓存 400'],
  ])('localizes stage and task counters in %s', (locale, stage, words) => {
    const notification = renderNotification(locale, {
      analyzeSentences: false,
      analyzeWords: true,
      ttsSentences: false,
      ttsWords: true,
    })

    expect(notification.body).toContain(stage)
    expect(notification.body).toContain(words)
    expect(notification.body).not.toContain('bookInfo.')
  })
})
