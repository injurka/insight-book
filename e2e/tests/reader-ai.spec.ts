import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { E2E_SERVER_URL, uploadBookViaApi } from './reader-ai.helpers'

/**
 * Путь «Чтение и ИИ-анализ» (киллер-фича).
 *
 * Реальный LLM недоступен, поэтому перехватываем POST /api/books/:id/analyze
 * (единственная точка, через которую ридер запрашивает ИИ-перевод слова/предложения)
 * и возвращаем реалистичные фикстуры LlmAnalysis. Кэш-проверки (cache-check) и
 * сохранение (dictionary/highlights) идут через настоящий сервер.
 *
 * NB: в задании упоминался путь «SelectionTooltip → Перевести с ИИ → QuoteModal →
 * словарь», но реальная разметка устроена иначе:
 * - «Перевести с ИИ» живёт в WordPopover (клик по слову), сохранение в словарь —
 *   через AddEditWordDialog (звезда);
 * - SelectionTooltip имеет кнопку «Разбор предложения» → сайдбар SentenceAnalysis;
 * - QuoteModal сохраняет цитату в блокнот (highlights), а не в словарь — открывается
 *   из сайдбара по кнопке-закладке.
 * Тесты ниже покрывают эти реальные пути.
 */

const BOOK_TITLE = 'E2E Reader AI Book'

let bookId: number
let adminToken: string

/** Реалистичный ответ LLM в формате LlmAnalysis, зависящий от запрошенного текста */
function mockAnalyzeRoute(page: Page) {
  return page.route(/\/api\/books\/\d+\/analyze(\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as { sentence?: string, type?: 'sentence' | 'word' }
    const text = body.sentence || ''

    if (body.type === 'word') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transcription: 'kwɪkˈsɒtɪk',
          translation: `RU-WORD: ${text} — квихотский, непрактично-романтичный`,
          grammarRules: [],
          vocabulary: [
            { word: text, transcription: 'kwɪkˈsɒtɪk', meaning: 'квихотский', usageInContext: '' },
          ],
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcription: '',
        translation: `RU-SENT: ${text}`,
        grammarRules: [
          {
            pattern: 'Past Simple',
            explanation: 'Действие завершилось в прошлом.',
            example: 'His plan surprised everyone.',
          },
        ],
        vocabulary: [
          { word: 'quixotic', transcription: 'kwɪkˈsɒtɪk', meaning: 'квихотский', usageInContext: text },
        ],
      }),
    })
  })
}

async function apiGet(request: any, token: string, path: string) {
  const res = await request.get(`${E2E_SERVER_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

test.describe('reader-ai: чтение и ИИ-анализ', () => {
  test.beforeAll(async ({ request }) => {
    const { book, token } = await uploadBookViaApi(request, BOOK_TITLE)
    bookId = book.id
    adminToken = token
  })

  test.beforeEach(async ({ page }) => {
    await mockAnalyzeRoute(page)
    // Авторизация токеном из beforeAll (UI-логин покрыт в auth.spec.ts;
    // так избегаем rate-limit 5 req/min на /api/auth/login и флаков long-press формы).
    // Клиент восстанавливает сессию по insight_token через /api/auth/me (auth.store.syncUser).
    await page.addInitScript((token) => {
      localStorage.setItem('insight_token', token)
    }, adminToken)
    await page.goto(`/reader?bookId=${bookId}`)
    // ждём готовности страницы ридера: токенизированные слова
    await expect(page.locator('.reader-content .word').first()).toBeVisible()
  })

  test('клик по слову → WordPopover → «Перевести с ИИ» → сохранение в словарь', async ({ page, request }) => {
    // 1. Клик по слову в ридере
    await page.locator('.reader-content .word[data-word="quixotic"]').first().click()
    const popover = page.locator('.word-popover')
    await expect(popover).toBeVisible()

    // 2. По умолчанию translationPriority=llm — ИИ-перевод подгружается сам (мок /analyze)
    await expect(popover.locator('.translation')).toContainText('RU-WORD: quixotic')

    // 3. Явно дёргаем кнопку «Перевести с ИИ» (робот): off → on
    const aiToggle = popover.locator('.popover-actions button.kit-btn').nth(2)
    await aiToggle.click()
    await expect(popover.locator('.translation')).not.toContainText('RU-WORD: quixotic')
    await aiToggle.click()
    await expect(popover.locator('.translation')).toContainText('RU-WORD: quixotic')

    // 4. Сохранение в словарь (звезда) → диалог «Добавить в словарь»
    await popover.locator('.popover-actions button.kit-btn').nth(3).click()
    const dialog = page.locator('.dialog-root', { hasText: 'Добавить в словарь' })
    await expect(dialog.locator('h3.dict-word')).toHaveText('quixotic')
    // AI-перевод подставлен в карточку
    await expect(dialog.locator('.preview-box').first()).toContainText('RU-WORD: quixotic')

    await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(dialog).toBeHidden()

    // 5. Проверяем, что слово реально сохранилось — через API сервера
    await expect
      .poll(async () => {
        const dict = await apiGet(request, adminToken, '/api/dictionary')
        return dict.some((item: any) => item.word === 'quixotic')
      })
      .toBe(true)
  })

  test('выделение фразы → SelectionTooltip → «Разбор предложения» → сайдбар → QuoteModal сохраняет цитату', async ({ page, request }) => {
    // 1. Программно выделяем фразу «ancient book» внутри .js-tooltip-selectable
    //    (drag-выделение мышью по span.word нестабильно; selectionchange — тот же триггер,
    //    что и у реального пользователя)
    await page.evaluate(() => {
      const sentence = Array.from(document.querySelectorAll('.reader-content .sentence'))
        .find(el => el.textContent?.includes('ancient book')) as HTMLElement
      const range = document.createRange()
      range.selectNodeContents(sentence)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })

    // 2. Появился SelectionTooltip → клик «Разбор предложения»
    const tooltip = page.locator('.selection-tooltip')
    await expect(tooltip).toBeVisible()
    await tooltip.getByRole('button', { name: 'Разбор предложения' }).click()

    // 3. Сайдбар SentenceAnalysis: перевод и грамматика из мок-ответа
    await expect(page.locator('.translation-text')).toContainText('RU-SENT:')
    await expect(page.locator('.grammar-card .rule-pattern').first()).toHaveText('Past Simple')
    await expect(page.locator('.grammar-card .rule-exp').first()).toContainText('в прошлом')

    // 4. Кнопка-закладка в сайдбаре → QuoteModal → сохранить цитату
    await page.locator('.sentence-actions .action-btn').nth(1).click()
    const quoteModal = page.locator('.save-quote-content')
    await expect(quoteModal).toBeVisible()

    // NB: сервер валидирует note как Optional(String) и отклоняет null (422),
    // а клиент при пустой заметке шлёт `note || null` — поэтому в happy-path
    // заполняем заметку, как это сделал бы пользователь.
    await quoteModal.getByRole('button', { name: /дополнительные поля/ }).click()
    await quoteModal.locator('textarea.note-textarea').fill('E2E-заметка к цитате')

    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(quoteModal).toBeHidden()

    // 5. Цитата сохранена на сервере
    await expect
      .poll(async () => {
        const highlights = await apiGet(request, adminToken, `/api/highlights?bookId=${bookId}`)
        return highlights.some((h: any) => String(h.text).includes('ancient book'))
      })
      .toBe(true)
  })

  test('long-press по предложению → сайдбар SentenceAnalysis с переводом и грамматикой', async ({ page }) => {
    const sentence = page.locator('.reader-content .sentence', { hasText: 'luminous moon' })
    // Скроллим ридер вниз: верхние строки перекрыты плавающей шапкой ридера,
    // и mousedown уходил бы в шапку, а не в .sentence. Заодно шапка прячется при скролле.
    await page.locator('.reader-view').evaluate(el => el.scrollTo({ top: 200 }))
    // Long-press: handleSentenceAnalysis срабатывает по таймеру 500ms после pointerdown.
    // Координаты берём у слова внутри предложения: центр самой .sentence может
    // попасть в межстрочный зазор <p>, и mousedown уйдёт мимо .sentence.
    const word = sentence.locator('.word[data-word="luminous"]')
    const box = await word.boundingBox()
    if (!box)
      throw new Error('Sentence word not found in reader')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(700)
    await page.mouse.up()

    // Сайдбар с результатом анализа (мок /analyze)
    await expect(page.locator('.original-sentence')).toContainText('luminous moon')
    await expect(page.locator('.translation-text')).toContainText('RU-SENT: The luminous moon')
    await expect(page.locator('.grammar-card .rule-pattern').first()).toHaveText('Past Simple')
  })
})
