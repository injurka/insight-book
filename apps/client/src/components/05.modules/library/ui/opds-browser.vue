<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { KitBtn, KitDialog, KitInput, KitSkeleton } from '~/components/01.kit'
import { useOpdsStore } from '../store/opds.store'

const opdsStore = useOpdsStore()

const isAddPromptOpen = ref(false)
const newCatalogTitle = ref('')
const newCatalogUrl = ref('')

// Предустановленные популярные каталоги
const SUGGESTED_CATALOGS = [
  { title: 'Flibusta (Флибуста)', url: 'http://flibusta.is/opds' },
  { title: 'Project Gutenberg', url: 'https://m.gutenberg.org/ebooks.opds' },
  { title: 'Standard Ebooks', url: 'https://standardebooks.org/opds/all' },
  { title: 'Internet Archive', url: 'https://bookserver.archive.org/catalog/' },
]

// Navigation history
const history = ref<string[]>([])
const currentUrl = ref<string | null>(null)

onMounted(() => {
  opdsStore.fetchCatalogs()
})

function openAddCatalog() {
  newCatalogTitle.value = ''
  newCatalogUrl.value = 'http://'
  isAddPromptOpen.value = true
}

function fillSuggested(title: string, url: string) {
  newCatalogTitle.value = title
  newCatalogUrl.value = url
}

async function handleAddSubmit() {
  if (newCatalogTitle.value && newCatalogUrl.value) {
    await opdsStore.addCatalog(newCatalogTitle.value, newCatalogUrl.value)
    isAddPromptOpen.value = false
  }
}

async function browse(url: string) {
  if (currentUrl.value)
    history.value.push(currentUrl.value)
  currentUrl.value = url
  await opdsStore.browse(url)
}

async function goBack() {
  if (history.value.length > 0) {
    const prevUrl = history.value.pop()!
    currentUrl.value = prevUrl
    await opdsStore.browse(prevUrl)
  }
  else {
    currentUrl.value = null
    opdsStore.currentFeed = null
  }
}

function getImageUrl(entry: any) {
  const link = entry.links.find((l: any) => l.rel === 'http://opds-spec.org/image' || l.rel === 'http://opds-spec.org/image/thumbnail')
  return link ? link.href : null
}

function getDownloadLinks(entry: any) {
  return entry.links.filter((l: any) => l.rel === 'http://opds-spec.org/acquisition' || l.rel === 'http://opds-spec.org/acquisition/open-access')
}

function getNavLinks() {
  return opdsStore.currentFeed?.links.filter(l => l.rel === 'next' || l.rel === 'previous' || l.rel === 'search') || []
}

function getExt(type: string) {
  if (type.includes('epub'))
    return 'EPUB'
  if (type.includes('fb2'))
    return 'FB2'
  if (type.includes('cbz'))
    return 'CBZ'
  return type.split('/').pop()?.toUpperCase() || 'DL'
}

function onDownload(url: string, title: string, type: string) {
  opdsStore.downloadBook(url, title, type)
}
</script>

<template>
  <div class="opds-browser">
    <div v-if="!currentUrl" class="catalogs-view">
      <div class="header-row">
        <h2>Мои каталоги OPDS</h2>
        <KitBtn icon="mdi:plus" color="primary" @click="openAddCatalog">
          Добавить
        </KitBtn>
      </div>

      <div v-if="opdsStore.isLoading" class="loading-grid">
        <KitSkeleton v-for="i in 3" :key="i" width="100%" height="80px" border-radius="12px" />
      </div>

      <div v-else-if="opdsStore.catalogs.length === 0" class="empty-state">
        <Icon icon="mdi:web-off" />
        <p>У вас пока нет добавленных OPDS каталогов.</p>
        <p>Нажмите «Добавить», чтобы выбрать из популярных или ввести свой.</p>
      </div>

      <div v-else class="catalogs-list">
        <div v-for="catalog in opdsStore.catalogs" :key="catalog.id" class="catalog-card" @click="browse(catalog.url)">
          <div class="info">
            <Icon icon="mdi:web" class="icon" />
            <div class="text">
              <h3>{{ catalog.title }}</h3>
              <span>{{ catalog.url }}</span>
            </div>
          </div>
          <KitBtn icon="mdi:delete-outline" variant="text" color="error" @click.stop="opdsStore.deleteCatalog(catalog.id)" />
        </div>
      </div>
    </div>

    <div v-else class="feed-view">
      <div class="feed-header">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
        <h3>{{ opdsStore.currentFeed?.title || 'Загрузка...' }}</h3>
      </div>

      <div v-if="opdsStore.isBrowsing" class="loading-grid">
        <KitSkeleton v-for="i in 5" :key="i" width="100%" height="120px" border-radius="12px" />
      </div>

      <div v-else-if="opdsStore.currentFeed" class="feed-content">
        <div v-if="getNavLinks().length > 0" class="nav-links">
          <KitBtn v-for="l in getNavLinks()" :key="l.href" variant="tonal" size="sm" @click="browse(l.href)">
            {{ l.title || l.rel }}
          </KitBtn>
        </div>

        <div class="entries-list">
          <div v-for="(entry, idx) in opdsStore.currentFeed.entries" :key="idx" class="entry-card">
            <img v-if="getImageUrl(entry)" :src="getImageUrl(entry)" class="entry-cover">
            <div v-else class="entry-cover placeholder">
              <Icon icon="mdi:book-open-blank-variant" />
            </div>

            <div class="entry-info">
              <h4 class="entry-title">
                {{ entry.title }}
              </h4>
              <p class="entry-author">
                {{ entry.author }}
              </p>
              <div class="entry-content" v-html="entry.content" />

              <div class="entry-actions">
                <template v-for="link in entry.links" :key="link.href">
                  <KitBtn
                    v-if="link.rel === 'subsection' || link.type?.includes('atom+xml')"
                    variant="tonal" size="sm" @click="browse(link.href)"
                  >
                    Открыть
                  </KitBtn>
                </template>
                <div class="download-links">
                  <KitBtn
                    v-for="link in getDownloadLinks(entry)" :key="link.href"
                    variant="outlined" color="primary" size="sm" icon="mdi:download"
                    :disabled="opdsStore.isDownloading"
                    @click="onDownload(link.href, entry.title, link.type)"
                  >
                    {{ getExt(link.type) }}
                  </KitBtn>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="getNavLinks().length > 0" class="nav-links bottom">
          <KitBtn v-for="l in getNavLinks()" :key="l.href" variant="tonal" size="sm" @click="browse(l.href)">
            {{ l.title || l.rel }}
          </KitBtn>
        </div>
      </div>
    </div>

    <KitDialog v-model:visible="isAddPromptOpen" title="Добавить OPDS каталог" :max-width="450">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="suggested-catalogs">
          <label>Популярные каталоги:</label>
          <div class="chips">
            <KitBtn
              v-for="cat in SUGGESTED_CATALOGS"
              :key="cat.url"
              variant="tonal"
              size="xs"
              @click="fillSuggested(cat.title, cat.url)"
            >
              {{ cat.title }}
            </KitBtn>
          </div>
        </div>

        <div class="divider" />

        <div>
          <label style="font-size: 0.85rem; color: var(--fg-secondary-color)">Название</label>
          <KitInput v-model="newCatalogTitle" placeholder="Моя библиотека" />
        </div>
        <div>
          <label style="font-size: 0.85rem; color: var(--fg-secondary-color)">URL</label>
          <KitInput v-model="newCatalogUrl" placeholder="http://..." />
        </div>
      </div>
      <template #footer>
        <KitBtn variant="tonal" @click="isAddPromptOpen = false">
          Отмена
        </KitBtn>
        <KitBtn color="primary" @click="handleAddSubmit">
          Сохранить
        </KitBtn>
      </template>
    </KitDialog>

    <div v-if="opdsStore.isDownloading" class="downloading-overlay">
      <div class="loader-box">
        <Icon icon="mdi:cloud-download-outline" class="spin-icon" />
        <p>Скачивание книги...</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.opds-browser {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  h2 {
    margin: 0;
    color: var(--fg-primary-color);
  }
}
.catalogs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.catalog-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    transform 0.2s;
  &:hover {
    border-color: var(--fg-accent-color);
    transform: translateY(-2px);
  }
  .info {
    display: flex;
    align-items: center;
    gap: 16px;
    .icon {
      font-size: 2rem;
      color: var(--fg-accent-color);
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--fg-primary-color);
      }
      span {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}
.feed-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  h3 {
    margin: 0;
    color: var(--fg-primary-color);
    font-size: 1.25rem;
  }
}
.nav-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  &.bottom {
    margin-top: 16px;
  }
}
.loading-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.entries-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.entry-card {
  display: flex;
  gap: 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 16px;
  border-radius: 12px;
  @include media-down(sm) {
    flex-direction: column;
  }
  .entry-cover {
    width: 100px;
    height: 150px;
    object-fit: cover;
    border-radius: 8px;
    background: var(--bg-tertiary-color);
    flex-shrink: 0;
    &.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: var(--fg-muted-color);
    }
  }
  .entry-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
    min-width: 0;
    .entry-title {
      margin: 0;
      font-size: 1.1rem;
      color: var(--fg-primary-color);
    }
    .entry-author {
      margin: 0;
      font-size: 0.9rem;
      color: var(--fg-accent-color);
    }
    .entry-content {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      :deep(*) {
        margin: 0;
        font-size: inherit;
      }
    }
    .entry-actions {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      .download-links {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    }
  }
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  border: 1px dashed var(--border-primary-color);
  border-radius: 12px;
  color: var(--fg-secondary-color);
  svg {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  p {
    margin: 0 0 8px;
  }
  code {
    background: var(--bg-tertiary-color);
    padding: 2px 6px;
    border-radius: 4px;
  }
}

.suggested-catalogs {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 4px 0;
}

.downloading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  .loader-box {
    background: var(--bg-secondary-color);
    padding: 32px;
    border-radius: 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    .spin-icon {
      font-size: 3rem;
      color: var(--fg-accent-color);
      animation: spin 1s linear infinite;
    }
    p {
      margin: 0;
      font-weight: 500;
    }
  }
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
