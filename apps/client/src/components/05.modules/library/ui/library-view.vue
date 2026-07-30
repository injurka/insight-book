<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitPrompt } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { BOOK_TAGS } from '~/shared/constants/tags'
import { coverTransitionBookId } from '~/shared/lib/view-transitions'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useLibraryDisplay } from '../composables/use-library-display'
import { useLibraryStore } from '../store/library.store'

import LibraryHeader from './library-header.vue'

// Подкомпоненты
import LibraryPersonalGroups from './partials/library-personal-groups.vue'
import LibraryPublicCatalog from './partials/library-public-catalog.vue'
import LibrarySidebar from './partials/library-sidebar.vue'
import LibrarySkeletonGrid from './partials/library-skeleton-grid.vue'

// Модалки
const EditBookModal = lazyComponent(() => import('./modal/edit-book-modal.vue'))
const UploadBookModal = lazyComponent(() => import('./modal/upload-book-modal.vue'))

const store = useLibraryStore()
const authStore = useAuthStore()
const settingsStore = useGlobalSettingsStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const {
  searchQuery,
  selectedLang,
  currentView,
  activeFolder,
  langOptions,
  displayGroups,
} = useLibraryDisplay()

const editModalOpen = ref(false)
const selectedBookToEdit = ref<Book | null>(null)

const isHidePromptOpen = ref(false)
const bookToHideId = ref<number | null>(null)
const isMobileMenuOpen = ref(false)
const isUploadModalOpen = ref(false)

const publicTagFilter = ref('all')
const tagOptions = computed(() => {
  const opts = [{ label: t('library.allTags'), value: 'all' }]
  for (const [key, val] of Object.entries(BOOK_TAGS)) {
    opts.push({ label: val[settingsStore.appLanguage as keyof typeof val] || val.en, value: key })
  }
  return opts
})

function loadPublic(page: number, append = false) {
  store.fetchPublicBooks(
    page,
    publicTagFilter.value === 'all' ? undefined : publicTagFilter.value,
    searchQuery.value,
    selectedLang.value === 'all' ? undefined : selectedLang.value,
    append,
  )
}

function loadMorePublic() {
  if (store.publicHasMore)
    loadPublic(store.publicPage + 1, true)
}

watch([searchQuery, selectedLang, publicTagFilter], () => {
  if (currentView.value === 'public-catalog') {
    loadPublic(1)
  }
})

watch(currentView, (val) => {
  activeFolder.value = null
  if (val === 'public-catalog' && store.publicBooks.length === 0) {
    loadPublic(1)
  }
})

const menuItems = computed(() => {
  const items = []
  if (authStore.user || authStore.isSingleMode) {
    items.push({ id: 'reading-now', label: t('library.menuReadingNow'), icon: 'mdi:book-open-page-variant-outline' })
    items.push({ id: 'books', label: t('library.menuBooks'), icon: 'mdi:book-open-blank-variant' })
    items.push({ id: 'favorites', label: t('library.menuFavorites'), icon: 'mdi:star-outline' })
    items.push({ id: 'to-read', label: t('library.menuToRead'), icon: 'mdi:clock-outline' })
    items.push({ id: 'have-read', label: t('library.menuHaveRead'), icon: 'mdi:check-all' })
    items.push({ id: 'authors', label: t('library.menuAuthors'), icon: 'mdi:account-group-outline' })
    items.push({ id: 'series', label: t('library.menuSeries'), icon: 'mdi:folder-outline' })
    items.push({ id: 'collections', label: t('library.menuCollections'), icon: 'mdi:bookshelf' })
  }
  if (!authStore.isSingleMode) {
    items.push({ id: 'public-catalog', label: t('library.menuPublicCatalog'), icon: 'mdi:earth' })
  }
  return items
})

function openBookInfo(book: Book) {
  // Помечаем обложку для shared-element перехода (View Transitions API)
  coverTransitionBookId.value = book.id
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
  if (bookToHideId.value)
    handleDeleteBook(bookToHideId.value)
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
    toast.success(t('library.bookUpdated'))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('library.updateError'))
  }
}

async function handleDeleteBook(id: number) {
  await store.deleteBook(id)
  editModalOpen.value = false
  toast.success(t('library.bookDeleted'))
}

// --- Поллинг статуса обработки книг ---
let pollInterval: ReturnType<typeof setInterval> | null = null

function setupPolling() {
  if (pollInterval)
    clearInterval(pollInterval)

  if (store.books.some(b => b.processStatus === 'processing')) {
    pollInterval = setInterval(async () => {
      await store.fetchBooks()
      if (!store.books.some(b => b.processStatus === 'processing')) {
        clearInterval(pollInterval!)
        pollInterval = null
      }
    }, 3000)
  }
}

watch(() => store.books, () => {
  setupPolling()
}, { deep: true })

onMounted(() => {
  // Прогреваем чанк страницы книги, чтобы первый переход на неё
  // (View Transitions API) начинался мгновенно, без загрузки модуля
  void import('~/pages/book.vue')

  if (!authStore.user && !authStore.isSingleMode) {
    currentView.value = 'public-catalog'
    loadPublic(1)
  }
  else {
    store.fetchBooks().then(setupPolling).catch(() => {})
  }
})

onUnmounted(() => {
  if (pollInterval)
    clearInterval(pollInterval)
})
</script>

<template>
  <div class="library-page-scroll">
    <HoverRevealBg />

    <div class="library-view">
      <div class="library-layout">
        <LibrarySidebar
          v-model:is-mobile-menu-open="isMobileMenuOpen"
          :items="menuItems"
          :current-view="currentView"
          @select="(id) => currentView = id"
        />

        <div class="library-main">
          <LibraryHeader
            v-model:search="searchQuery"
            v-model:lang="selectedLang"
            v-model:tag="publicTagFilter"
            :lang-options="langOptions"
            :tag-options="tagOptions"
            :show-tag-filter="currentView === 'public-catalog'"
            :show-menu-btn="menuItems.length > 1"
            @open-menu="isMobileMenuOpen = true"
            @open-upload-modal="isUploadModalOpen = true"
          />

          <LibrarySkeletonGrid v-if="(!store.isInitialized || store.isLoading) && (!store.books.length && !store.publicBooks.length)" :show-title="true" />

          <LibraryPublicCatalog
            v-else-if="currentView === 'public-catalog'"
            :books="store.publicBooks"
            :is-loading="store.isPublicLoading"
            :has-more="store.publicHasMore"
            @load-more="loadMorePublic"
            @open-book="openBookInfo"
            @edit-book="openEditModal"
          />

          <div v-else-if="store.books.length === 0 && store.isInitialized" class="empty-state">
            <h2>{{ t('library.emptyStateTitle') }}</h2>
            <p v-if="authStore.user">
              {{ t('library.emptyStateAuth') }}
            </p>
            <p v-else>
              {{ t('library.emptyStateGuest') }}
            </p>
          </div>

          <LibraryPersonalGroups
            v-else
            v-model:active-folder="activeFolder"
            :groups="displayGroups"
            :current-view="currentView"
            @open-book="openBookInfo"
            @edit-book="openEditModal"
          />
        </div>
      </div>

      <EditBookModal
        v-model:visible="editModalOpen"
        :book="selectedBookToEdit"
        @save="handleSaveEdit"
        @delete="handleDeleteBook"
      />

      <UploadBookModal v-model:visible="isUploadModalOpen" />

      <KitPrompt
        v-model:visible="isHidePromptOpen"
        :title="t('library.hidePromptTitle')"
        :description="t('library.hidePromptDesc')"
        :hide-input="true"
        :confirm-text="t('library.hideBtn')"
        :cancel-text="t('library.cancelBtn')"
        @submit="onConfirmHideBook"
      />

      <footer class="library-footer">
        <div class="footer-links">
          <router-link :to="AppRoutePaths.About" class="footer-link">
            О сайте
          </router-link>
          <span class="dot">·</span>
          <router-link :to="AppRoutePaths.Privacy" class="footer-link">
            Конфиденциальность
          </router-link>
          <span class="dot">·</span>
          <router-link :to="AppRoutePaths.Copyright" class="footer-link">
            Правообладателям
          </router-link>
        </div>
      </footer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.library-page-scroll {
  padding-top: var(--safe-area-top);
  padding-bottom: env(safe-area-inset-bottom, 0px);

  height: 100%;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;

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
  width: 100%;
  margin: 0 auto;
  flex: 1;
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

.library-main {
  flex-grow: 1;
  min-width: 0;
  min-height: 0;
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

.library-footer {
  padding: 24px 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: auto;

  .footer-links {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .footer-link {
    color: var(--fg-secondary-color);
    font-size: 0.85rem;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: var(--fg-primary-color);
    }
  }

  .dot {
    color: var(--border-secondary-color);
    font-size: 0.85rem;
  }
}
</style>
