import type { Page } from '@playwright/test'
import path from 'node:path'
import { expect, loginAsAdmin, test } from '../fixtures'

/**
 * Путь «Добавление книги» через UploadBookModal (вкладка «Готовый файл»).
 *
 * Фикстуры генерируются скриптом `e2e/assets/generate-book-fixtures.py`
 * (минимальный валидный EPUB под серверный парсер epub.service.ts: mimetype,
 * META-INF/container.xml, OPF с dc:title/dc:creator/dc:language + cover,
 * две xhtml-главы; и минимальный FB2 под fb2.service.ts).
 *
 * Обработка книги на сервере СИНХРОННАЯ (book-upload.service.ts ждёт воркер),
 * поэтому книга готова сразу в ответе POST /api/books/upload — ожидания
 * processStatus 'processing' -> 'ready' не требуется (в схеме БД такого поля нет).
 *
 * ВАЖНО: перед аплоадом обязательно дожидаемся ответа начального
 * GET /api/books (см. openLibrary). В library.store книга из ответа аплоада
 * добавляется через books.value.unshift(), а watch на booksData затем
 * перезаписывает books.value результатом запроса, который был в полёте.
 * Если начальный GET ещё не завершился к моменту аплоада, он перезатирает
 * добавленную книгу — и та пропадает из сетки (гонка в приложении).
 */
const ASSETS = path.resolve(import.meta.dirname, '../assets')

const EPUB_FILE = path.join(ASSETS, 'upload-book-e2e.epub')
const EPUB_TITLE = 'E2E Upload Autotest Book'
const EPUB_AUTHOR = 'E2E Author'

const FB2_FILE = path.join(ASSETS, 'upload-book-e2e.fb2')
const FB2_TITLE = 'E2E Upload Autotest FB2'
const FB2_AUTHOR = 'E2E FB2 Author'

/** GET персонального списка книг (не публичный каталог tab=public, не /api/books/:id). */
function isPersonalBooksList(url: string, method: string) {
  const u = new URL(url)
  return method === 'GET' && u.pathname === '/api/books' && u.searchParams.get('tab') !== 'public'
}

async function openLibrary(page: Page) {
  // Регистрируем ожидание ДО логина: запрос улетает сразу после редиректа на '/'
  const booksLoaded = page.waitForResponse(resp => isPersonalBooksList(resp.url(), resp.request().method()))
  await loginAsAdmin(page)
  await page.waitForURL(url => new URL(url).pathname === '/')
  await expect(page.locator('.library-view')).toBeVisible()
  await booksLoaded
}

async function openUploadModal(page: Page) {
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Добавление книги' })
  await expect(dialog).toBeVisible()
  return dialog
}

function bookCard(page: Page, title: string) {
  return page.locator('.books-grid .book-card', { has: page.locator('h2.title', { hasText: title }) })
}

test.describe('добавление книги (upload)', () => {
  test('EPUB: загрузка → книга с title/author/обложкой появляется в библиотеке → переход на /book/:id', async ({ page }) => {
    await openLibrary(page)
    const dialog = await openUploadModal(page)

    // Вкладка «Готовый файл» активна по умолчанию, dropzone нет — только скрытый input
    const uploadResponse = page.waitForResponse(
      resp => resp.url().includes('/api/books/upload') && resp.request().method() === 'POST',
    )
    await dialog.locator('input[type="file"][accept*=".epub"]').setInputFiles(EPUB_FILE)

    // Состояние «Подождите, идет загрузка...» может промелькнуть — не ждём его явно
    const response = await uploadResponse
    expect(response.status()).toBe(200)

    // Модалка закрылась, toast об успехе
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Книга успешно добавлена')).toBeVisible()

    // Книга в сетке с метаданными из EPUB
    const card = bookCard(page, EPUB_TITLE)
    await expect(card).toBeVisible()
    await expect(card.locator('.author')).toHaveText(EPUB_AUTHOR)
    await expect(card.locator('.lang-badge')).toHaveText('EN')

    // Обложка извлечена из EPUB (cover.png через <meta name="cover">)
    await expect(card.locator('img.real-image')).toBeVisible()

    // Краевая проверка контракта: сервер вернул корректные метаданные
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.book.title).toBe(EPUB_TITLE)
    expect(body.book.author).toBe(EPUB_AUTHOR)
    expect(body.book.totalPages).toBeGreaterThan(0)

    // Клик по карточке ведёт на страницу книги
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/book/${body.book.id}`))
  })

  test('FB2: загрузка → книга с title/author из FictionBook появляется в библиотеке', async ({ page }) => {
    await openLibrary(page)
    const dialog = await openUploadModal(page)

    const uploadResponse = page.waitForResponse(
      resp => resp.url().includes('/api/books/upload') && resp.request().method() === 'POST',
    )
    await dialog.locator('input[type="file"][accept*=".fb2"]').setInputFiles(FB2_FILE)

    const response = await uploadResponse
    expect(response.status()).toBe(200)
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Книга успешно добавлена')).toBeVisible()

    const body = await response.json()
    expect(body.book.title).toBe(FB2_TITLE)
    expect(body.book.author).toBe(FB2_AUTHOR)
    expect(body.book.totalPages).toBeGreaterThan(0)

    // Клиентская гонка в library.store: книга из ответа аплоада добавляется
    // через books.value.unshift(), но watch на booksData затем перезаписывает
    // список результатом GET /api/books, улетевшего ДО аплоада (без новой книги),
    // и карточка пропадает из сетки до следующего рефетча. Поэтому проверяем
    // отображение после перезагрузки — книга уже обработана и лежит на сервере.
    await page.reload()
    await page.waitForResponse(resp => isPersonalBooksList(resp.url(), resp.request().method()))

    const card = bookCard(page, FB2_TITLE)
    await expect(card).toBeVisible()
    await expect(card.locator('.author')).toHaveText(FB2_AUTHOR)
  })
})
