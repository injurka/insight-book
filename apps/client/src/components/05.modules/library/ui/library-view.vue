<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitDialog, KitSkeleton } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useLibraryStore } from '../store/library.store'
import BookCard from './book-card.vue'
import EditBookModal from './edit-book-modal.vue'
import LibraryHeader from './library-header.vue'

const store = useLibraryStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const searchQuery = ref('')
const selectedLang = ref('all')
const editModalOpen = ref(false)
const selectedBookToEdit = ref<Book | null>(null)

// Навигация
const currentView = ref('reading-now')
const isMobileMenuOpen = ref(false)

const menuItems = [
  { id: 'reading-now', label: 'Читаю сейчас', icon: 'mdi:book-open-page-variant-outline' },
  { id: 'books', label: 'Книги и документы', icon: 'mdi:book-open-blank-variant' },
  { id: 'favorites', label: 'Избранное', icon: 'mdi:star-outline' },
  { id: 'to-read', label: 'Хочу прочитать', icon: 'mdi:clock-outline' },
  { id: 'have-read', label: 'Прочитано', icon: 'mdi:check-all' },
  { id: 'authors', label: 'Авторы', icon: 'mdi:account-group-outline' },
  { id: 'series', label: 'Серии', icon: 'mdi:folder-outline' },
  { id: 'collections', label: 'Коллекции', icon: 'mdi:bookshelf' },
]

function getSeriesIcon(seriesName: string) {
  if (seriesName === 'Все книги')
    return 'mdi:book-open-blank-variant'
  const menuMatch = menuItems.find(m => m.label === seriesName)
  if (menuMatch)
    return menuMatch.icon
  return 'mdi:folder-open-outline'
}

const langOptions = computed(() => {
  const langs = new Set(store.books.map(b => b.language))
  const opts = [{ label: 'Все языки', value: 'all' }]
  langs.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
  return opts
})

const displayGroups = computed(() => {
  let filtered = store.books.filter((b) => {
    const matchLang = selectedLang.value === 'all' || b.language === selectedLang.value
    const matchSearch = b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
      || (b.author && b.author.toLowerCase().includes(searchQuery.value.toLowerCase()))
    return matchLang && matchSearch
  })

  // Читаю сейчас
  if (currentView.value === 'reading-now') {
    filtered = filtered.filter(b => b.status === 'reading' || !b.status)
    filtered.sort((a, b) => {
      const tA = new Date(a.progressUpdatedAt || a.updatedAt).getTime()
      const tB = new Date(b.progressUpdatedAt || b.updatedAt).getTime()
      return tB - tA
    })
    return [{ seriesName: 'Читаю сейчас', books: filtered }]
  }

  // Избранное
  if (currentView.value === 'favorites') {
    filtered = filtered.filter(b => b.isFavorite)
    return [{ seriesName: 'Избранное', books: filtered }]
  }

  // Хочу прочитать
  if (currentView.value === 'to-read') {
    filtered = filtered.filter(b => b.status === 'to-read')
    return [{ seriesName: 'Хочу прочитать', books: filtered }]
  }

  // Прочитано
  if (currentView.value === 'have-read') {
    filtered = filtered.filter(b => b.status === 'have-read')
    return [{ seriesName: 'Прочитано', books: filtered }]
  }

  // Авторы
  if (currentView.value === 'authors') {
    if (filtered.length === 0)
      return [{ seriesName: 'Авторы', books: [] }]
    const groups: Record<string, Book[]> = {}
    filtered.forEach((b) => {
      const key = b.author?.trim() || 'Неизвестный автор'
      if (!groups[key])
        groups[key] = []
      groups[key].push(b)
    })
    return Object.keys(groups).sort().map(k => ({ seriesName: k, books: groups[k] }))
  }

  // Коллекции
  if (currentView.value === 'collections') {
    if (filtered.length === 0)
      return [{ seriesName: 'Коллекции', books: [] }]
    const groups: Record<string, Book[]> = {}
    filtered.forEach((b) => {
      const key = b.collection?.trim() || 'Без коллекции'
      if (!groups[key])
        groups[key] = []
      groups[key].push(b)
    })
    return Object.keys(groups).sort().map(k => ({ seriesName: k, books: groups[k] }))
  }

  if (currentView.value === 'books') {
    return [{ seriesName: 'Все книги', books: filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) }]
  }

  // Серии
  if (filtered.length === 0)
    return [{ seriesName: 'Серии', books: [] }]
  const groups: Record<string, Book[]> = {}
  filtered.forEach((book) => {
    const key = book.series?.trim() ? book.series.trim() : 'Одиночные книги'
    if (!groups[key])
      groups[key] = []
    groups[key].push(book)
  })

  const result: { seriesName: string, books: Book[] }[] = []

  if (groups['Одиночные книги']) {
    result.push({ seriesName: 'Одиночные книги', books: groups['Одиночные книги'] })
    delete groups['Одиночные книги']
  }

  const seriesNames = Object.keys(groups).sort((a, b) => a.localeCompare(b))
  seriesNames.forEach((name) => {
    const books = groups[name]
    books.sort((a, b) => (a.seriesNumber || 0) - (b.seriesNumber || 0))
    result.push({ seriesName: name, books })
  })

  return result
})

async function handleUpload(file: File) {
  try {
    await store.uploadBook(file)
    toast.success('Книга успешно добавлена')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка загрузки книги')
  }
}

function openBookInfo(book: Book) {
  router.push(AppRoutePaths.Book.Info(book.id))
}

function openEditModal(book: Book) {
  selectedBookToEdit.value = book
  editModalOpen.value = true
}

async function handleSaveEdit({ bookData, coverFile }: { bookData: Partial<Book>, coverFile: File | null }) {
  try {
    if (coverFile) {
      await store.updateBookCover(bookData.id!, coverFile)
      delete bookData.coverUrl
    }
    await store.updateBookInfo(bookData.id!, bookData)
    editModalOpen.value = false
    toast.success('Книга обновлена')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка обновления')
  }
}

async function handleDeleteBook(id: number) {
  await store.deleteBook(id)
  editModalOpen.value = false
  toast.success('Книга удалена')
}

onMounted(() => {
  store.fetchBooks().catch(() => {})
})
</script>

<template>
  <div class="library-page-scroll">
    <HoverRevealBg />

    <div class="library-view">
      <div class="library-layout">
        <!-- Сайдбар для десктопа -->
        <aside class="library-sidebar desktop-only">
          <ul class="nav-menu">
            <li
              v-for="item in menuItems"
              :key="item.id"
              class="nav-item"
              :class="{ active: currentView === item.id }"
              @click="currentView = item.id"
            >
              <Icon :icon="item.icon" /> {{ item.label }}
            </li>
          </ul>
        </aside>

        <!-- Мобильное меню -->
        <KitDialog v-model:visible="isMobileMenuOpen" title="Меню" :max-width="400" :floating="false">
          <ul class="nav-menu mobile-menu">
            <li
              v-for="item in menuItems"
              :key="item.id"
              class="nav-item"
              :class="{ active: currentView === item.id }"
              @click="currentView = item.id; isMobileMenuOpen = false"
            >
              <Icon :icon="item.icon" /> {{ item.label }}
            </li>
          </ul>
        </KitDialog>

        <div class="library-main">
          <LibraryHeader
            v-model:search="searchQuery"
            v-model:lang="selectedLang"
            :lang-options="langOptions"
            @upload="handleUpload"
            @open-menu="isMobileMenuOpen = true"
          />

          <div v-if="store.isLoading && !store.books.length" class="books-grid">
            <div v-for="i in 4" :key="i" class="book-card-skeleton">
              <div class="cover-skeleton" />
              <div class="info-skeleton">
                <KitSkeleton width="80%" height="18px" />
                <KitSkeleton width="50%" height="14px" />
              </div>
            </div>
          </div>

          <div v-else-if="store.books.length === 0" class="empty-state">
            <h2>Библиотека пуста</h2>
            <p v-if="authStore.user">
              Загрузите свою первую книгу в формате EPUB, FB2 или CBZ.
            </p>
            <p v-else>
              Авторизуйтесь, чтобы загружать и читать книги.
            </p>
          </div>

          <div v-else class="library-groups">
            <template v-for="group in displayGroups" :key="group.seriesName">
              <div class="series-section">
                <h3
                  v-if="group.seriesName !== 'Одиночные книги'"
                  class="series-title"
                >
                  <Icon :icon="getSeriesIcon(group.seriesName)" /> {{ group.seriesName }}
                </h3>

                <h3 v-else class="series-title">
                  Одиночные издания
                </h3>

                <div v-if="group.books.length === 0" class="empty-state">
                  <h2>В этом разделе пока пусто</h2>
                </div>

                <div v-else class="books-grid">
                  <BookCard
                    v-for="book in group.books"
                    :key="book.id"
                    :book="book"
                    @click="openBookInfo(book)"
                    @edit="openEditModal(book)"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <EditBookModal
        v-model:visible="editModalOpen"
        :book="selectedBookToEdit"
        @save="handleSaveEdit"
        @delete="handleDeleteBook"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.library-page-scroll {
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.library-view {
  padding: 16px;
  max-width: 1300px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1; /* Выше фона с цитатами */

  @include media-down(md) {
    padding: 8px;
  }
}

.library-layout {
  display: flex;
  align-items: flex-start;
  flex: 1;
  gap: 24px;
  height: 100%;
}

.library-sidebar {
  width: 250px;
  position: sticky;
  top: 228px;
  border-radius: 12px;
  padding: 12px;
  flex-shrink: 0;

  &.desktop-only {
    @include media-down(md) {
      display: none;
    }
  }
}

.nav-menu {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.mobile-menu {
    padding: 8px 0;
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  transition: all 0.2s;
  font-size: 0.95rem;
  font-weight: 500;

  svg {
    font-size: 1.3rem;
  }

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
    color: var(--fg-accent-color);
  }
}

.library-main {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 64px 24px;
  background-color: var(--bg-secondary-color);
  border-radius: 16px;
  border: 1px dashed var(--border-primary-color);
  h2 {
    margin-bottom: 12px;
    color: var(--fg-primary-color);
  }
  p {
    color: var(--fg-secondary-color);
  }
}

.library-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 24px;
}

.series-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  color: var(--fg-accent-color);
  margin: 0 0 16px 0;
  border-bottom: 2px solid var(--border-secondary-color);
  padding-bottom: 8px;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}

.book-card-skeleton {
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);
  .cover-skeleton {
    width: 100%;
    aspect-ratio: 2 / 3;
    background-color: var(--bg-tertiary-color);
  }
  .info-skeleton {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
