---
name: plugin-development
description: Разработка и сборка динамических плагинов для InsightBook. Применяется при создании/редактировании плагинов или пакетов packages/plugin-*.
---

# Разработка динамических плагинов InsightBook

Этот скилл содержит архитектурные правила и стандарты для создания и сборки динамических плагинов (загружаемых по URL в рантайме).

## 1. Сборка плагинов (Vite + Module Federation v2)
Плагины собираются как MF-remote через `@module-federation/vite`. Хостовые зависимости объявляются в `shared` (НЕ бандлятся внутрь плагина):
```typescript
import { federation } from '@module-federation/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'plugin_my_plugin', // уникальное имя remote
      filename: 'remoteEntry.js',
      exposes: { './Plugin': './src/index.ts' },
      shared: {
        'vue': { singleton: true },
        'vue-router': { singleton: true },
        'pinia': { singleton: true },
        '@injurka/insight-book-plugin-api': { singleton: true },
      },
    }),
  ],
  build: { target: 'esnext', minify: false, cssCodeSplit: false },
})
```
- **Запрещено** сбандливать Vue или `@injurka/insight-book-plugin-api` внутрь плагина.
- Точка входа для хоста — expose `./Plugin`, экспортирующий `default: InsightBookPlugin`.

## 2. Манифест плагина (`manifest.json`)
Каждый плагин должен иметь `manifest.json` в корне. `entryUrl` указывает на собранный `remoteEntry.js`:
```json
{
  "id": "my-plugin-id",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Описание плагина",
  "icon": "mdi:extension",
  "entryUrl": "./remoteEntry.js"
}
```

## 3. Точки расширения (Extension Points)
Регистрируй UI-компоненты плагина в разрешенные позиции:
- `'dictionary:training-modes'` — кастомные режимы тренировок.
- `'reader:header-actions'` — кнопки в шапке читалки.
- `'settings:custom-tab'` — кастомные вкладки в настройках.

Пример в `activate(ctx)`:
```typescript
ctx.registerUIWidget('dictionary:training-modes', 'widget-id', CustomWidgetComponent)
```
И обязательно очищай в `deactivate(ctx)`:
```typescript
ctx.unregisterUIWidget('widget-id')
```

## 4. Использование API (Facade Pattern)
- **Запрещено** импортировать Pinia-сторы приложения напрямую.
- Используй только фасад `ctx.api`:
  - `ctx.api.dictionary.getWords()`
  - `ctx.api.reader.getCurrentBook()`
  - `ctx.api.user.getProfile()`
