<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { KitBtn, KitDialog, KitInput, KitSelect, KitSkeleton } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'
import { useDictionaryStore } from '~/shared/store/dictionary.store'

const store = useBooksStore()
const dictStore = useDictionaryStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)

const { theme, toggleTheme } = useChangeTheme()

const dictOpen = ref(false)

// Фильтры
const searchQuery = ref('')
const selectedLang = ref('all')

const langOptions = computed(() => {
  const langs = new Set(store.books.map(b => b.language))
  const opts = [{ label: 'Все языки', value: 'all' }]
  langs.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
  return opts
})

const bookLanguageOptions = [
  { label: 'Английский (en)', value: 'en' },
  { label: 'Китайский (zh)', value: 'zh' },
  { label: 'Японский (ja)', value: 'ja' },
]

const filteredBooks = computed(() => {
  return store.books.filter((b) => {
    const matchLang = selectedLang.value === 'all' || b.language === selectedLang.value
    const matchSearch = b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
      || (b.author && b.author.toLowerCase().includes(searchQuery.value.toLowerCase()))
    return matchLang && matchSearch
  })
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    store.uploadBook(file)
  }
}

function openBookInfo(book: Book) {
  router.push(AppRoutePaths.Book.Info(book.id))
}

function openDictionary() {
  router.push(AppRoutePaths.Dictionary)
}

// Редактирование книги
const editModalOpen = ref(false)
const editingBook = ref<Partial<Book>>({})

function formatToDateTimeLocal(dateString?: string) {
  if (!dateString)
    return ''
  // Переводит "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDThh:mm"
  return dateString.replace(' ', 'T').slice(0, 16)
}

function parseFromDateTimeLocal(localString?: string) {
  if (!localString)
    return ''
  // Переводит "YYYY-MM-DDThh:mm" -> "YYYY-MM-DD HH:MM:00"
  return `${localString.replace('T', ' ')}:00`
}

function openEditModal(book: Book) {
  editingBook.value = {
    ...book,
    // Приводим "jp" к "ja", если такой вдруг появился в базе
    language: book.language === 'jp' ? 'ja' : book.language,
    createdAt: formatToDateTimeLocal(book.createdAt),
  }
  editModalOpen.value = true
}

function onEditCoverChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  const reader = new FileReader()
  reader.onload = (event) => {
    editingBook.value.coverBase64 = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function saveEditBook() {
  if (!editingBook.value.id)
    return

  const payload = { ...editingBook.value }
  payload.createdAt = parseFromDateTimeLocal(payload.createdAt)
  payload.currentPage = Number(payload.currentPage)

  await store.updateBookInfo(payload.id!, payload)
  editModalOpen.value = false
}

async function deleteFromEditModal() {
  if (!editingBook.value.id)
    return
  await store.deleteBook(editingBook.value.id)
  editModalOpen.value = false
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
          <KitBtn icon="mdi:book-alphabet" variant="outlined" color="secondary" @click="openDictionary">
            Мой словарь
          </KitBtn>
          <KitBtn icon="mdi:upload" color="primary" @click="fileInput?.click()">
            Загрузить EPUB
          </KitBtn>
          <input ref="fileInput" type="file" accept=".epub" style="display: none" @change="onFileChange">
        </div>
      </div>
    </header>

    <div v-if="store.isLoading" class="books-grid">
      <div v-for="i in 4" :key="i" class="book-card-skeleton">
        <div class="cover-skeleton" />
        <div class="info-skeleton">
          <KitSkeleton width="80%" height="18px" border-radius="4px" />
          <KitSkeleton width="50%" height="14px" border-radius="4px" />
          <KitSkeleton width="100%" height="4px" border-radius="2px" />
        </div>
      </div>
    </div>

    <div v-else-if="store.books.length === 0" class="empty-state">
      <h2>Библиотека пуста</h2>
      <p>Загрузите свою первую книгу в формате EPUB, чтобы начать чтение.</p>
    </div>

    <div v-else-if="filteredBooks.length === 0" class="empty-state">
      <h2>Книги не найдены</h2>
      <p>По вашему запросу ничего не нашлось. Попробуйте изменить фильтры.</p>
    </div>

    <div v-else class="books-grid">
      <div v-for="book in filteredBooks" :key="book.id" class="book-card" @click="openBookInfo(book)">
        <div class="cover-wrapper">
          <img v-if="book.coverBase64 && book.coverBase64.length > 100" :src="book.coverBase64" alt="Обложка" class="cover-img">
          <div v-else class="cover-placeholder">
            <span class="placeholder-icon">📚</span>
          </div>
          <span class="lang-badge">{{ book.language.toUpperCase() }}</span>

          <!-- Группа экшенов (Редактировать / Удалить) -->
          <div class="card-actions">
            <KitBtn
              class="action-btn"
              icon="mdi:file-document-edit-outline"
              variant="solid"
              color="secondary"
              size="xs"
              title="Редактировать"
              @click.stop="openEditModal(book)"
            />
          </div>
        </div>

        <div class="book-info">
          <h3 class="title" :title="book.title">
            {{ book.title }}
          </h3>
          <p v-if="book.author" class="author">
            {{ book.author }}
          </p>
          <div class="progress">
            <span>Стр. {{ book.currentPage || 1 }} из {{ book.totalPages }}</span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${((book.currentPage || 1) / book.totalPages) * 100}%` }" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модалка редактирования книги -->
    <KitDialog v-model:visible="editModalOpen" title="Редактировать книгу" icon="mdi:file-document-edit-outline" :max-width="500">
      <div class="edit-form-grid">
        <div class="form-group">
          <label>Обложка</label>
          <div class="edit-cover-preview" @click="$refs.editCoverInput?.click()">
            <img v-if="editingBook.coverBase64" :src="editingBook.coverBase64" alt="Обложка">
            <div v-else class="placeholder">
              <Icon icon="mdi:image-plus" />
            </div>
            <div class="overlay">
              Изменить
            </div>
          </div>
          <input ref="editCoverInput" type="file" accept="image/*" hidden @change="onEditCoverChange">
        </div>

        <div class="form-group">
          <label>Название</label>
          <KitInput v-model="editingBook.title!" placeholder="Название книги" />
        </div>

        <div class="form-group">
          <label>Автор</label>
          <KitInput v-model="editingBook.author!" placeholder="Имя автора" />
        </div>

        <div class="form-group row-group">
          <div class="form-group">
            <label>Язык</label>
            <KitSelect v-if="editingBook.language !== undefined" v-model="editingBook.language" :options="bookLanguageOptions" />
          </div>
        </div>

        <div class="form-group">
          <label>Дата добавления</label>
          <input v-model="editingBook.createdAt" type="datetime-local" class="native-date-input">
        </div>
      </div>

      <template #footer>
        <KitBtn variant="text" class="mr-auto" @click="deleteFromEditModal">
          Удалить
        </KitBtn>
        <div style="flex-grow:1" />
        <KitBtn variant="tonal" @click="editModalOpen = false">
          Отмена
        </KitBtn>
        <KitBtn color="primary" @click="saveEditBook">
          Сохранить
        </KitBtn>
      </template>
    </KitDialog>

    <!-- Модалка словаря -->
    <KitDialog v-model:visible="dictOpen" title="Мой словарь" :max-width="600" icon="mdi:book-open-page-variant">
      <div v-if="dictStore.words.length === 0" class="empty-dict">
        <p>Вы пока не добавили ни одного слова в словарь.</p>
      </div>
      <div v-else class="dict-list">
        <div v-for="item in dictStore.words" :key="item.id" class="dict-item">
          <div class="dict-item-content">
            <div class="dict-word-container">
              <span class="dict-word">{{ item.word }}</span>
              <span class="dict-transcription">{{ item.transcription }}</span>
            </div>
            <div class="dict-translation" v-html="item.translation" />
          </div>
          <KitBtn icon="mdi:delete-outline" variant="text" size="xs" @click="dictStore.deleteWord(item.word)" />
        </div>
      </div>
    </KitDialog>
  </div>
</template>

<style lang="scss" scoped>
.library-view {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100dvh;

  @include media-down(md) {
    padding: 16px;
  }
}

.library-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .header-title {
      h1 {
        font-size: 2.2rem;
        margin: 0 0 8px 0;
        color: var(--fg-primary-color);
      }
      p {
        margin: 0;
        color: var(--fg-secondary-color);
        font-size: 1rem;
      }
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

    @include media-down(sm) {
      flex-direction: column;
      align-items: stretch;

      .filters {
        max-width: 100%;
      }
      .header-actions {
        width: 100%;
        .kit-btn {
          flex: 1;
        }
      }
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

.book-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    border-color: var(--fg-accent-color);

    .card-actions {
      opacity: 1;
      visibility: visible;
    }
  }

  .cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    background-color: var(--bg-tertiary-color);
    overflow: hidden;
    border-bottom: 1px solid var(--border-secondary-color);

    .cover-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cover-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      opacity: 0.5;
    }

    .lang-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--bg-overlay-secondary-color);
      color: var(--fg-inverted-color);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      backdrop-filter: blur(4px);
    }

    .card-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      transition: all 0.2s ease-in-out;
      z-index: 10;

      .action-btn {
        box-shadow: none;
        color: var(--fg-primary-color);
      }
    }
  }

  .book-info {
    padding: 16px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    .title {
      margin: 0 0 6px 0;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .author {
      margin: 0 0 16px 0;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }

    .progress {
      margin-top: auto;
      font-size: 0.85rem;
      color: var(--fg-muted-color);

      .progress-bar {
        margin-top: 6px;
        height: 4px;
        background-color: var(--bg-tertiary-color);
        border-radius: 2px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background-color: var(--fg-accent-color);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      }
    }
  }
}

.edit-form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }
  }

  .row-group {
    flex-direction: row;
    align-items: center;
    gap: 12px;

    .form-group {
      flex: 1;
    }
  }

  .native-date-input {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    font-family: inherit;
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: 6px;
    outline: none;
    height: 38px;
    padding: 0 12px;
    font-size: 0.875rem;

    &:focus {
      border-color: var(--fg-accent-color);
    }
  }
}

.edit-cover-preview {
  width: 120px;
  height: 180px;
  border-radius: 8px;
  background-color: var(--bg-tertiary-color);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border: 1px dashed var(--border-primary-color);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--fg-secondary-color);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .overlay {
    opacity: 1;
  }
}

.dict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dict-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  .dict-item-content {
    flex-grow: 1;
  }
  .dict-word-container {
    margin-bottom: 4px;
    .dict-word {
      font-size: 1.2rem;
      font-weight: bold;
      margin-right: 8px;
      color: var(--fg-accent-color);
    }
    .dict-transcription {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }
  .dict-translation {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    line-height: 1.4;
    white-space: pre-wrap;
    
    :deep(b) {
      font-weight: 600;
    }
    :deep(.dict-pos) {
      color: var(--fg-success-color);
      font-style: italic;
      font-size: 0.9em;
    }
    :deep(.dict-color) {
      color: var(--fg-info-color);
    }
    :deep(.dict-example) {
      color: var(--fg-secondary-color);
      display: block;
      margin-top: 4px;
      padding-left: 8px;
    }
  }
}
</style>
