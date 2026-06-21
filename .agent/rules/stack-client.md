---
description: Code Style Frontend (Vue 3)
globs: "apps/client/**/*"
---

# Технический стек и Стилизация

1. **Стили:** Мы используем [SCSS / Vue style scoped]. НИКОГДА не пиши инлайн-стили (`style="..."`).
2. **Иконки:** Для иконок мы используем `import { Icon } from '@iconify/vue'`. Запрещено вставлять сырые SVG прямо в шаблон, используй компонент `<Icon icon="..." />`.
3. **Язык:** Всегда используй TypeScript (`<script setup lang="ts">`).
