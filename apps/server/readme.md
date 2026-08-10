# Insight Book — Server

Бэкенд приложения Insight Book: REST API для чтения книг, словаря, ИИ-анализа текста (LLM), TTS/OCR и пользовательских данных.

## Технологический стек

- **Runtime:** Bun (нативный TypeScript)
- **HTTP-фреймворк:** Elysia.js + TypeBox (валидация запросов)
- **База данных:** libSQL (SQLite) через `@libsql/client` + Drizzle ORM
- **Фоновые задачи:** Worker Threads (парсинг EPUB/FB2, NLP, OCR)
- **Хранилище файлов:** локальная ФС или S3 (паттерн Adapter)

Подробное описание слоёв (Controllers → Services → Repositories), воркеров и хранилища — в [`src/readme.md`](./src/readme.md).

## Структура

```
src/
├── index.ts          # Точка входа: сервер, воркеры, планировщик
├── cli.ts            # CLI управления пользователями (bun run users)
├── config.ts         # Конфигурация из env-переменных
├── controllers/      # Роутинг и валидация (Elysia)
├── services/         # Бизнес-логика
├── repositories/     # Запросы к БД (Drizzle)
├── db/               # Подключение к БД, схемы, миграции
│   ├── index.ts          # Основная БД: клиент, миграции, дефолтный админ
│   ├── catalog.ts        # Каталожная БД (официальные колоды)
│   ├── schema.ts         # Схема основной БД
│   ├── catalog-schema.ts # Схема каталожной БД
│   └── migrations/       # Сгенерированные миграции drizzle-kit
├── scripts/          # Утилиты: дампы, сиды, генерация колод
├── workers/          # Worker Threads для тяжёлых задач
└── types/            # Общие доменные типы
```

## Запуск

```bash
bun install

# Dev с hot-reload
bun run dev

# Прод
bun run start
```

Сервер слушает порт из `PORT` (по умолчанию `4444`, в `.env.example` — `4445`). При старте автоматически применяются миграции и создаётся дефолтный админ (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, по умолчанию `admin/admin`).

## База данных (libSQL / SQLite)

Работа с БД построена на **`@libsql/client`** (libSQL — форк SQLite) с драйвером **`drizzle-orm/libsql`**. Прямое использование `bun:sqlite` в коде отсутствует.

### Подключение

Подключение создаётся один раз в `src/db/index.ts`:

```ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

export const client = createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })
await client.execute('PRAGMA foreign_keys = ON')

export const db = drizzle(client, { schema, logger: false })
```

В коде используется только экспорт `db` (Drizzle) — все запросы идут через репозитории:

```ts
import { db } from '../db'
import * as schema from '../db/schema'

const book = await db.query.books.findFirst({ where: eq(schema.books.id, id) })
```

Все методы Drizzle здесь **асинхронные** — всегда используйте `await` (в т.ч. `.get()`, `.all()`, `.run()`).

### Режимы работы: локальный файл или Turso

По умолчанию БД — локальный SQLite-файл, ничего настраивать не нужно:

```env
DB_PATH=./db/insight-book.sqlite
```

Для подключения к удалённой libSQL/Turso-базе (или edge-реплике) задайте:

```env
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-token
```

Аналогично для каталожной БД: `CATALOG_DB_PATH` / `CATALOG_DATABASE_URL`.

> ⚠️ Дампы (`dump:create`) копируют файл БД — они имеют смысл только в локальном режиме (`file:`).

### Две базы данных

| База       | Назначение                                 | Подключение                       | Схема                      |
| ---------- | ------------------------------------------ | --------------------------------- | -------------------------- |
| Основная   | Пользователи, книги, словарь, кэши LLM/TTS | `db` (`src/db/index.ts`)          | `src/db/schema.ts`         |
| Каталожная | Официальные колоды (`official_decks*`)     | `catalogDb` (`src/db/catalog.ts`) | `src/db/catalog-schema.ts` |

Таблицы каталожной БД создаются DDL-миграцией при старте (`initCatalogDb()`), drizzle-kit её не покрывает.

### Миграции

Миграции основной БД применяются автоматически при старте сервера. Управление через drizzle-kit:

```bash
# Сгенерировать миграцию после изменения src/db/schema.ts
bun run db:generate

# Применить миграции вручную
bun run db:migrate

# Drizzle Studio (просмотр данных)
bun run db:studio
```

`drizzle.config.ts` использует `dialect: 'sqlite'` и `file:${DB_PATH}` — это совместимо с libSQL.

## Скрипты

| Команда                                               | Описание                                                |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `bun run dev` / `start`                               | Запуск сервера (watch / обычный)                        |
| `bun run users`                                       | CLI: управление пользователями (лимиты, роли, удаление) |
| `bun run db:generate` / `db:migrate` / `db:studio`    | Работа с миграциями drizzle-kit                         |
| `bun run dump:create` / `dump:seed`                   | Создать / восстановить дамп БД и файлов                 |
| `bun run deck:seed` / `deck:generate` / `deck:inject` | Импорт / генерация / инжект кэша официальных колод      |
| `bun run s3:migrate`                                  | Перенос файлов книг/обложек в S3                        |
| `bun run lint:fix` / `typecheck`                      | Линтер и проверка типов                                 |

## Конфигурация (env)

Полный список — в [`.env.example`](./.env.example). Ключевые группы:

- **Сервер:** `PORT`, `FRONTEND_URL`, `ADMIN_FRONTEND_URL`, `CORS_EXTRA_ORIGINS`, `AUTH_MODE` (`single`/`multi`), `JWT_SECRET`
- **БД:** `DB_PATH`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CATALOG_DB_PATH`, `CATALOG_DATABASE_URL`
- **Файлы:** `UPLOADS_PATH`, `UPLOAD_STORAGE` (`local`/`s3`), `S3_*`
- **ИИ:** `LLM_*`, `OCR_*`, `TTS_*`, `STT_*` (URL, ключи, модели)
- **Прочее:** OAuth Яндекса, Unisender, Web Push (`VAPID_*`)
