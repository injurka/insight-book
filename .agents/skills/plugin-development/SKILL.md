---
name: plugin-development
description: Разработка и сборка динамических плагинов для InsightBook. Применяется при создании/редактировании плагинов или пакетов packages/plugin-*.
---

# Разработка динамических плагинов InsightBook

Этот скилл содержит архитектурные правила и стандарты для создания и сборки динамических плагинов (загружаемых по URL в рантайме).

## 1. Сборка плагинов (Vite + Module Federation v2)
Плагины собираются как MF-remote через `@module-federation/vite`. Хостовые зависимости объявляются в `shared` (НЕ бандлятся внутрь плагина):

```bash
# Сборка (только build)
bun run build

# Сборка + упаковка в ZIP для загрузки в каталог
bun run pack
```

Скрипт `pack` автоматически:
1. Запускает сборку (`bun run build`)
2. Проверяет наличие `manifest.json` и `remoteEntry.js` в `dist/`
3. Архивирует содержимое `dist/` в `<plugin-id>-v<version>.zip` в корне пакета
4. ZIP готов к загрузке через админку: Настройки → Плагины → Загрузить в каталог

Также можно запустить скрипт напрямую из корня монорепо:
```bash
bun run tools/pack-plugin.ts packages/plugin-scroll-study
```
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

## 2a. Полноэкранные страницы (`immersive: true` + `orientation`)
Если плагин — игра или полноэкранный опыт, поставь `immersive: true` в объекте `InsightBookPlugin`. Хост:
- рендерит `plugin.pages` в layout `06.layouts/immersive` (без `KitAppTitlebar` и `env(safe-area-inset-*)`, edge-to-edge);
- на Android вызывает команду `set_immersive_mode` (Rust `apps/native/src-tauri/src/lib.rs` → Kotlin `setImmersiveMode` в плагине apk-installer): прячет статус-бар/навигацию (BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE), при уходе со страницы — восстанавливает.

`orientation: 'landscape' | 'portrait'` — блокировка ориентации экрана на Android на время просмотра страниц (только вместе с `immersive: true`): layout вызывает команду `set_screen_orientation`, Kotlin-команда `setScreenOrientation` ставит `Activity.requestedOrientation` (SENSOR_LANDSCAPE / SENSOR_PORTRAIT / UNSPECIFIED при выходе). На десктопе и в браузере — no-op.

Route meta выставляется в `addPluginRoutes` (`apps/client/src/00.plugins/plugin-manager.ts`): `meta: { layout, orientation }`.

## 2b. Ассеты: ничего не должно догружаться на глазах игрока
Игра обязана открываться целиком отрисованной, иначе текстуры «моргают» уже после старта — в первую очередь hover/pressed-состояния кнопок, которые браузер грузит при первом наведении.

- Держи явный манифест текстур (`lib/game-assets.ts`): импорт каждого файла + `new Image()` → `decode()` до первого кадра. Vite отдаёт в JS и CSS один и тот же URL, поэтому прелоад греет ровно те файлы, что нужны рендеру; проверяй по `dist/assets`, что на текстуру одна ссылка, а не два хеша.
- Игровой слой до готовности прячь через `visibility: hidden` **на детях** корня (`.is-gated > :not(.game-loading)`), а не на корне — у корня должна остаться тёмная подложка, на которую ложится экран загрузки.
- Экран загрузки показывай с задержкой ~180 мс: мгновенный старт из кеша не должен мигать оверлеем. Гейт ждёт текстуры + `isReady` Pixi + первую раскладку доски, но каждый пункт — с таймаутом-предохранителем (зависший WebGL или API не должен давать вечную загрузку).
- Иконки регистрируй локально: `addCollection` с данными из `@iconify-json/mdi` (`apps/client/node_modules/@iconify-json/mdi/icons.json`) при `activate`. Хост-бандл `icons-bundle.json` содержит не все имена, поэтому `<Icon icon="mdi:...">` уходит в `api.iconify.design` и появляется с задержкой.
- Шрифт: импорт `apps/client/public/fonts/fonts.css` затягивает в плагин ~413 woff2 (dist ≈ 32 МБ). Предзагружай только знаки интерфейса (`document.fonts.load('500 16px "Maple Mono CN"', 'кириллица/латиница/цифры')`); CJK-сабсеты всё равно грузятся при отрисовке таблицы знаков.

## 3. Точки расширения (Extension Points)
Регистрируй UI-компоненты плагина в разрешенные позиции:
- `'dictionary:training-modes'` — кастомные режимы тренировок.
- `'reader:header-actions'` — кнопки в шапке читалки.
- `'settings:custom-tab'` — кастомные вкладки в настройках.
- `'srs-card:toolbar-actions'` — кнопки в панели управления карточкой словаря.
- `'srs-card:below-toolbar'` — кастомный контент под панелью управления карточкой словаря.

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
- Используй только фасад `ctx.api` (или хелперы `usePluginApi()` / `getPluginApi()` из `@injurka/insight-book-plugin-api` после `activate`):
  - `ctx.api.llm.generate({ prompt, systemPrompt, json, temperature })` — вызовы LLM (AI) через бэкенд
  - `ctx.api.request<T>(url, options)` — HTTP-запросы через клиент приложения (с авторизацией, CORS, LLM-хедерами)
  - `ctx.api.client` — прямой доступ ко всем методам `api` хоста (`books`, `dictionary`, `quiz`, `tts`, `activity`, и др.)
  - `ctx.api.dictionary.getWords()`
  - `ctx.api.reader.getCurrentBook()`
  - `ctx.api.user.getProfile()`

