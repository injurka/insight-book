# Руководство по разработке и сборке динамических плагинов для InsightBook

Плагины в InsightBook загружаются динамически в рантайме как независимые **ESM-модули** по URL (например, из GitHub Pages, S3 или CDN).

---

## 1. Структура манифеста плагина (`manifest.json`)

Каждый динамический плагин должен содержать файл `manifest.json`:

```json
{
  "id": "my-custom-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Описание моего динамического плагина",
  "icon": "mdi:star-outline",
  "entryUrl": "./index.js"
}
```

---

## 2. Конфигурация Vite (`vite.config.ts`)

Чтобы плагин использовал единый контекст приложения (Vue, Vue Router, Plugin API) и не сбандлил их внутрь себя, их необходимо отметить как **`external`** в конфигурации сборщика.

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        '@injurka/insight-book-plugin-api',
      ],
    },
  },
})
```

---

## 3. Пример плагина (`src/index.ts`)

```typescript
import type { InsightBookPlugin, InsightBookPluginContext } from '@injurka/insight-book-plugin-api'
import MyTrainingModeWidget from './components/MyTrainingModeWidget.vue'

const plugin: InsightBookPlugin = {
  id: 'my-custom-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Пример динамического плагина',

  async activate(ctx: InsightBookPluginContext) {
    // 1. Регистрация UI-виджета в точке расширения
    ctx.registerUIWidget(
      'dictionary:training-modes',
      'my-custom-training-mode',
      MyTrainingModeWidget
    )

    // 2. Использование стабильного API приложения (Facade)
    const words = await ctx.api.dictionary.getWords()
    console.log('Пользовательские слова:', words)

    ctx.notify('Плагин успешно активирован!', 'success')
  },

  async deactivate(ctx: InsightBookPluginContext) {
    ctx.unregisterUIWidget('my-custom-training-mode')
    ctx.notify('Плагин деактивирован', 'info')
  }
}

export default plugin
```

---

## 4. Точки расширения (Extension Points)

Плагины могут регистрировать кастомные UI-виджеты в следующие точки расширения:
- `'dictionary:training-modes'` — Карточки новых режимов тренировки в словаре.
- `'reader:header-actions'` — Кнопки действий в шапке читалки книг.
- `'settings:custom-tab'` — Кастомные вкладки или элементы в настройках.
- `'srs-card:toolbar-actions'` — Кнопки действий внутри панели управления карточкой словаря (SRS).
- `'srs-card:below-toolbar'` — Дополнительные блоки с информацией или визуализацией под панелью управления карточкой словаря.

---

## 5. Установка плагина пользователем

В приложении перейти в **Настройки -> Плагины -> Добавить по URL** и ввести URL вашего `manifest.json`.
