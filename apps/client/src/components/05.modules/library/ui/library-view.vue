<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)

const { theme, toggleTheme } = useChangeTheme()

onMounted(() => {
  store.fetchBooks()
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    store.uploadBook(file)
  }
}

function openBook(book: any) {
  store.openBook(book)
  router.push({
    path: '/reader',
    query: { bookId: book.id, page: book.currentPage || 1 },
  })
}
</script>

<template>
  <div class="library-view">
    <header class="library-header">
      <div class="header-title">
        <h1>Insight Book</h1>
        <p>Ваша умная библиотека для изучения китайского</p>
      </div>
      <div class="header-actions">
        <KitBtn
          :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
          variant="text"
          @click="toggleTheme"
        />
        <KitBtn icon="mdi:book-alphabet" variant="outlined" color="secondary" @click="router.push('/dictionary')">
          Мой словарь
        </KitBtn>
        <KitBtn icon="mdi:upload" color="primary" @click="fileInput?.click()">
          Загрузить EPUB
        </KitBtn>
        <input ref="fileInput" type="file" accept=".epub" style="display: none" @change="onFileChange">
      </div>
    </header>

    <div v-if="store.isLoading" class="books-grid">
      <div v-for="i in 4" :key="i" class="book-card-skeleton">
        <KitSkeleton width="100%" height="240px" border-radius="12px" class="mb-3" />
        <KitSkeleton width="80%" height="20px" />
        <KitSkeleton width="50%" height="16px" />
      </div>
    </div>

    <div v-else-if="store.books.length === 0" class="empty-state">
      <h2>Библиотека пуста</h2>
      <p>Загрузите свою первую книгу в формате EPUB, чтобы начать чтение.</p>
    </div>

    <div v-else class="books-grid">
      <div v-for="book in store.books" :key="book.id" class="book-card" @click="openBook(book)">
        <div class="cover-wrapper">
          <img v-if="book.coverBase64 && book.coverBase64.length > 100" :src="book.coverBase64" alt="Обложка" class="cover-img">
          <div v-else class="cover-placeholder">
            <span class="placeholder-icon">📚</span>
          </div>
          <KitBtn class="delete-btn" icon="mdi:delete" variant="solid" color="secondary" size="xs" @click.stop="store.deleteBook(book.id)" />
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
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;

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

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
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

    .delete-btn {
      opacity: 1;
    }
  }

  .cover-wrapper {
    position: relative;
    height: 280px;
    background-color: var(--bg-tertiary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-secondary-color);

    .cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-placeholder {
      font-size: 3rem;
      opacity: 0.5;
    }

    .delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s;
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
</style>
