import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * Изоляция данных: на каждый прогон создаётся свежая временная директория
 * с чистой SQLite БД, каталогом, словарями и загрузками.
 * Сервер сам применяет миграции и сидит admin/admin (AUTH_MODE=multi).
 */
const E2E_TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-book-e2e-'))

// Порты отличаются от dev-дефолтов (4445/5173), чтобы не конфликтовать
// с локально запущенным dev-окружением.
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT || 4455)
const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT || 5273)

const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`
// vite dev слушает только localhost (::1), поэтому не 127.0.0.1
const CLIENT_URL = `http://localhost:${CLIENT_PORT}`

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1, // общий сервер + rate-limit на /api/auth/login (5 req/min)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // API-сервер: Bun + Elysia + SQLite, чистая БД на каждый прогон
      command: 'bun src/index.ts',
      cwd: path.resolve(E2E_DIR, '../apps/server'),
      // NB: /health отдаёт 500 из-за глобального error-handler роутеров,
      // поэтому readiness проверяем публичным /api/auth/me (200).
      url: `${SERVER_URL}/api/auth/me`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(SERVER_PORT),
        AUTH_MODE: 'multi',
        JWT_SECRET: 'e2e-test-secret',
        DB_PATH: path.join(E2E_TMP_DIR, 'insight-book.sqlite'),
        CATALOG_DB_PATH: path.join(E2E_TMP_DIR, 'catalog.sqlite'),
        DICTS_PATH: path.join(E2E_TMP_DIR, 'dicts'),
        UPLOADS_PATH: path.join(E2E_TMP_DIR, 'uploads'),
        FRONTEND_URL: CLIENT_URL,
      },
    },
    {
      // Клиент: vite dev (быстрый старт без полной сборки с module federation + PWA).
      // VITE_API_URL='/' заставляет клиента ходить на /api того же origin,
      // запросы уходят через vite proxy на e2e-сервер (без CORS).
      command: `bunx vite --config build/vite.config.web.ts --port ${CLIENT_PORT} --strictPort`,
      cwd: path.resolve(E2E_DIR, '../apps/client'),
      url: CLIENT_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_URL: '/',
        API_PROXY_TARGET: SERVER_URL,
      },
    },
  ],
})
