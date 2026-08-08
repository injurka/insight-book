# E2E-тесты (Playwright)

E2E-тесты живут в корневой директории `e2e/`, отдельно от vitest (`bun run test` их не подхватывает — vitest ограничен `apps/*/src`).

## Запуск

```bash
bun run test:e2e         # headless-прогон
bun run test:e2e:ui      # Playwright UI mode
bun run test:e2e:headed  # headed-режим
```

Playwright сам поднимает оба сервиса через `webServer` (см. `playwright.config.ts`):

- **API-сервер** (`apps/server`, `bun src/index.ts`) на порту **4455**;
- **клиент** (`apps/client`, `vite dev`) на порту **5273**.

Порты намеренно отличаются от dev-дефолтов (4445/5173), чтобы не конфликтовать с локально запущенным dev-окружением; переопределяются через `E2E_SERVER_PORT` / `E2E_CLIENT_PORT`. Цель прокси `/api` в vite-конфиге переопределяется через `API_PROXY_TARGET` (по умолчанию — прежний `http://localhost:4445`).

## Изоляция данных

На каждый прогон создаётся свежая временная директория (`os.tmpdir()/insight-book-e2e-*`) с чистыми `DB_PATH`, `CATALOG_DB_PATH`, `UPLOADS_PATH`. Сервер при старте сам применяет миграции и сидит пользователя `admin/admin` (`AUTH_MODE=multi`, `JWT_SECRET=e2e-test-secret`). `reuseExistingServer: false` — Playwright всегда стартует свои экземпляры и гасит их после прогона.

## Решения

- **dev, а не preview**: клиент запускается через `vite dev` — быстрый старт без полной сборки (module federation + PWA собираются долго), а прокси `/api` уже настроен в vite-конфиге. Клиент ходит на API относительными путями (`VITE_API_URL='/'`), запросы уходят через vite proxy на e2e-сервер — без CORS.
- **workers: 1** — общий сервер и rate-limit на `/api/auth/login` (5 запросов/мин).

## Как писать новые тесты

Используйте `test`/`expect` из `e2e/fixtures.ts` (не из `@playwright/test` напрямую):

```ts
import { expect, loginAsAdmin, test } from '../fixtures'

test('мой тест', async ({ page }) => {
  await loginAsAdmin(page) // логин admin/admin через UI
  // ...
})
```

Фикстура `context` автоматически выставляет `insight_onboarding_completed=true` в localStorage, иначе router guard клиента редиректит на `/onboarding`.

Нюансы разметки:

- форма логина по паролю скрыта — показывается по long-press (1 с) или тройному клику на бейдже `.auth-badge` (учтено в `loginAsAdmin`);
- селекторы — role/text/placeholder по ru-локали (дефолтный язык приложения).

Артефакты (`playwright-report/`, `test-results/`) в `.gitignore`. Trace/video/скриншоты сохраняются только при падении; html-отчёт: `bunx playwright show-report e2e/playwright-report`.
