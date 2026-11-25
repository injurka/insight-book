<script setup lang="ts">
import type { UserRecentBook } from '~/01.shared/types/models'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { formatRelativeTime, usagePercent } from '~/03.domain/user'

interface Props {
  books: UserRecentBook[]
}

defineProps<Props>()
</script>

<template>
  <KitPanel title="Последние книги" icon="mdi:book-open-page-variant-outline">
    <ul v-if="books.length" class="books">
      <li v-for="book in books" :key="book.bookId" class="book">
        <div class="book__top">
          <span class="book__title" :title="book.title">{{ book.title }}</span>
          <span class="book__lang">{{ book.language }}</span>
        </div>
        <div class="book__bar">
          <div class="book__bar-fill" :style="{ width: `${usagePercent(book.currentPage, book.totalPages)}%` }" />
        </div>
        <div class="book__meta">
          <span>
            Стр. {{ book.currentPage }} / {{ book.totalPages || '?' }}
            ({{ usagePercent(book.currentPage, book.totalPages) }}%)
          </span>
          <span>{{ formatRelativeTime(book.updatedAt) }}</span>
        </div>
      </li>
    </ul>
    <p v-else class="empty">
      Пользователь ещё не открывал книги
    </p>
  </KitPanel>
</template>

<style scoped>
.books {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.book {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.book__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.book__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book__lang {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.book__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.book__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--fg-accent-color, #4b8266);
}

.book__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.empty {
  margin: 0;
  padding: 12px 0;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
