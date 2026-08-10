<script setup lang="ts">
import type { PendingBook } from '~/03.domain/book'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

const { admin } = useRepos()

const books = ref<PendingBook[]>([])
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')

async function load() {
  loading.value = true
  try {
    books.value = await admin.pendingBooks()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleAction(bookId: number, status: 'approved' | 'rejected') {
  actionMsg.value = ''
  try {
    await admin.setBookStatus(bookId, status)
    actionMsg.value = `Книга ${status === 'approved' ? 'одобрена' : 'отклонена'}`
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

onMounted(() => load())
</script>

<template>
  <div>
    <h1 class="moderation__title">
      <Icon icon="mdi:book-open-variant" class="moderation__title-icon" />
      <span>Книги на модерацию</span>
    </h1>

    <KitError v-if="error" :message="error" />
    <div v-if="actionMsg" class="moderation__success">
      {{ actionMsg }}
    </div>

    <table v-if="loading || books.length" class="moderation__table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Автор</th>
          <th>Язык</th>
          <th>Загрузил</th>
          <th>Дата</th>
          <th style="width: 100px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 5" :key="i">
          <td>
            <KitSkeleton width="30px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="160px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="120px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="35px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="90px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="75px" height="16px" />
          </td>
          <td>
            <div class="moderation__actions">
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="book in books" :key="book.id">
          <td>{{ book.id }}</td>
          <td class="moderation__bold">
            {{ book.title }}
          </td>
          <td class="moderation__muted">
            {{ book.author || '—' }}
          </td>
          <td>{{ book.language }}</td>
          <td class="moderation__muted">
            {{ book.user?.username || '—' }}
          </td>
          <td class="moderation__muted moderation__small">
            {{ new Date(book.createdAt).toLocaleDateString('ru-RU') }}
          </td>
          <td>
            <div class="moderation__actions">
              <KitBtn
                variant="ghost-success"
                style="padding: 4px 6px; font-size: 12px"
                title="Одобрить"
                @click="handleAction(book.id, 'approved')"
              >
                <Icon icon="mdi:thumb-up" />
              </KitBtn>
              <KitBtn
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 12px"
                title="Отклонить"
                @click="handleAction(book.id, 'rejected')"
              >
                <Icon icon="mdi:thumb-down" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !books.length && !error" class="moderation__empty">
      Нет книг на модерации
    </div>
  </div>
</template>

<style scoped>
.moderation__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.moderation__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.moderation__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 8px;
  margin-bottom: 12px;
}
.moderation__table {
  width: 100%;
  border-collapse: collapse;
}
.moderation__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}
.moderation__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}
.moderation__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}
.moderation__bold {
  font-weight: 500;
}
.moderation__muted {
  color: var(--fg-secondary-color, #8e867b);
}
.moderation__small {
  font-size: 13px;
}
.moderation__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.moderation__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
.moderation__skeleton {
  padding: 0;
}
</style>
