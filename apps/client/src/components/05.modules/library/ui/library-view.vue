<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { useElementSize, useVirtualList } from '@vueuse/core'
import { KitBtn, KitInput, KitSelect, KitSkeleton } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useLibraryStore } from '../store/library.store'
import BookCard from './book-card.vue'
import EditBookModal from './edit-book-modal.vue'

const store = useLibraryStore()
const router = useRouter()
const toast = useToast()
const { theme, toggleTheme } = useChangeTheme()

const fileInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const selectedLang = ref('all')
const editModalOpen = ref(false)
const selectedBookToEdit = ref<Book | null>(null)

const langOptions = computed(() => {
  const langs = new Set(store.books.map(b => b.language))
  const opts = [{ label: 'Все языки', value: 'all' }]
  langs.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
  return opts
})

const filteredBooks = computed(() => {
  return store.books.filter((b) => {
    const matchLang = selectedLang.value === 'all' || b.language === selectedLang.value
    const matchSearch = b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
      || (b.author && b.author.toLowerCase().includes(searchQuery.value.toLowerCase()))
    return matchLang && matchSearch
  })
})

const listContainer = ref<HTMLElement | null>(null)
const { width } = useElementSize(listContainer)

const columnsCount = computed(() => {
  if (width.value === 0)
    return 1
  return Math.max(1, Math.floor((width.value + 24) / 244))
})

const rowData = computed(() => {
  const rows = []
  const books = filteredBooks.value
  for (let i = 0; i < books.length; i += columnsCount.value) {
    rows.push({ id: `row_${i}`, items: books.slice(i, i + columnsCount.value) })
  }
  return rows
})

const { list, containerProps, wrapperProps } = useVirtualList(rowData, {
  itemHeight: 360,
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    store.uploadBook(target.files[0])
    target.value = ''
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
  store.fetchBooks()
})
</script>

<template>
  <div class="library-view">
    <header class="library-header">
      <div class="header-top">
        <div class="header-title">
          <h1>Insight Book</h1>
          <p>Ваша умная библиотека для изучения языков</p>
        </div>
        <KitBtn
          :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
          variant="text"
          @click="toggleTheme"
        />
      </div>

      <div class="header-bottom">
        <div class="filters">
          <KitInput v-model="searchQuery" placeholder="Поиск книг..." size="md" />
          <KitSelect v-model="selectedLang" :options="langOptions" size="md" />
        </div>
        <div class="header-actions">
          <KitBtn icon="mdi:book-alphabet" variant="outlined" color="secondary" @click="router.push(AppRoutePaths.Dictionary)">
            Мой словарь
          </KitBtn>
          <KitBtn icon="mdi:upload" color="primary" @click="fileInput?.click()">
            Загрузить
          </KitBtn>
          <input ref="fileInput" type="file" accept=".epub,.cbz,.zip" style="display: none" @change="onFileChange">
        </div>
      </div>
    </header>

    <div v-if="store.isLoading && !store.books.length" class="books-grid-loading">
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
      <p>Загрузите свою первую книгу в формате EPUB или CBZ.</p>
    </div>

    <div v-else-if="filteredBooks.length === 0" class="empty-state">
      <h2>Книги не найдены</h2>
    </div>

    <div v-else ref="listContainer" class="library-list-wrapper">
      <div class="virtual-list-container" v-bind="containerProps">
        <div v-bind="wrapperProps" class="virtual-list-wrapper">
          <div v-for="row in list" :key="row.data.id" class="virtual-row">
            <BookCard
              v-for="book in row.data.items"
              :key="book.id"
              :book="book"
              class="virtual-book-card"
              @click="openBookInfo(book)"
              @edit="openEditModal(book)"
            />
          </div>
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
</template>

<style lang="scss" scoped>
.library-view {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100dvh;
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding: 16px;
  }
}

.library-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    .header-title h1 {
      font-size: 2.2rem;
      margin: 0 0 8px 0;
      color: var(--fg-primary-color);
    }
    .header-title p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 1rem;
    }
  }
  .header-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    .filters {
      display: flex;
      gap: 12px;
      flex-grow: 1;
      max-width: 500px;
    }
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
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

.books-grid-loading {
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

.library-list-wrapper {
  flex-grow: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.virtual-list-container {
  flex-grow: 1;
  overflow-y: auto;
  padding-bottom: 24px;
  padding-top: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.virtual-list-wrapper {
  display: flex;
  flex-direction: column;
}

.virtual-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.virtual-book-card {
  width: 100%;
}
</style>
