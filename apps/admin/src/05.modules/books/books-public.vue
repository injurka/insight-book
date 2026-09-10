<script setup lang="ts">
import type { PublicBook } from '~/03.domain/book'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitPagination from '~/02.kit/molecules/kit-pagination.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

const { admin } = useRepos()

const books = ref<PublicBook[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const search = ref('')
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const deletingId = ref<number | null>(null)
const updatingId = ref<number | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await admin.listPublicBooks({ page: page.value, limit, search: search.value.trim() || undefined })
    books.value = res.data
    total.value = res.total
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleUnpublish(book: PublicBook) {
  if (!confirm(`Снять книгу "${book.title}" (ID: ${book.id}) с публикации? Книга останется у владельца, но перестанет быть публичной.`))
    return

  updatingId.value = book.id
  actionMsg.value = ''
  try {
    await admin.setBookStatus(book.id, 'rejected')
    actionMsg.value = `Книга "${book.title}" успешно снята с публикации`
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    updatingId.value = null
  }
}

async function handleDelete(book: PublicBook) {
  if (!confirm(`Вы действительно хотите удалить публичную книгу "${book.title}" (ID: ${book.id})? Это действие необратимо и удалит все связанные файлы.`))
    return

  deletingId.value = book.id
  actionMsg.value = ''
  try {
    await admin.deleteBook(book.id)
    actionMsg.value = `Книга "${book.title}" успешно удалена`
    if (books.value.length === 1 && page.value > 1) {
      page.value--
    }

    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    deletingId.value = null
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

let searchTimer: ReturnType<typeof setTimeout>

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

function onPageChange(p: number) {
  page.value = p
  load()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

onMounted(() => load())
</script>

<template>
  <div class="public-books">
    <div class="public-books__header">
      <h1 class="public-books__title">
        <Icon icon="mdi:book-multiple" class="public-books__title-icon" />
        <span>Публичные книги</span>
        <span v-if="!loading" class="public-books__count-badge">
          {{ total }}
        </span>
      </h1>
    </div>

    <div class="public-books__toolbar">
      <KitInput
        v-model="search"
        placeholder="Поиск по названию или автору..."
        style="max-width: 400px;"
      />
    </div>

    <KitError v-if="error" :message="error" />
    <div v-if="actionMsg" class="public-books__success">
      {{ actionMsg }}
    </div>

    <table v-if="loading || books.length" class="public-books__table">
      <thead>
        <tr>
          <th style="width: 50px;">
            ID
          </th>
          <th>Название</th>
          <th>Автор</th>
          <th>Язык</th>
          <th>Тип</th>
          <th>Страниц</th>
          <th>Загрузил</th>
          <th>Дата</th>
          <th style="width: 100px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 5" :key="i">
          <td><KitSkeleton width="30px" height="16px" /></td>
          <td><KitSkeleton width="180px" height="16px" /></td>
          <td><KitSkeleton width="120px" height="16px" /></td>
          <td><KitSkeleton width="35px" height="16px" /></td>
          <td><KitSkeleton width="50px" height="16px" /></td>
          <td><KitSkeleton width="45px" height="16px" /></td>
          <td><KitSkeleton width="90px" height="16px" /></td>
          <td><KitSkeleton width="75px" height="16px" /></td>
          <td style="text-align: right;">
            <KitSkeleton
              width="32px"
              height="32px"
              border-radius="6px"
              style="display: inline-block;"
            />
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="book in books" :key="book.id">
          <td>{{ book.id }}</td>
          <td>
            <div class="public-books__title-cell">
              <div class="public-books__cover-wrapper">
                <img
                  v-if="book.coverUrl"
                  :src="book.coverUrl"
                  :alt="book.title"
                  class="public-books__cover"
                  loading="lazy"
                >
                <div v-else class="public-books__cover-placeholder">
                  <Icon icon="mdi:book-outline" />
                </div>
              </div>
              <span class="public-books__book-title">{{ book.title }}</span>
            </div>
          </td>
          <td class="public-books__muted">
            {{ book.author || '—' }}
          </td>
          <td>
            <KitBadge variant="default">
              {{ book.language.toUpperCase() }}
            </KitBadge>
          </td>
          <td>
            <span class="public-books__type-badge">{{ book.type }}</span>
          </td>
          <td>
            {{ book.totalPages || '—' }}
          </td>
          <td class="public-books__muted">
            {{ book.user?.username || '—' }}
          </td>
          <td class="public-books__muted public-books__small">
            {{ formatDate(book.createdAt) }}
          </td>
          <td>
            <div class="public-books__actions">
              <KitBtn
                variant="ghost"
                style="padding: 6px 8px; font-size: 14px"
                title="Снять с публикации"
                :loading="updatingId === book.id"
                @click="handleUnpublish(book)"
              >
                <Icon icon="mdi:eye-off-outline" />
              </KitBtn>
              <KitBtn
                variant="ghost-danger"
                style="padding: 6px 8px; font-size: 14px"
                title="Удалить книгу"
                :loading="deletingId === book.id"
                @click="handleDelete(book)"
              >
                <Icon icon="mdi:delete-outline" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <KitPagination
      v-if="!loading && totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @update:page="onPageChange"
    />

    <div v-if="!loading && !books.length && !error" class="public-books__empty">
      {{ search ? 'Ничего не найдено по запросу' : 'Публичные книги отсутствуют' }}
    </div>
  </div>
</template>

<style scoped>
.public-books__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.public-books__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.public-books__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}

.public-books__count-badge {
  font-size: 13px;
  font-weight: 500;
  background: var(--bg-tertiary-color, #d9d1c7);
  color: var(--fg-secondary-color, #8e867b);
  padding: 2px 8px;
  border-radius: 12px;
}

.public-books__toolbar {
  margin-bottom: 16px;
}

.public-books__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-bottom: 12px;
}

.public-books__table {
  width: 100%;
  border-collapse: collapse;
}

.public-books__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}

.public-books__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}

.public-books__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}

.public-books__title-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.public-books__cover-wrapper {
  width: 32px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-tertiary-color, #e0d8cc);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.public-books__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.public-books__cover-placeholder {
  color: var(--fg-secondary-color, #8e867b);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.public-books__book-title {
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
}

.public-books__muted {
  color: var(--fg-secondary-color, #8e867b);
}

.public-books__small {
  font-size: 13px;
}

.public-books__type-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-tertiary-color, #e0d8cc);
  padding: 2px 6px;
  border-radius: 4px;
}

.public-books__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.public-books__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 48px;
}
</style>
