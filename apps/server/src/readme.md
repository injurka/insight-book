# Архитектура Серверной Части (Insight Book)

В данном документе описывается актуальная архитектура бэкенда приложения, используемые технологии, паттерны и правила разработки. Бэкенд спроектирован с упором на производительность, строгую типизацию и разделение зон ответственности.

## 📌 Технологический Стек

- **Runtime:** Bun (быстрое выполнение, нативный TypeScript)
- **Web-фреймворк:** Elysia.js (экстремально быстрый роутинг, TypeBox валидация)
- **База данных:** SQLite / Turso + Drizzle ORM
- **Многопоточность:** Worker Threads (пул воркеров для тяжелых задач)

---

## 🏗 Общая Архитектура (Layered Architecture)

Приложение построено на базе трехслойной архитектуры. Это гарантирует, что HTTP-роутинг, бизнес-логика и работа с базой данных полностью изолированы друг от друга.

```mermaid
graph TD
    Client["📱 Client"] -->|HTTP Request| Controller["🛂 Controller (Elysia.js)"]

    subgraph "Application Layer"
        Controller -->|Valid Data| Service["⚙️ Service (Business Logic)"]
        Controller -.->|Validation| TypeBox["🛡️ TypeBox Schema"]
    end

    subgraph "Domain & Data Layer"
        Service -->|Entities| Repository["🗄️ Repository (Drizzle ORM)"]
    end

    subgraph "Infrastructure Layer"
        Service -->|Files| Storage["📦 Storage Adapter"]
        Service -->|Background Jobs| Workers["🛠️ Worker Pool"]
        Service -->|External APIs| External["🤖 LLM / TTS APIs"]
    end

    Repository -->|SQL| Database[("SQLite")]
    Storage -.->|FS| LocalStorage["📂 Local File System"]
    Storage -.->|S3| S3Storage["☁️ AWS S3"]
```

---

## 📦 Описание Слоев

### 1. Controllers (`src/controllers/`)

**Ответственность:** Маршрутизация, валидация входящих данных и формирование HTTP-ответов.

- **Elysia.js & TypeBox:** Весь `body`, `query` и `params` строго валидируются через схемы Elysia (например, `t.Object`). Никаких `any` или сырых объектов.
- **Изоляция:** Контроллеры не содержат бизнес-логику. Их единственная задача — принять запрос, валидировать его, вызвать сервис и вернуть ответ (или прокинуть ошибку `AppError`).
- **Аутентификация:** Идентификатор пользователя (`userId`) автоматически извлекается из `authPlugin` через деструктуризацию: `.get('/', async ({ userId }) => { ... })`.

### 2. Services (`src/services/`)

**Ответственность:** Ядро приложения — бизнес-логика.

- **Инкапсуляция:** Сервисы ничего не знают о HTTP (нет `Request`, `Response`, заголовков).
- **Связь:** Сервисы проверяют права доступа, подготавливают данные и оркестрируют вызовы репозиториев, воркеров или сторонних API (LLM, Yandex Cloud и др.).
- **Строгая типизация:** Внутри сервисов используются конкретные типы и интерфейсы (определенные в `src/types/index.ts`). Использование `as any` запрещено.

### 3. Repositories (`src/repositories/`)

**Ответственность:** Изоляция запросов к базе данных.

- **Drizzle ORM:** Все `db.select()`, `db.insert()`, `db.update()` живут только здесь.
- **Type Safety:** Возвращаемые и принимаемые данные строго типизированы через типы Drizzle (`typeof schema.books.$inferInsert`, `typeof schema.books.$inferSelect`). Это защищает от опечаток и несоответствий схемы БД и кода.
- Сервисы не составляют SQL-запросы, они вызывают готовые методы репозиториев (например, `bookRepository.findBookById`).

---

## 🚀 Worker Pool (Многопоточность)

Бэкенд выполняет множество ресурсоемких задач: парсинг EPUB-книг, OCR (распознавание текста на картинках), NLP (обработка естественного языка и токенизация предложений). Чтобы не блокировать Event Loop основного процесса (что привело бы к зависанию HTTP-ответов для других пользователей), эти задачи вынесены в **Worker Pool**.

```mermaid
sequenceDiagram
    participant C as Controller
    participant S as Service
    participant WP as Worker Pool
    participant W as Worker Thread

    C->>S: analyzeBook(bookId)
    S->>WP: runWorkerTask('parseEpub', data)
    WP->>W: Assign Task
    Note over W: Тяжелые вычисления<br/>в отдельном потоке CPU
    W-->>WP: Task Result
    WP-->>S: Return Parsed Data
    S->>C: return success
```

- Воркеры инициализируются при старте сервера (`src/index.ts`) в зависимости от количества ядер процессора.
- Общение с воркерами строго типизировано, что исключает ошибки при передаче сообщений (`postMessage`).

---

## 🔌 Паттерн Adapter (Storage)

Для загрузки файлов (обложки, манга, EPUB) мы применяем паттерн **Adapter**, что делает код независимым от физического хранилища.

```mermaid
classDiagram
    class IStorageService {
        <<interface>>
        +uploadFile(key, buffer, contentType)
        +deleteFile(key)
        +getFile(key)
    }
    class LocalStorageService {
        -getAbsolutePath(key)
    }
    class S3StorageService {
        -client: S3Client
    }
    IStorageService <|-- LocalStorageService
    IStorageService <|-- S3StorageService
```

В `src/services/storage/index.ts` создается экземпляр `storageService`. Если в `.env` указано `UPLOAD_STORAGE=s3`, экспортируется `S3StorageService`, иначе — `LocalStorageService`. Бизнес-логика работает исключительно с интерфейсом `IStorageService`.
