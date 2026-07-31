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


