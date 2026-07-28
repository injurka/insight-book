import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

export interface UploadedBook {
  id: number
  title: string
}

export const ZETA_BOOK = {
  fixture: fileURLToPath(new URL('./fixtures/offline-zeta.epub', import.meta.url)),
  filename: 'offline-zeta.epub',
  title: 'E2E Offline Zeta Book',
  marker: 'Zeta offline marker alpha',
}

export const OMEGA_BOOK = {
  fixture: fileURLToPath(new URL('./fixtures/offline-omega.epub', import.meta.url)),
  filename: 'offline-omega.epub',
  title: 'E2E Offline Omega Book',
  marker: 'Omega offline marker alpha',
  // маркер на 2-й странице (контент > PAGE_SIZE_CHARS=1500, страница 2 не кэшируется при обычном чтении стр. 1)
  markerPage2: 'Omega offline marker omega',
}

export interface BookFixture {
  fixture: string
  filename: string
  title: string
  marker: string
  markerPage2?: string
}

/**
 * Загружает минимальный EPUB через API (POST /api/books/upload),
 * используя токен залогиненного в page пользователя.
 * Возвращает id и title созданной книги.
 */
export async function uploadEpubViaApi(page: Page, book: BookFixture): Promise<UploadedBook> {
  const token = await page.evaluate(() => localStorage.getItem('insight_token'))
  if (!token)
    throw new Error('Нет токена — сначала выполните loginAsAdmin(page)')

  const buffer = readFileSync(book.fixture)
  const res = await page.request.post('/api/books/upload', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: book.filename,
        mimeType: 'application/epub+zip',
        buffer,
      },
    },
  })

  if (!res.ok())
    throw new Error(`Upload failed: ${res.status()} ${await res.text()}`)

  const body = await res.json() as { success: boolean, book: { id: number, title: string } }
  return { id: body.book.id, title: body.book.title }
}
