---
name: api-colada-expert
description: Архитектурные стандарты проекта InsightBook: работа с сетевым слоем (api.service), оффлайн-кэшем (offline.service), Zod (Anti-Corruption Layer), репозиториями (useRepos) и Pinia-сторами.
---

# Архитектура данных: Zod (ACL) + Repository + Pinia

В проекте InsightBook строго соблюдается разделение ответственности между **API/Offline сервисами**, **Zod-схемами (ACL)**, **Репозиториями** и **Pinia-сторами**.

Запрещено напрямую вызывать `api.*` или `offlineService.*` внутри компонентов, Pinia-сторов или Vue-композаблов. Весь обмен данными происходит **только через Репозитории**, получаемые с помощью DI `useRepos()`.

---

## 1. Слой схем и типов: Zod Schemas (Anti-Corruption Layer)

Схемы Zod служат защитным слоем (ACL) между внешними ответами бэкенда (`api.service`), локальным IndexedDB-кэшем (`offlineService`) и бизнес-логикой UI.

### Размещение и типы
Схемы создаются в `src/shared/types/schemas/` (или внутри модулей `src/05.modules/*/schemas/`).
Типы доменных моделей экспортируются напрямую через `z.infer`:

```typescript
// src/shared/types/schemas/book.schema.ts
import { z } from 'zod'

export const TocItemSchema = z.object({
  id: z.string(),
  href: z.string().default(''),
  title: z.string().default('Unknown'),
  order: z.number().default(0),
  level: z.number().default(1),
  pageNum: z.number().optional(),
})

export const BookSchema = z.object({
  id: z.number(),
  // Замена null на фоллбек 'Без названия'
  title: z.string().nullable().transform(val => val || 'Без названия'),
  author: z.string().nullable().default(null),
  coverUrl: z.string().nullable().default(null),
  filePath: z.string().default(''),
  language: z.string().default('en'),
  totalPages: z.number().default(1),
  // Приведение строк к числам при чтении из старого кэша
  currentPage: z.coerce.number().nullable().default(1),
  toc: z.array(TocItemSchema).optional().default([]),
  
  // Устойчивость к изменению enum/битым данным из кэша
  status: z.enum(['reading', 'to-read', 'have-read']).catch('reading'),
  isFavorite: z.boolean().catch(false),
  
  processStatus: z.enum(['processing', 'ready', 'error']).optional(),
  processError: z.string().nullable().optional(),
})

// Экспорт доменного типа прямо из схемы
export type BookDomain = z.infer<typeof BookSchema>
```

### Утилита ACL (`src/shared/lib/acl.ts`)
Для безошибочной прогонки данных через схемы и предотвращения падений UI используется функция `applyAcl`:

```typescript
import { z, ZodSchema } from 'zod'

export function applyAcl<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return result.data
  }

  console.error(`[ACL Error] Mismatch in ${context}:`, result.error.format())
  throw new Error(`Data validation failed in ${context}`)
}
```

---

## 2. Слой Репозиториев (`src/shared/repositories/`)

Репозиторий связывает сетевой слой (`api`), оффлайн-кэш (`offlineService`) и валидирует данные с помощью `applyAcl`.

**Правила написания репозитория:**
1. Не передавать сырые ответы от `api` или `offlineService` в UI/Store.
2. Прогонять полученный DTO (из сети или кэша) через `applyAcl`.
3. Сохранять в оффлайн-кэш только уже проверенные данные.

```typescript
// src/shared/repositories/book.repository.ts
import { api } from '~/01.shared/services/api.service'
import { offlineService } from '~/01.shared/services/offline.service'
import { applyAcl } from '~/01.shared/lib/acl'
import { BookSchema, BookDomain } from '~/01.shared/types/schemas/book.schema'
import { z } from 'zod'

export interface IBookRepository {
  getInfo: (id: number) => Promise<BookDomain | null>
  list: () => Promise<BookDomain[]>
}

export class DefaultBookRepository implements IBookRepository {
  async getInfo(id: number): Promise<BookDomain | null> {
    try {
      const rawApiData = await api.books.getInfo(id)
      // ACL: Валидация и приведение типов после сети
      const validBook = applyAcl(BookSchema, rawApiData, `bookRepository.getInfo(${id})`)
      
      await offlineService.saveBookInfo(id, validBook).catch(() => {})
      return validBook
    }
    catch (error) {
      const rawOfflineData = await offlineService.getBookInfo(id)
      if (rawOfflineData) {
        try {
          // ACL: Валидация локального кэша на случай устаревшей структуры
          return applyAcl(BookSchema, rawOfflineData, `bookRepository.getInfoCache(${id})`)
        }
        catch (cacheError) {
          console.error(`Local cache corrupted for book ${id}`, cacheError)
          throw new Error('Local cache corrupted')
        }
      }
      throw error
    }
  }

  async list(): Promise<BookDomain[]> {
    try {
      const rawListData = await api.books.list()
      const validList = applyAcl(z.array(BookSchema), rawListData, 'bookRepository.list()')
      
      await offlineService.saveBooksList(validList).catch(() => {})
      return validList
    }
    catch (error) {
      const offlineList = await offlineService.getBooksList()
      if (offlineList) {
        return applyAcl(z.array(BookSchema), offlineList, 'bookRepository.listCache()')
      }
      throw error
    }
  }
}

export const bookRepository: IBookRepository = new DefaultBookRepository()
```

---

## 3. Использование в Pinia-сторах и Composables

Внутри Pinia Store или UI-компонентов работа с данными производится **исключительно через плагин DI (`useRepos`)**:

```typescript
// src/05.modules/reader/store/reader.store.ts
import { defineStore } from 'pinia'
import { useRepos } from '~/00.plugins/di'
import { useToastStore } from '~/01.shared/store/toast.store'
import type { BookDomain } from '~/01.shared/types/schemas/book.schema'

export const useReaderStore = defineStore('reader', () => {
  const repos = useRepos()
  const toast = useToastStore()
  
  const currentBook = ref<BookDomain | null>(null)
  const isLoading = ref(false)

  async function loadBookInfo(bookId: number) {
    isLoading.value = true
    try {
      // Прямой вызов через DI-репозиторий (уже прошел ACL!)
      currentBook.value = await repos.book.getInfo(bookId)
    }
    catch (err: any) {
      toast.error('Не удалось загрузить информацию о книге')
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    currentBook,
    isLoading,
    loadBookInfo,
  }
})

