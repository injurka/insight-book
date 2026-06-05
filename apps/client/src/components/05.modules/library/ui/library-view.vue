<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitDialog, KitPrompt, KitSkeleton } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

import { useLibraryDisplay } from '../composables/use-library-display'
import { useLibraryStore } from '../store/library.store'

import BookCard from './book-card.vue'
import EditBookModal from './edit-book-modal.vue'
import LibraryHeader from './library-header.vue'
import OpdsBrowser from './opds-browser.vue'
import UploadBookModal from './upload-book-modal.vue'

const store = useLibraryStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const { searchQuery, selectedLang, currentView, activeFolder, langOptions, displayGroups } = useLibraryDisplay()

const editModalOpen = ref(false)
const selectedBookToEdit = ref<Book | null>(null)

const isHidePromptOpen = ref(false)
const bookToHideId = ref<number | null>(null)
const isMobileMenuOpen = ref(false)
const isUploadModalOpen = ref(false)

const menuItems = [
  { id: 'reading-now', label: 'Читаю сейчас', icon: 'mdi:book-open-page-variant-outline' },
  { id: 'books', label: 'Книги и документы', icon: 'mdi:book-open-blank-variant' },
  { id: 'favorites', label: 'Избранное', icon: 'mdi:star-outline' },
  { id: 'to-read', label: 'Хочу прочитать', icon: 'mdi:clock-outline' },
  { id: 'have-read', label: 'Прочитано', icon: 'mdi:check-all' },
  { id: 'authors', label: 'Авторы', icon: 'mdi:account-group-outline' },
  { id: 'series', label: 'Серии', icon: 'mdi:folder-outline' },
  { id: 'collections', label: 'Коллекции', icon: 'mdi:bookshelf' },
  { id: 'opds', label: 'OPDS Каталоги', icon: 'mdi:web' },
]

function getFolderIcon(view: string) {
  if (view === 'authors')
    return 'mdi:account'
  if (view === 'series')
    return 'mdi:folder'
  if (view === 'collections')
    return 'mdi:bookshelf'
  return 'mdi:folder'
}

function openBookInfo(book: Book) {
  router.push(AppRoutePaths.Book.Info(book.id))
}

function openEditModal(book: Book) {
  if (book.userId !== authStore.user?.id) {
    bookToHideId.value = book.id
    isHidePromptOpen.value = true
    return
  }
  selectedBookToEdit.value = book
  editModalOpen.value = true
}

function onConfirmHideBook() {
  if (bookToHideId.value) {
    handleDeleteBook(bookToHideId.value)
  }
  bookToHideId.value = null
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
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Ошибка обновления')
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
            @open-menu="isMobileMenuOpen = true"
            @open-upload-modal="isUploadModalOpen = true"
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

          <div v-else-if="currentView === 'opds'" style="padding-top: 16px;">
            <OpdsBrowser />
          </div>

          <div v-else-if="store.books.length === 0" class="empty-state">
            <h2>Библиотека пуста</h2>
            <p v-if="authStore.user">
              Загрузите свою первую книгу или мангу.
            </p>
            <p v-else>
              Авторизуйтесь, чтобы загружать и читать книги.
            </p>
          </div>

          <div v-else class="library-groups">
            <template v-for="group in displayGroups" :key="group.seriesName">
              <div class="series-section">
                <h3 class="series-title">
                  <KitBtn
                    v-if="group.isFolderContent"
                    icon="mdi:arrow-left"
                    variant="text"
                    size="xs"
                    class="back-btn"
                    @click="activeFolder = null"
                  />
                  <Icon v-else :icon="group.icon || 'mdi:folder-outline'" />
                  <span class="text">{{ group.seriesName }}</span>
                </h3>

                <div v-if="group.folders" class="folders-list">
                  <div v-if="group.folders.length === 0" class="empty-state">
                    <h2>В этом разделе пока пусто</h2>
                  </div>
                  <div
                    v-for="folder in group.folders"
                    v-else
                    :key="folder.name"
                    class="folder-item"
                    @click="activeFolder = folder.name"
                  >
                    <Icon :icon="getFolderIcon(currentView)" class="folder-icon" />
                    <span class="folder-name">{{ folder.name }}</span>
                    <span class="folder-count">{{ folder.count }}</span>
                  </div>
                </div>

                <div v-else>
                  <div v-if="group.books?.length === 0" class="empty-state">
                    <h2>В этом разделе пока пусто</h2>
                  </div>
                  <div v-else-if="group.books" class="books-grid">
                    <BookCard
                      v-for="book in group.books"
                      :key="book.id"
                      :book="book"
                      @click="openBookInfo(book)"
                      @edit="openEditModal(book)"
                    />
                  </div>
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

      <UploadBookModal
        v-model:visible="isUploadModalOpen"
      />

      <KitPrompt
        v-model:visible="isHidePromptOpen"
        title="Скрыть книгу"
        description="Скрыть эту публичную книгу из вашей библиотеки? Ваш личный прогресс чтения будет удален."
        :hide-input="true"
        confirm-text="Скрыть"
        cancel-text="Отмена"
        @submit="onConfirmHideBook"
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
  z-index: 1;

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
  height: 28px;

  .back-btn {
    margin-right: -4px;
    margin-left: -8px;
  }
  .text {
    flex-grow: 1;
  }
}

.folders-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-item {
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition:
    transform 0.2s,
    border-color 0.2s;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--fg-accent-color);
  }

  .folder-icon {
    font-size: 1.5rem;
    color: var(--fg-secondary-color);
    margin-right: 16px;
  }

  .folder-name {
    flex-grow: 1;
    font-size: 1.05rem;
    color: var(--fg-primary-color);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-count {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);
    padding: 2px 10px;
    border-radius: 99px;
  }
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
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

  @include media-down(sm) {
    display: flex;
    flex-direction: row;
    height: 120px;
    padding: 12px;
    align-items: center;

    .cover-skeleton {
      width: 72px;
      height: 108px;
      flex-shrink: 0;
      border-radius: 6px;
    }
    .info-skeleton {
      flex-grow: 1;
      justify-content: center;
    }
  }
}
</style>
