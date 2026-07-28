import { expect, loginAsAdmin, test } from '../fixtures'
import { OMEGA_BOOK, uploadEpubViaApi, ZETA_BOOK } from '../offline.helpers'

/**
 * Путь «Оффлайн режим».
 *
 * ВАЖНО про Service Worker:
 * e2e-инфраструктура поднимает клиент через `vite dev`, а в
 * apps/client/build/cfg/pwa.ts `devOptions.enabled = false` — Service Worker
 * в dev-режиме НЕ регистрируется. Поэтому сценарий «setOffline → перезагрузка
 * страницы → приложение загрузилось из SW-кэша» в этой инфраструктуре
 * невозможен без включения PWA devOptions (вариант (а) из постановки —
 * отклонён, чтобы не менять общий vite-конфиг ради e2e).
 *
 * Выбран вариант (б): оффлайн проверяется на уровне данных — после
 * кэширования книги (book-sync-modal) контент сохраняется в локальные
 * репозитории (localforage/offlineService), и при `context.setOffline(true)`
 * книга открывается из кэша через SPA-навигацию БЕЗ перезагрузки страницы.
 * Это покрывает пользовательский сценарий «ушёл в оффлайн с уже открытым
 * приложением» — именно так оффлайн реализован на уровне данных
 * (book.repository: getPage/getInfo/list сначала смотрят в offlineService).
 *
 * TTS/LLM-анализ в синке отключены (дефолтные опции модалки: только
 * cachePages), поэтому отсутствие LLM в e2e-окружении не мешает синку
 * завершиться успешно.
 */
test.describe('offline', () => {
  test('закэшированная книга читается в оффлайне из локального кэша', async ({ page, context }) => {
    await loginAsAdmin(page)
    await page.waitForURL(url => new URL(url).pathname === '/')

    // Загружаем тестовую книгу через API
    const book = await uploadEpubViaApi(page, ZETA_BOOK)
    expect(book.title).toBe(ZETA_BOOK.title)

    // Открываем страницу книги через библиотеку
    await page.goto('/')
    const card = page.locator('.book-card', { hasText: ZETA_BOOK.title })
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/book/${book.id}$`))

    // Кэшируем книгу: «Кэшировать / Анализ» → «Начать»
    await page.getByRole('button', { name: 'Кэшировать / Анализ' }).click()
    await page.getByRole('button', { name: 'Начать', exact: true }).click()

    // Ждём завершения синка
    await expect(page.getByText('Успешно завершено!')).toBeVisible({ timeout: 60_000 })
    // «Закрыть» в футере диалога (в шапке диалога тоже есть кнопка с aria-label «Закрыть»)
    await page.locator('.dialog-footer').getByRole('button', { name: 'Закрыть' }).click()

    // Открываем книгу онлайн (через «Начать чтение» проставляется currentPage,
    // иначе оффлайн-клик по кнопке упирается в сетевой startReadingPublicBook)
    const readBtn = page.getByRole('button', { name: /Начать чтение|Продолжить чтение/ })
    await readBtn.click()
    await expect(page).toHaveURL(/\/reader/)
    await expect(page.locator('.reader-content').first()).toContainText(ZETA_BOOK.marker, { timeout: 15_000 })

    // Уходим в оффлайн (без перезагрузки — см. комментарий к describe)
    await context.setOffline(true)

    // SPA-навигация оффлайн: ридер → инфо о книге → библиотека → снова книга
    await page.locator('.reader-header button').first().click()
    await expect(page).toHaveURL(new RegExp(`/book/${book.id}$`))

    await page.locator('.page-header button').first().click()
    await expect(page).toHaveURL(url => new URL(url).pathname === '/')
    const offlineCard = page.locator('.book-card', { hasText: ZETA_BOOK.title })
    await expect(offlineCard).toBeVisible()

    await offlineCard.click()
    await expect(page).toHaveURL(new RegExp(`/book/${book.id}$`))
    await expect(page.getByRole('heading', { name: ZETA_BOOK.title })).toBeVisible()

    // Открываем книгу — контент рендерится из оффлайн-кэша
    await page.getByRole('button', { name: /Начать чтение|Продолжить чтение/ }).click()
    await expect(page).toHaveURL(/\/reader/)
    await expect(page.locator('.reader-content').first()).toContainText(ZETA_BOOK.marker, { timeout: 15_000 })
  })

  test('некэшированная страница в оффлайне показывает ошибку, а не контент', async ({ page, context }) => {
    await loginAsAdmin(page)
    await page.waitForURL(url => new URL(url).pathname === '/')

    // Книга из 2 страниц (контент > PAGE_SIZE_CHARS на сервере)
    const book = await uploadEpubViaApi(page, OMEGA_BOOK)

    await page.goto('/')
    const card = page.locator('.book-card', { hasText: OMEGA_BOOK.title })
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/book/${book.id}$`))

    // Открываем страницу 1 онлайн (она попадёт в кэш при чтении), синк НЕ запускаем
    await page.getByRole('button', { name: /Начать чтение|Продолжить чтение/ }).click()
    await expect(page).toHaveURL(/\/reader/)
    await expect(page.locator('.reader-content').first()).toContainText(OMEGA_BOOK.marker, { timeout: 15_000 })

    // Оффлайн → переход на страницу 2, которая не была закэширована
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Вперед' }).click()

    // Пользователь видит понятную ошибку, контент 2-й страницы не отрендерен
    // (рядом может быть и общий тост «Проверьте подключение к интернету»)
    await expect(page.locator('.kit-toast-item--error', { hasText: 'Эта страница недоступна в оффлайн-режиме' }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.reader-content').first()).not.toContainText(OMEGA_BOOK.markerPage2!)
  })
})
