# 1 SQLite WASM + OPFS + birpc

Проект **InsightBook** значительно крупный и сложный (использует `@pinia/colada`, FSRS, TTS, кэширование страниц и манги, OCR). Текущая реализация `offline.service.ts` на базе `localForage` хранит огромные объемы данных в IndexedDB (включая Base64 аудио и словари), а фильтрация словаря происходит полностью в оперативной памяти (`dictionary-filters.store.ts`).

Переход на **SQLite WASM + OPFS + birpc** сделает приложение мгновенным, снизит потребление RAM почти до нуля и позволит легко реализовать вашу новую фичу — **скачивание полного словаря одним файлом**.

Ниже представлен пошаговый план миграции, адаптированный под архитектуру InsightBook 2026 года.

---

### Фаза 1. Ядро: SQLite Worker и типизированный RPC (birpc)

Вместо `offline.service.ts` создаем `sqlite.worker.ts` и `db.client.ts`.

**1. Схема БД:**
Проектируем таблицы под сущности приложения.
```sql
-- Таблица книг
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT, cover_path TEXT, ...);

-- Таблица страниц (для оффлайн чтения)
CREATE TABLE pages (book_id INTEGER, page_num INTEGER, content TEXT, PRIMARY KEY(book_id, page_num));

-- Таблица словаря (FSRS данные)
CREATE TABLE dictionary (
    id INTEGER PRIMARY KEY,
    word TEXT,
    translation TEXT,
    state INTEGER,
    due TEXT, -- ISO дата для FSRS
    stability REAL,
    difficulty REAL
    -- ...
);

-- FTS5 индекс для поиска по словарю (заменит фильтрацию массива в RAM)
CREATE VIRTUAL TABLE dictionary_fts USING fts5(word, translation, tags, content="dictionary");
```

**2. RPC Интерфейс (`shared/types/rpc.ts`):**
С помощью `birpc` описываем контракты. Воркер будет не только отдавать данные, но и слать прогресс загрузки (для синхронизации книг и загрузки полного словаря).

---

### Фаза 2. Управление медиа через OPFS (Отказ от Cache API и Blobs)

Сейчас в `offline.service.ts` картинки манги и аудио TTS сохраняются либо в Cache API, либо в `localForage` (Base64), а потом конвертируются в `URL.createObjectURL`. Это ведет к утечкам памяти и нагрузке на GC.

**Новый флоу:**
1. **Запись:** Воркер получает `ArrayBuffer` аудио/картинки и синхронно пишет его в OPFS через `createSyncAccessHandle()` по пути `/manga/{bookId}/{pageNum}.jpg` или `/tts/{hash}.mp3`.
2. **Service Worker (`sw.ts`):** Добавляем перехватчик (Workbox Route) на виртуальный путь `^/opfs-media/.*`. Когда UI запрашивает `<img src="/opfs-media/manga/1/5.jpg">` или `new Audio('/opfs-media/tts/word.mp3')`, Service Worker лезет в OPFS и отдает стрим.
3. **Очистка UI:** Убираем `clearBlobUrls` из всех Vue-компонентов. Больше нет необходимости управлять жизненным циклом `blob:` ссылок.

---

### Фаза 3. Новая фича: Скачивание полного словаря с сервера

Так как теперь у нас реляционная БД, мы можем сделать загрузку полного словаря и аудио молниеносной.

**Как это реализовать (Архитектура):**
1. **Серверная часть:** Бэкенд раз в сутки (или по запросу) собирает `.sqlite` файл с полным публичным словарем и связями, а также zip-архив с TTS-аудио.
2. **Клиентская часть (Воркер):**
   - Пользователь нажимает «Скачать оффлайн-базу» (в `settings-storage-panel.vue`).
   - Воркер скачивает серверный `.sqlite` файл (например, `public_dict.sqlite`) в OPFS.
   - SQLite WASM позволяет подключить вторую базу "на лету" с помощью команды `ATTACH DATABASE 'public_dict.sqlite' AS remote;`.
   - Выполняем миграцию: `INSERT OR IGNORE INTO main.dictionary SELECT * FROM remote.dictionary;`.
   - То же самое с архивом медиа: воркер распаковывает ZIP прямо в OPFS-папку `/tts/`.
3. **Обновление UI:** `birpc` дергает `onSyncProgress` в основном потоке, заполняя полосу загрузки в настройках.

---

### Фаза 4. Рефакторинг слоя данных (Colada + Repositories)

В InsightBook слой данных построен на `@pinia/colada` и репозиториях (`shared/repositories/*`). Сейчас логика ветвится: попытаться с сервера -> поймать ошибку -> пойти в `offlineService`.

**Делаем SQLite единым источником правды (Single Source of Truth):**
Обновляем методы репозиториев (например, `dictionary.repository.ts`):
```typescript
async list(): Promise<UserDictItem[]> {
  // 1. Всегда мгновенно отдаем данные из локальной SQLite
  const localData = await dbRpc.getDictionaryList();
  
  // 2. В фоне дергаем API для обновления (Stale-while-revalidate)
  if (navigator.onLine) {
    api.dictionary.list().then(remoteData => {
       dbRpc.syncDictionaryBatch(remoteData).then(() => {
          // Инвалидируем кэш Colada, чтобы UI обновился
          queryCache.invalidateQueries({ key: queryKeys.dictionary.all });
       });
    }).catch(() => {});
  }
  
  return localData;
}
```

---

### Фаза 5. Оптимизация тяжелых модулей

**1. Модуль Dictionary (Словарь):**
- Удаляем `dictionary-words.state.ts` (где сейчас в RAM лежат все слова).
- Переписываем `dictionary-filters.store.ts`: вместо `.filter()` по огромному массиву, мы просто отправляем в `dbRpc` параметры (язык, колода, поиск) и получаем готовый отфильтрованный массив с LIMIT/OFFSET (пагинацией) или по FTS5-индексу.

**2. Модуль Reader & Sync (`book-sync.service.ts`):**
- Сейчас `startWholeBookSync` скачивает страницы батчами по 15 и для каждой вызывает `writeTextFile` (отдельная транзакция IndexedDB).
- **Новый подход:** Воркер собирает все скачанные страницы и метаданные книги и делает один `BEGIN TRANSACTION; ... COMMIT;`. Сохранение целой книги на 1000 страниц займет ~50 миллисекунд.

**3. Тренировки (FSRS):**
- В `training.store.ts` получение очереди слов `getReviewQueue` переносится на уровень SQL.
  ```sql
  SELECT * FROM dictionary WHERE state IN (1,3) OR due <= datetime('now') ORDER BY random() LIMIT 50;
  ```
  Это избавляет от необходимости парсить `due` даты через JS объекты `Date` для всего словаря.

---

### Фаза 6. Миграция пользовательских данных из `localForage` в OPFS

У текущих пользователей в `localForage` уже есть сохраненные книги (`book_1_page_5`), кэш ИИ (`analysis_ru_word`) и словари. Чтобы они ничего не потеряли, пишем скрипт-мигратор.

1. В `main.ts` перед `app.mount('#app')` проверяем наличие флага `migration_v2_opfs`.
2. Если флага нет, поднимаем `MigrationOverlay.vue` (экран "Оптимизируем вашу библиотеку...").
3. Запускаем воркер-мигратор:
   - Читаем все ключи из `localforage`.
   - Собираем данные в большие массивы.
   - Отправляем в SQLite батчами.
   - Бинарники (TTS и обложки) переписываем в OPFS директорию.
4. Вызываем `localforage.clear()`, ставим флаг `migration_v2_opfs = true`.

---

### План работ (Roadmap) для разработчика

1. **Sprint 1: Инфраструктура**
   - Установка `@sqlite.org/sqlite-wasm` и `birpc`.
   - Настройка HTTP Headers (COOP/COEP) в Tauri и Vite-сервере.
   - Создание `sqlite.worker.ts`, инициализация OPFS-VFS.
   - Создание схемы БД.

2. **Sprint 2: Media & Service Worker**
   - Написание Workbox маршрута `/opfs-media/` в `sw.ts`.
   - Замена `URL.createObjectURL` во всем приложении (Очистка Vue компонентов от утечек памяти).

3. **Sprint 3: Рефакторинг Dictionary & FSRS**
   - Перевод `dictionary.repository.ts` на SQLite.
   - Удаление фильтрации в RAM, использование SQL и FTS5 для поиска.
   - Интеграция фичи "Скачать полный словарь с сервера" (`ATTACH DATABASE`).

4. **Sprint 4: Рефакторинг Reader & Book Sync**
   - Перевод `book.repository.ts`, `analysis.repository.ts`, `highlights.repository.ts` на SQLite.
   - Оптимизация `book-sync.service.ts` под единую транзакцию.

5. **Sprint 5: Миграция и удаление легаси**
   - Написание скрипта переливки из `localforage` в OPFS.
   - Удаление `localforage` из `package.json`.
   - Тестирование на реальных данных PWA и в среде Tauri.

# 2 After OPFS refactor

Изучив код вашего Service Worker и помня про ваш предыдущий вопрос про **OPFS**, вот подробный разбор того, **что стоит вынести в OPFS**, а также **что стоит удалить или упростить в самом SW (очистить от оверинжиниринга)**.

---

### 1. Что вынести из Service Worker в OPFS (Архитектурно)

В вашем коде есть константа `OFFLINE_MEDIA_CACHE_NAME = 'insight-book-offline-media'`.

#### ❌ Что НЕ ДОЛЖНО лежать в CacheStorage / SW:
* **Книги (EPUB, PDF, FB2), аудиокниги и медиа-файлы.**
  В `sw.ts` у вас стоит явный пропуск:
  ```ts
  if (request.destination === 'video' || request.destination === 'audio')
    return false
  ```
  И это абсолютно правильно! Скачивание и сохранение таких файлов лучше вынести из SW вообще.

#### ✅ Как это сделать через OPFS:
1. **Скачивание и сохранение:** Выполняйте `fetch()` в **Web Worker** (или основном потоке) и сразу сохраняйте через OPFS API (`navigator.storage.getDirectory()`).
2. **Чтение:** Для PDF/EPUB/Audio читайте данные напрямую из OPFS (например, через `createObjectURL(blob)` или стриминг `SyncAccessHandle` в Dedicated Worker). 
3. **Результат:** Service Worker больше не будет забивать `CacheStorage` гигабайтами медиа-данных, а браузер не будет тратить RAM на парсинг ответов через SW.

---

### 2. Что нужно УДАЛИТЬ или УПРОСТИТЬ в самом SW

В текущем SW есть несколько мест с сильным **оверинжинирингом**, которые создают лишнюю нагрузку на CPU при каждом сетевом запросе.

#### 🔴 1. Лишний анализ JS/CSS (`AssetAnalyzer` и стратегии `hashed`/`vendor`/`regular`)
**Проблема:**
У вас в `sw.ts` вызывается:
```ts
precacheAndRoute(self.__WB_MANIFEST || [])
```
Vite уже автоматически собирает **все** ваши JS/CSS ассеты с хэшами и заносит их в `__WB_MANIFEST`. 
При этом ниже у вас написано еще ~50 строк кода: `AssetAnalyzer` с регулярными выражениями (`HASH_PATTERNS`, `VENDOR_PATTERNS`), свой LRU-кэш на 1000 элементов и 3 отдельные маршрута `registerRoute` для JS/CSS.

**Почему это плохо:**
* Это **дублирование**: Workbox прекеширует JS/CSS бандлы при сборке.
* `AssetAnalyzer.getAssetType()` выполняет регулярные выражения на **КАЖДЫЙ** `fetch` скрипта или стиля, создавая задержку в Worker-потоке.

**Что делать:** 
Удалить класс `AssetAnalyzer` и ручные маршруты для JS/CSS. Для Vite-приложений прекешинга `precacheAndRoute` более чем достаточно.

---

#### 🔴 2. Тяжелый подсчет размера кэша в `getCacheInfo()`
В `utils.ts`:
```ts
const responses = await Promise.all(keys.slice(0, 10).map(req => cache.match(req)))
```
Выполнение `cache.match()` для нескольких запросов ради чтения `content-length` при каждом запросе инфы о кэше сильно тормозит SW. К тому же заголовка `content-length` часто нет у Opaque-ответов (CORS).

**Что делать:** 
Считать только количество записей (`keys.length`). Если нужен точный размер — лучше использовать нативный `navigator.storage.estimate()`.

---

#### 🟡 3. Ручной `safeCachePlugin`
У вас написан плагин для проверки `response.status === 206` (Partial Content). 
Workbox из коробки не сохраняет `206 Partial Content` в `CacheFirst`/`StaleWhileRevalidate` (он сохраняет только то, что указано в `CacheableResponsePlugin`, где у вас задано `statuses: [0, 200]`). Этот плагин избыточен.

---

### 💡 Итоговый план оптимизации SW

1. **Вынести в OPFS:** Загрузку и кэширование книг, PDF, аудио и тяжелых файлов медиа (полностью в обход Service Worker).
2. **Удалить из SW (`utils.ts` и `sw.ts`):**
   - Класс `AssetAnalyzer`.
   - Маршруты `hashedAssetsStrategy`, `vendorAssetsStrategy`, `regularAssetsStrategy`.
   - `safeCachePlugin` (достаточно `CacheableResponsePlugin`).
3. **Оставить в SW:**
   - `precacheAndRoute` (прекеш Vite ассетов).
   - Кэш шрифтов (`insight-book-fonts`).
   - Кэш иконок Iconify (`insight-book-icons`).
   - Кэш UI картинок (`insight-book-images`).
   - Навигационный роут SPA (`NavigationRoute`).
   - Push-уведомления.

# 3 Decomposition

Вынести в отдельный модуль `05.modules/srs-training` (или просто `training`)

С точки зрения DDD, **Управление словарем (Dictionary)** и **Интервальное повторение (Training)** — это два разных субдомена (Bounded Contexts):
1. **Dictionary Context:** Отвечает за CRUD слов, списки, колоды, поиск, фильтры, запросы к AI для генерации контекста.
2. **Training Context:** Отвечает за сессии тестирования, режимы (typing, audio, scramble), подсчет очков (lives, score), расчет Levenshtein distance, работу с сущностью `Flashcard` (FSRS).

Разделение на два модуля идеально впишется в вашу архитектуру.

---

### Как это будет выглядеть в структуре

Вам нужно создать новый модуль и перенести туда всё, что связано с тренировками:

```text
src/components/05.modules/
├── dictionary/                 # Оставляем только управление словарем
│   ├── composables/
│   │   ├── use-dict-filter-options.ts
│   │   └── use-anki-export.ts
│   ├── store/
│   │   ├── dictionary.store.ts
│   │   ├── decks.store.ts
│   │   └── dictionary-filters.store.ts
│   └── ui/
│       ├── dialog/
│       │   ├── add-edit-word-dialog.vue
│       │   ├── manage-decks-dialog.vue
│       │   └── ...
│       └── dictionary-view.vue
│
└── srs-training/               # НОВЫЙ МОДУЛЬ
    ├── composables/
    │   ├── use-srs-quiz.ts
    │   ├── use-srs-session.ts
    │   └── use-fsrs-scheduling.ts
    ├── store/
    │   └── training.store.ts   # Переносим из dictionary/store/training.store.ts
    └── ui/
        ├── dialog/
        │   ├── srs-training-dialog.vue
        │   └── srs-training-views/
        │       ├── srs-setup-view.vue
        │       ├── srs-card-view.vue
        │       ├── srs-summary-view.vue
        │       ├── srs-mode-match.vue
        │       └── srs-modes/  # Все компоненты режимов (typing, audio, radicals и т.д.)
        └── partials/
            └── srs-card-toolbar.vue
```

### Как организовать взаимодействие (Слабая связность)

Главный вопрос при таком разделении: **как они будут общаться, не нарушая вашу архитектуру?**

В данном случае мы можем использовать **однонаправленную зависимость** (Unidirectional Dependency):

Однонаправленная зависимость (Проще)
Допускается, чтобы модуль "Словарь" знал о существовании модуля "Тренировка", но не наоборот.
`DictionaryView` лениво импортирует модалку тренировки:
```typescript
const SrsTrainingDialog = lazyComponent(() => import('~/components/05.modules/srs-training/ui/dialog/srs-training-dialog.vue'))
```
И управляет её видимостью через `v-model:visible`. Это нормально для модульной архитектуры — модули могут использовать друг друга как строительные блоки, если нет циклических зависимостей (Circular Dependencies).

---

### Что придется отрефакторить

1. **Развязка сторов (`dictionary.store.ts` и `training.store.ts`)**:
   Сейчас в вашем `dictionary.store.ts` есть прокси-геттеры/сеттеры для тренировки:
   ```typescript
   const reviewQueue = computed({ get: () => trainingStore.reviewQueue ... })
   const trainingMode = computed({ get: () => trainingStore.trainingMode ... })
   ```
   **Удалите их из `dictionary.store.ts`**. Стор словаря не должен отвечать за очередь карточек. Логика `fetchTrainingQueue` должна инкапсулироваться исключительно внутри `training.store.ts`.

2. **Запросы к API (Colada / Repositories)**:
   Модуль `srs-training` будет самостоятельно обращаться к вашим репозиториям: `repos.dictionary.getReviewQueue` и `repos.dictionary.submitReview`. Это абсолютно легально, так как репозитории (DAL) общие.

3. **Сущность `Flashcard`**:
   Она у вас уже вынесена в `03.domain/entities/flashcard.entity.ts`. Это прекрасно! Оба модуля (`dictionary` и `srs-training`) будут просто импортировать её из слоя Domain.

# 4 zod

Добавление **Anti-Corruption Layer (ACL)** с использованием Zod.

Zod в слое репозитория позволит не просто "кидать ошибки", но и **трансформировать (исправлять)** данные: подставлять дефолтные значения, парсить строки в даты, отбрасывать неизвестные поля.

Вот как это лучше всего элегантно внедрить в вашу архитектуру.

### Шаг 1. Организация папок для схем

Так как схемы тесно связаны с доменными моделями, логично разместить `shared/types/schemas`.

Создадим схему для книги:
`src/shared/types/schemas/book.schema.ts`

```typescript
import { z } from 'zod'

// Вспомогательная схема для оглавления
export const TocItemSchema = z.object({
  id: z.string(),
  href: z.string().default(''),
  title: z.string().default('Unknown'),
  order: z.number().default(0),
  level: z.number().default(1),
  pageNum: z.number().optional(),
})

// Главная схема книги (ACL)
export const BookSchema = z.object({
  id: z.number(),
  // Если бэкенд вернет null, Zod заменит его на 'Без названия'
  title: z.string().nullable().transform(val => val || 'Без названия'),
  author: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  localCoverUrl: z.string().optional(),
  filePath: z.string().default(''),
  language: z.string().default('en'),
  totalPages: z.number().default(1),
  // Если в кэше лежал string '1', Zod может привести его к числу (используя coerce)
  currentPage: z.coerce.number().nullable().default(1),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  userId: z.number().optional(),
  type: z.string().optional(),
  toc: z.array(TocItemSchema).optional(),
  
  // Пример трансформации сложных статусов
  status: z.enum(['reading', 'to-read', 'have-read']).catch('reading'),
  isFavorite: z.boolean().catch(false), // Если в кэше мусор, будет false
  
  processStatus: z.enum(['processing', 'ready', 'error']).optional(),
  processError: z.string().nullable().optional(),
})

// Вы можете экспортировать тип прямо из Zod, чтобы не дублировать интерфейсы в types/models.ts
export type BookDomain = z.infer<typeof BookSchema>
```

### Шаг 2. Внедрение в Репозиторий (Тот самый ACL)

Репозиторий — это идеальное место для ACL. Он получает сырые DTO (из `api.service` или `offline.service`) и прогоняет их через Zod перед тем, как отдать в Pinia (Application Layer).

Обновим ваш `src/shared/repositories/book.repository.ts`:

```typescript
import { api } from '~/shared/services/api.service'
import { offlineService } from '~/shared/services/offline.service'
import { BookSchema } from '~/shared/schemas/book.schema'
import { z } from 'zod'

export class DefaultBookRepository implements IBookRepository {
  
  async getInfo(id: number): Promise<Book | null> {
    try {
      const rawData = await api.books.getInfo(id)
      // ACL: Валидируем и очищаем данные с сервера
      const validData = BookSchema.parse(rawData)
      
      await offlineService.saveBookInfo(id, validData).catch(() => {})
      return validData
    }
    catch (error) {
      const rawOfflineData = await offlineService.getBookInfo(id)
      if (rawOfflineData) {
        try {
           // ACL: Валидируем данные из кэша (они могли устареть)
           return BookSchema.parse(rawOfflineData)
        } catch (zodError) {
           console.error('Local cache corrupted for book', id, zodError)
           // Если кэш сломан, удаляем его
           // offlineService.removeBookInfo(id)
           throw new Error('Cache corrupted')
        }
      }
      throw error
    }
  }

  async list(): Promise<Book[]> {
    // ...
    try {
      const rawData = await api.books.list()
      // ACL: Парсим массив. z.array(BookSchema)
      const validData = z.array(BookSchema).parse(rawData)
      
      await offlineService.saveBooksList(validData).catch(() => {})
      return validData
    }
    // ...
  }
}
```

### Шаг 3. Оптимизация (Чтобы не писать `.parse` каждый раз)

Чтобы не раздувать репозитории ручным оборачиванием каждого вызова в `parse` и `try/catch`, можно создать небольшую утилиту для валидации, которая будет логировать ошибки, но не "ронять" всё приложение, если бэкенд прислал одно лишнее поле.

Создадим `src/shared/lib/acl.ts`:

```typescript
import { z, ZodSchema } from 'zod'

/**
 * Обертка ACL. 
 * Если данные невалидны, она логирует ошибку, но может вернуть частичные данные 
 * (если использовать .catch в схемах) или выбросить понятную доменную ошибку.
 */
export function applyAcl<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return result.data
  }

  // Здесь можно отправлять логи в Sentry / Umami о том, что контракт нарушен
  console.error(`[ACL Error] Contract mismatch in ${context}:`, result.error.format())
  
  // Бросаем ошибку дальше, либо можно настроить возвращение fallback-значений
  throw new Error(`Data validation failed in ${context}`)
}
```

Тогда репозиторий будет выглядеть аккуратно:

```typescript
import { applyAcl } from '~/shared/lib/acl'
import { BookSchema } from '~/shared/schemas/book.schema'
import { z } from 'zod'

export class DefaultBookRepository implements IBookRepository {
  async getInfo(id: number) {
    try {
      const raw = await api.books.getInfo(id)
      const book = applyAcl(BookSchema, raw, `book.getInfo(${id})`)
      await offlineService.saveBookInfo(id, book).catch(() => {})
      return book
    }
    // ...
  }

  async list() {
    // ...
    const raw = await api.books.list()
    return applyAcl(z.array(BookSchema), raw, 'book.list()')
  }
}
```


# 5 Migrating from `@originjs/vite-plugin-federation` на `@module-federation/vite`

This guide migrates hosts and remotes that use Vite as their build tool from `@originjs/vite-plugin-federation` (OriginJS) to `@module-federation/vite`.

## What changes

Both plugins expose modules through `remoteEntry` files, but their host-remote configuration models differ.

- OriginJS treats a remote declared as a URL string, or an object without `format`, as an `esm` remote by default.
- `@module-federation/vite` uses the Module Federation runtime. Its string remote shorthand is a **`var` remote**; Vite ESM remotes must be declared with `type: 'module'`.
- Migrate uses of OriginJS's `virtual:__federation__` module to the Module Federation runtime API.
- `@module-federation/vite` can consume Vite module remotes as well as `var` remotes from Vite, Webpack, and Rspack. It also supports manifests.

Keep the host remote alias and expose keys stable during the first migration. That keeps existing imports such as `import('catalog/Product')` unchanged.

For example, the host's remote configuration changes, but the alias and expose key that form the consumer import path stay the same:

```ts
// OriginJS host
remotes: {
  catalog: "https://cdn.example.com/catalog/remoteEntry.js",
}

// `@module-federation/vite` host
remotes: {
  catalog: {
    name: "catalog",
    entry: "https://cdn.example.com/catalog/remoteEntry.js",
    type: "module",
  },
}

// Remote expose key (unchanged)
exposes: {
  "./Product": "./src/Product.tsx",
}

// Consumer code (unchanged)
const Product = await import("catalog/Product");
```

## Requirements

Before replacing the plugin, verify that each application being migrated uses a version supported by `@module-federation/vite`:

- Node.js `^20.19.0` or `>=22.12.0`
- Vite 5, 6, 7, or 8

Upgrade the application toolchain first if it uses an older Node.js or Vite version.

## Step 1: Replace the package

Install the Vite plugin in each host and remote that continues to use build-time federation, then remove OriginJS after its configuration is no longer used. A host managed entirely through the runtime does not need the Vite plugin; install the runtime package described in [Step 4](#step-4-migrate-dynamic-remotes) instead.

### pnpm

```sh
pnpm add @module-federation/vite
```

### npm

```sh
npm install @module-federation/vite
```

### Yarn

```sh
yarn add @module-federation/vite
```

Install dependencies in the application package that owns the federation configuration.

## Step 2: Migrate a Vite-built remote

Migrate one remote first and verify it with a single host before migrating the remaining applications.

### OriginJS remote

```ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "catalog",
      filename: "remoteEntry.js",
      exposes: {
        "./Product": "./src/Product.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
};
```

### `@module-federation/vite` remote

```ts
import { defineConfig } from "vite";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    federation({
      name: "catalog",
      filename: "remoteEntry.js",
      exposes: {
        "./Product": "./src/Product.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
});
```

`name` and expose keys remain unchanged, so existing consumer imports continue to work.

With Vite's default build settings, the same `filename` produces a different remote entry path:

- OriginJS with `filename: 'remoteEntry.js'`: `dist/assets/remoteEntry.js`
- `@module-federation/vite` with `filename: 'remoteEntry.js'`: `dist/remoteEntry.js`

To keep the existing `/assets/remoteEntry.js` URL, set `filename: 'assets/remoteEntry.js'`. Otherwise, update the host's `entry` URL to the new location.

If an OriginJS expose uses object form, carry over only its `import` value. The OriginJS `name` and `dontAppendStylesToHead` options have no direct equivalents and cannot be copied unchanged. If you use `dontAppendStylesToHead`, follow the CSS guidance in [Step 5](#step-5-review-shared-dependencies-and-css).

## Step 3: Migrate a Vite host

### OriginJS host

```ts
import federation from "@originjs/vite-plugin-federation";

export default {
  plugins: [
    federation({
      name: "storefront",
      remotes: {
        catalog: "https://cdn.example.com/catalog/remoteEntry.js",
      },
      shared: ["react", "react-dom"],
    }),
  ],
};
```

### `@module-federation/vite` host

```ts
import { defineConfig } from "vite";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    federation({
      name: "storefront",
      remotes: {
        catalog: {
          name: "catalog",
          entry: "https://cdn.example.com/catalog/remoteEntry.js",
          type: "module",
        },
      },
      shared: ["react", "react-dom"],
    }),
  ],
});
```

The first host migration keeps the array-form `shared` configuration unchanged. This avoids introducing a singleton policy during the configuration conversion. Enable singletons separately only after completing the review in [Step 5](#step-5-review-shared-dependencies-and-css).

Use an object remote with an explicit `type` for a Vite ESM remote.

**X — Incorrect:** a string remote is interpreted as `var`.

```ts
remotes: {
  catalog: 'https://cdn.example.com/catalog/remoteEntry.js',
}
```

**O — Correct:** declare the Vite ESM remote with `type: 'module'`.

```ts
remotes: {
  catalog: {
    name: 'catalog',
    entry: 'https://cdn.example.com/catalog/remoteEntry.js',
    type: 'module',
  },
}
```

The static consumer import remains the same:

```ts
const Product = await import("catalog/Product");
```

### Remote format mapping

| OriginJS remote configuration | Migration action                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL string or `format: 'esm'` | Verify that the entry is an ESM container, then use `{ name, entry, type: 'module' }`.                                                                            |
| `format: 'var'`               | Verify that the entry is a var container, then use `{ name, entry, type: 'var' }`. Add `entryGlobalName` when the container global differs from the remote alias. |
| `format: 'systemjs'`          | Treat as a manual migration that requires a separate proof of concept.                                                                                            |
| `externalType: 'promise'`     | Resolve the URL asynchronously, then call `registerRemotes()` from the runtime API.                                                                               |
| `shareScope`                  | Preserve it as `shareScope` on the `@module-federation/vite` remote object.                                                                                       |
| `from`                        | Do not map it directly. Select `type` from the actual remote entry format and verify shared-dependency behavior.                                                  |

Select `type` from the container format used by the deployed remote entry, not from the bundler that produced it.

## Step 4: Migrate dynamic remotes

This step is only required when the host registers or loads remotes dynamically. Install `@module-federation/enhanced` in that host before using its runtime API.

### pnpm

```sh
pnpm add @module-federation/enhanced
```

### npm

```sh
npm install @module-federation/enhanced
```

### Yarn

```sh
yarn add @module-federation/enhanced
```

OriginJS exposes dynamic federation through `virtual:__federation__`:

```ts
import {
  __federation_method_getRemote as getRemote,
  __federation_method_setRemote as setRemote,
  __federation_method_unwrapDefault as unwrapDefault,
} from "virtual:__federation__";

setRemote("catalog", {
  url: () => Promise.resolve(remoteUrl),
  format: "esm",
  from: "vite",
});

const module = await getRemote("catalog", "./Product");
const Product = await unwrapDefault(module);
```

### Most migrations: host using the Vite plugin

If the existing OriginJS host continues to use a Vite federation plugin, use this path:

```ts
import {
  registerRemotes,
  loadRemote,
} from "@module-federation/enhanced/runtime";

registerRemotes([{ name: "catalog", entry: remoteUrl, type: "module" }]);

const module = await loadRemote("catalog/Product");
const Product = module?.default ?? module;
```

### Host without the Vite plugin

This path applies only when the host is intentionally being redesigned to manage federation entirely at runtime. Create an instance with `createInstance()`, call `registerShared()` for dependencies that the host must provide, and then call `registerRemotes()`. Shared registration is application-specific, so follow the complete [runtime registration example](../examples/vite-runtime-register) instead of copying a partial configuration from this guide.

Keep remote registration before the first load. Preserve an error boundary or loading state around the consuming UI; remote entry, chunk, and shared-dependency failures are runtime failures.

## Step 5: Review shared dependencies and CSS

Do not copy complex OriginJS `shared` configuration mechanically.

| OriginJS option                            | Migration action                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared: ['react', 'react-dom']`           | Supported unchanged. Configure `singleton` separately only when the host and remote must share the same React instance.                                                                           |
| `requiredVersion`, `shareScope`            | Supported by the `@module-federation/vite` shared configuration; retain them after checking the configuration on both sides.                                                                     |
| `version`                                  | String values are supported. OriginJS also accepts `version: false`, which has no direct equivalent in `@module-federation/vite`; review that case manually.                                       |
| `import: false`                            | Supported, but the remote has no local fallback. Ensure that the host provides a compatible version in the same share scope.                                                                      |
| `packagePath`                              | Review manually. It is an OriginJS package-resolution option without a direct `@module-federation/vite` configuration field.                                                                      |
| `generate: false`                          | Review manually. Do not assume that `@module-federation/vite` omits the same fallback artifact.                                                                                                   |
| `modulePreload`                            | Review the application build and loading behavior manually. It has no direct equivalent in the `@module-federation/vite` shared options.                                                          |
| `dontAppendStylesToHead`                   | There is no direct equivalent. If the exposed module uses Shadow DOM, manage its stylesheet URLs or styles explicitly and inject them into the `ShadowRoot`. `bundleAllCSS` is not a replacement. |

When the host and remote use React within the same rendering boundary, verify compatible versions and configure `react` and `react-dom` as singletons. Also verify subpath imports that cross the boundary, such as `react/jsx-runtime` and `react-dom/client`.

## Step 6: Deploy incrementally and retire OriginJS

1. Deploy the migrated remote at a versioned URL that is separate from the existing OriginJS remote. Keep the existing remote entry and chunks available.
2. Migrate one host to the new remote URL using an object-form remote with an explicit `type`.
3. Verify remote modules, shared dependencies, CSS, and asset loading in a production-like environment.
4. Migrate the remaining static and dynamic hosts to the new remote incrementally.
5. Remove the OriginJS package, configuration, and previous remote entry only after no host consumes the OriginJS remote and the rollback retention period has ended.

Publish the remote entry and the chunks it references as one deployment unit. Use immutable, content-hashed URLs for child chunks, and retain previous chunks long enough to support cached remote entries and rollback.

## Before removing OriginJS

- [ ] The migrated host can load every remote expose it uses.
- [ ] The deployed remote entry URL matches the actual build output path, and the entry can load every referenced chunk.
- [ ] Static imports and, when used, dynamic remote loading work as expected.
- [ ] Shared-dependency version selection and singleton behavior match the intended configuration.
- [ ] Remote CSS and other assets load correctly.
- [ ] The production build and federation integration tests pass.

## Related examples

- [Consuming multiple remote formats](../examples/vite-webpack-rspack/host/vite.config.js): Vite module, Vite var, Webpack var, and Rspack var remotes
- [Dynamic remote registration](../examples/vite-runtime-register): `createInstance`, `registerShared`, `registerRemotes`, and `loadRemote`
