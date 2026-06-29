<script setup lang="ts">
import type { Book, Highlight } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitImage, KitInput, KitPrompt, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { GlobalActions } from '~/components/04.features/global-actions'
import { PronunciationCheck } from '~/components/04.features/pronunciation-check'
import { QuoteModal } from '~/components/04.features/quote-modal'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { api } from '~/shared/services/api.service'

interface BookGroup {
  book: Book
  highlights: Highlight[]
  lastActivityDate: string
}

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const libraryStore = useLibraryStore()
const tts = useTts()

const activeTtsId = ref<number | null>(null)

const highlights = ref<Highlight[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text: string | null | undefined, query: string): string {
  if (!text)
    return ''
  const trimmedQuery = query.trim()
  if (!trimmedQuery)
    return escapeHtml(text)

  const re = new RegExp(escapeRegExp(trimmedQuery), 'gi')
  let result = ''
  let lastIndex = 0

  text.replace(re, (match, offset) => {
    result += escapeHtml(text.slice(lastIndex, offset))
    result += `<mark class="text-match">${escapeHtml(match)}</mark>`
    lastIndex = offset + match.length
    return match
  })
  result += escapeHtml(text.slice(lastIndex))

  return result
}

// Edit state
const isEditModalOpen = ref(false)
const editForm = ref<{
  id: number | null
  text: string
  translation: string
  note: string
  color: string
}>({
  id: null,
  text: '',
  translation: '',
  note: '',
  color: '#fde047',
})

// Delete state
const isDeleteConfirmOpen = ref(false)
const deleteTargetId = ref<number | null>(null)

const searchQueryTrimmed = computed(() => searchQuery.value.trim().toLowerCase())

// Group quotes by book and filter by search
const filteredBookGroups = computed(() => {
  const query = searchQueryTrimmed.value
  const groupsMap: Record<number, Highlight[]> = {}

  highlights.value.forEach((h) => {
    const matchesSearch
      = !query
        || h.text.toLowerCase().includes(query)
        || (h.note && h.note.toLowerCase().includes(query))
        || (h.translation && h.translation.toLowerCase().includes(query))

    if (!matchesSearch)
      return

    if (!groupsMap[h.bookId]) {
      groupsMap[h.bookId] = []
    }
    groupsMap[h.bookId].push(h)
  })

  const groups: BookGroup[] = []

  for (const bookIdStr in groupsMap) {
    const bookId = Number(bookIdStr)
    const book = libraryStore.books.find(b => b.id === bookId)
    if (!book)
      continue

    const bookHighlights = groupsMap[bookId]
    // Get last highlight created date
    const lastActivity = bookHighlights.reduce((latest, current) => {
      return new Date(current.createdAt) > new Date(latest) ? current.createdAt : latest
    }, bookHighlights[0].createdAt)

    groups.push({
      book,
      highlights: bookHighlights,
      lastActivityDate: lastActivity,
    })
  }

  // Sort groups: most recent activity first
  return groups.sort(
    (a, b) => new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime(),
  )
})

const isTtsActive = computed(() => tts.isPlaying.value || tts.isLoading.value)

// Edit Actions
function openEditModal(h: Highlight) {
  editForm.value = {
    id: h.id,
    text: h.text,
    translation: h.translation || '',
    note: h.note || '',
    color: h.color || '#fde047',
  }
  isEditModalOpen.value = true
}

async function saveEdit(data: { text: string, translation: string, note: string, color: string }) {
  const id = editForm.value.id
  if (!id)
    return

  try {
    const updated = await api.highlights.update(id, {
      translation: data.translation || null,
      note: data.note || null,
      color: data.color,
    })

    // Update in local state
    const index = highlights.value.findIndex(h => h.id === id)
    if (index !== -1) {
      highlights.value[index] = { ...highlights.value[index], ...updated }
    }

    isEditModalOpen.value = false
    toast.success('Цитата сохранена')
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : 'Не удалось сохранить цитату')
  }
}

// Delete Actions
function confirmDelete(h: Highlight) {
  deleteTargetId.value = h.id
  isDeleteConfirmOpen.value = true
}

async function onDeleteConfirmSubmit() {
  const id = deleteTargetId.value
  if (!id)
    return

  try {
    await api.highlights.delete(id)
    highlights.value = highlights.value.filter(h => h.id !== id)
    toast.success('Цитата удалена')
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : 'Не удалось удалить цитату')
  }
  finally {
    deleteTargetId.value = null
  }
}

// Exports Features
function exportToMarkdown(group: BookGroup) {
  const { book, highlights } = group
  let content = `# Цитаты из книги: ${book.title}\n`
  if (book.author) {
    content += `**Автор**: ${book.author}\n`
  }
  content += `**Всего цитат**: ${highlights.length}\n\n---\n\n`

  // Sort highlights by page number ascending for export
  const sortedHighlights = [...highlights].sort((a, b) => a.pageNum - b.pageNum)

  sortedHighlights.forEach((h, index) => {
    content += `### Цитата №${index + 1} (Стр. ${h.pageNum})\n`
    if (h.chapter) {
      content += `*Глава: ${h.chapter}*\n\n`
    }
    content += `> ${h.text}\n\n`
    if (h.translation) {
      content += `**Перевод**:\n> ${h.translation}\n\n`
    }
    if (h.note) {
      content += `**Заметка**:\n${h.note}\n\n`
    }
    content += `*Добавлено: ${new Date(h.createdAt).toLocaleDateString()}*\n\n---\n\n`
  })

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${book.title.replace(/[/\\?%*:|"<>\s]/g, '_')}_quotes.md`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Экспорт в Markdown завершен')
}

function exportToPlainText(group: BookGroup) {
  const { book, highlights } = group
  let content = `Цитаты из книги: ${book.title}\n`
  if (book.author) {
    content += `Автор: ${book.author}\n`
  }
  content += `Всего цитат: ${highlights.length}\n\n`
  content += `=========================================\n\n`

  const sortedHighlights = [...highlights].sort((a, b) => a.pageNum - b.pageNum)

  sortedHighlights.forEach((h, index) => {
    content += `Цитата №${index + 1} (Стр. ${h.pageNum})\n`
    if (h.chapter) {
      content += `Глава: ${h.chapter}\n`
    }
    content += `-----------------------------------------\n`
    content += `"${h.text}"\n`
    if (h.translation) {
      content += `Перевод: ${h.translation}\n`
    }
    if (h.note) {
      content += `Заметка: ${h.note}\n`
    }
    content += `Добавлено: ${new Date(h.createdAt).toLocaleDateString()}\n`
    content += `=========================================\n\n`
  })

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${book.title.replace(/[/\\?%*:|"<>\s]/g, '_')}_quotes.txt`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Экспорт в текст завершен')
}

async function playTts(h: Highlight, book: Book) {
  if (activeTtsId.value === h.id && tts.isPlaying.value) {
    tts.stop()
    activeTtsId.value = null
    return
  }

  activeTtsId.value = h.id

  try {
    await tts.speak(h.text, book.language, book.id)
  }
  catch (err) {
    console.error('Playback error:', err)
    activeTtsId.value = null
  }
}

// AI Translation state
const translatingId = ref<number | null>(null)

async function translateQuote(h: Highlight, book: Book) {
  translatingId.value = h.id
  try {
    const res = await api.books.analyze(book.id, h.text, book.language)
    if (res && res.translation) {
      await api.highlights.update(h.id, {
        translation: res.translation,
      })

      const index = highlights.value.findIndex(item => item.id === h.id)
      if (index !== -1) {
        highlights.value[index] = { ...highlights.value[index], translation: res.translation }
      }
      toast.success('Перевод получен и сохранен')
    }
    else {
      toast.error('Не удалось получить перевод')
    }
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : 'Ошибка при получении перевода')
  }
  finally {
    translatingId.value = null
  }
}

onUnmounted(() => {
  tts.stop()
})

onMounted(async () => {
  isLoading.value = true
  try {
    if (libraryStore.books.length === 0) {
      await libraryStore.fetchBooks()
    }
    highlights.value = await api.highlights.list()
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : 'Ошибка загрузки цитат')
  }
  finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="notebook-page">
    <HoverRevealBg />

    <header class="notebook-header">
      <div class="header-top">
        <div class="title-group">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
          <h1>{{ t('notebook.title') }}</h1>
        </div>
        <GlobalActions hide-notebook />
      </div>

      <div class="header-bottom">
        <div class="search-wrapper">
          <KitInput
            v-model="searchQuery"
            :placeholder="t('notebook.searchPlaceholder')"
            class="search-input"
            clearable
          />
        </div>
      </div>
    </header>

    <div class="notebook-content">
      <div v-if="isLoading" class="loading-state">
        <KitSkeleton v-for="n in 3" :key="n" width="100%" height="160px" class="mb-4" />
      </div>

      <div v-else-if="filteredBookGroups.length === 0" class="empty-state">
        <Icon icon="mdi:notebook-outline" class="empty-icon" />
        <p>{{ searchQuery ? t('notebook.emptySearch') : t('notebook.emptyState') }}</p>
        <p v-if="searchQuery" class="empty-hint">
          {{ t('notebook.emptySearchHint') }}
        </p>
      </div>

      <div v-else class="book-groups-list">
        <div v-for="group in filteredBookGroups" :key="group.book.id" class="book-group-card">
          <!-- Book Header Block -->
          <div class="book-group-header">
            <div class="book-cover-container">
              <KitImage
                :src="group.book.localCoverUrl || group.book.coverUrl"
                :alt="group.book.title"
                fallback-icon="mdi:book-open-blank-variant"
              />
            </div>
            <div class="book-metadata">
              <h2 class="book-title">
                {{ group.book.title }}
              </h2>
              <p class="book-author">
                {{ group.book.author || t('notebook.authorUnknown') }}
              </p>
              <div class="book-stats">
                <span class="badge">{{ t('notebook.quotesCount', { count: group.highlights.length }) }}</span>
              </div>
            </div>
            <div class="book-actions">
              <KitDropdown placement="bottom-end" width="180px">
                <template #activator="{ props: dropdownProps }">
                  <KitBtn
                    icon="mdi:download"
                    variant="tonal"
                    color="secondary"
                    size="sm"
                    class="export-btn"
                    :class="{ 'is-active-btn': dropdownProps.isOpen }"
                  >
                    <span class="btn-text">{{ t('notebook.export') }}</span>
                  </KitBtn>
                </template>
                <div class="dropdown-menu-list">
                  <button class="dropdown-item" @click="exportToMarkdown(group)">
                    <Icon icon="mdi:markdown" />
                    {{ t('notebook.exportMarkdown') }}
                  </button>
                  <button class="dropdown-item" @click="exportToPlainText(group)">
                    <Icon icon="mdi:file-document-outline" />
                    {{ t('notebook.exportText') }}
                  </button>
                </div>
              </KitDropdown>
            </div>
          </div>

          <!-- Book Highlights List -->
          <div class="highlights-list">
            <div
              v-for="h in group.highlights"
              :key="h.id"
              class="highlight-item"
              :style="{ '--highlight-color': h.color || '#fde047' }"
            >
              <div class="highlight-body">
                <div class="quote-content">
                  <p class="highlight-text">
                    “<span v-html="highlightText(h.text, searchQuery)" />”
                  </p>
                  <p v-if="h.translation" class="highlight-translation" v-html="highlightText(h.translation, searchQuery)" />
                </div>

                <div v-if="h.note" class="highlight-note">
                  <Icon icon="mdi:pencil-outline" class="note-icon" />
                  <p class="text">
                    {{ h.note }}
                  </p>
                </div>
              </div>

              <div class="highlight-footer">
                <div class="highlight-info">
                  <span v-if="h.chapter" class="chapter-badge">
                    {{ t('notebook.chapter', { chapter: h.chapter }) }}
                  </span>
                  <span class="page-badge">
                    {{ t('notebook.page', { page: h.pageNum }) }}
                  </span>
                  <span class="date-badge">
                    {{ new Date(h.createdAt).toLocaleDateString() }}
                  </span>
                </div>
                <div class="highlight-actions" @click.stop>
                  <PronunciationCheck :word="h.text" :language="group.book.language" variant="button" />
                  <!-- TTS Audio Playback Button -->
                  <KitTooltip :text="activeTtsId === h.id && tts.isPlaying.value ? t('bookInfo.stop') : t('notebook.speak')" placement="top">
                    <KitBtn
                      class="tts-speak-btn"
                      :icon="activeTtsId === h.id && tts.isPlaying.value ? 'mdi:stop' : 'mdi:volume-high'"
                      :class="{ 'pulse-animation': activeTtsId === h.id && tts.isPlaying.value }"
                      :loading="activeTtsId === h.id && tts.isLoading.value"
                      variant="text"
                      size="xs"
                      color="primary"
                      :disabled="activeTtsId !== null && activeTtsId !== h.id && isTtsActive"
                      @click.stop="playTts(h, group.book)"
                    />
                  </KitTooltip>

                  <!-- AI Translate Button -->
                  <KitTooltip v-if="!h.translation" :text="translatingId === h.id ? t('notebook.translating') : t('notebook.aiTranslate')" placement="top">
                    <KitBtn
                      class="ai-translate-btn"
                      icon="mdi:translate"
                      :loading="translatingId === h.id"
                      variant="text"
                      size="xs"
                      color="primary"
                      :disabled="translatingId !== null"
                      @click.stop="translateQuote(h, group.book)"
                    />
                  </KitTooltip>

                  <KitTooltip :text="t('notebook.editQuote')" placement="top">
                    <KitBtn
                      icon="mdi:pencil"
                      variant="text"
                      size="xs"
                      color="secondary"
                      @click.stop="openEditModal(h)"
                    />
                  </KitTooltip>
                  <KitTooltip :text="t('notebook.deleteQuote')" placement="top-end">
                    <KitBtn
                      icon="mdi:delete-outline"
                      variant="text"
                      size="xs"
                      color="error"
                      @click.stop="confirmDelete(h)"
                    />
                  </KitTooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Highlight Modal Dialog -->
    <QuoteModal
      v-model:visible="isEditModalOpen"
      mode="edit"
      :initial-data="editForm"
      :book-context="(() => {
        const h = highlights.find(item => item.id === editForm.id)
        const book = h ? libraryStore.books.find(b => b.id === h.bookId) : undefined
        return book ? { id: book.id, language: book.language } : undefined
      })()"
      @save="saveEdit"
    />

    <!-- Delete Confirmation -->
    <KitPrompt
      v-model:visible="isDeleteConfirmOpen"
      :title="t('notebook.deleteConfirmTitle')"
      :description="t('notebook.deleteConfirmDesc')"
      :hide-input="true"
      :confirm-text="t('notebook.delete')"
      :cancel-text="t('notebook.cancel')"
      @submit="onDeleteConfirmSubmit"
    />
  </div>
</template>

<style lang="scss" scoped>
.notebook-page {
  position: relative;
  z-index: 1;
  padding: 16px;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  padding-bottom: env(safe-area-inset-bottom, 24px);
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding: 8px;
  }
}

.notebook-header {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
  flex-shrink: 0;

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--fg-primary-color);
      }
    }
  }

  .header-bottom {
    display: flex;
    .search-wrapper {
      flex-grow: 1;
      .search-input {
        width: 100%;
      }
    }
  }
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  text-align: center;
}

.empty-state {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;

  .empty-icon {
    font-size: 3rem;
    color: var(--fg-muted-color);
    margin-bottom: 12px;
    opacity: 0.7;
  }

  p {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    margin: 0 0 6px 0;
  }

  .empty-hint {
    font-size: 0.9rem;
    color: var(--fg-muted-color);
    margin: 0;
  }
}

.book-groups-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.book-group-card {
  background: transparent;
  border: none;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.book-group-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 8px;

  @include media-down(xs) {
    padding: 12px 16px;
    gap: 12px;
  }

  .book-cover-container {
    width: 48px;
    height: 72px;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .book-metadata {
    flex-grow: 1;
    min-width: 0;

    .book-title {
      margin: 0 0 4px 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.01em;
    }

    .book-author {
      margin: 0 0 8px 0;
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .book-stats {
      .badge {
        font-size: 0.75rem;
        background: rgba(var(--fg-primary-color-rgb, 255, 255, 255), 0.1);
        border: 1px solid rgba(var(--fg-primary-color-rgb, 255, 255, 255), 0.05);
        color: var(--fg-primary-color);
        padding: 4px 10px;
        border-radius: 20px;
        font-weight: 500;
        backdrop-filter: blur(4px);
      }
    }
  }

  .book-actions {
    flex-shrink: 0;
  }
}

.highlights-list {
  padding: 12px 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  align-items: start;
}

.highlight-item {
  background: rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  break-inside: avoid;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: var(--highlight-color, #fde047);
    opacity: 0.8;
  }

  /* Decorative quote watermark */
  &::after {
    content: '”';
    position: absolute;
    top: -20px;
    right: 10px;
    font-size: 140px;
    color: var(--highlight-color, #fde047);
    opacity: 0.05;
    font-family: serif;
    pointer-events: none;
    line-height: 1;
    z-index: 0;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .highlight-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    z-index: 1;

    .quote-content {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .highlight-text {
        margin: 0;
        font-size: 1.15rem;
        line-height: 1.6;
        color: var(--fg-primary-color);
        font-weight: 500;
        letter-spacing: 0.01em;
      }

      .highlight-translation {
        margin: 0;
        font-size: 1rem;
        color: var(--fg-secondary-color);
        line-height: 1.5;
        padding-left: 12px;
        border-left: 2px solid rgba(var(--fg-primary-color-rgb, 255, 255, 255), 0.2);
        font-style: italic;
      }
    }

    .highlight-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 6px 8px;
      background: rgba(var(--bg-primary-color-rgb, 24, 24, 27), 0.5);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);

      .note-icon {
        font-size: 1.2rem;
        color: var(--highlight-color, var(--fg-accent-color));
        flex-shrink: 0;
        margin-top: 2px;
        opacity: 0.8;
      }

      .text {
        margin: 0;
        font-size: 0.95rem;
        color: var(--fg-primary-color);
        white-space: pre-wrap;
        line-height: 1.5;
      }
    }
  }

  .highlight-footer {
    display: flex;
    padding-top: 8px;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--fg-muted-color);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: 4px;
    position: relative;
    z-index: 1;

    .highlight-info {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      span {
        background: rgba(var(--fg-primary-color-rgb, 255, 255, 255), 0.05);
        padding: 4px 8px;
        border-radius: 6px;
      }

      .chapter-badge {
        font-weight: 500;
        color: var(--fg-secondary-color);
      }
    }

    .highlight-actions {
      display: flex;
      gap: 4px;
      opacity: 0.6;
      transition: opacity 0.2s;
    }
  }

  &:hover .highlight-actions {
    opacity: 1;
  }

  .text-match {
    background: rgba(var(--fg-accent-color-rgb, 255, 193, 7), 0.35);
    border-radius: 2px;
    color: inherit;
  }
}

.export-btn {
  .btn-text {
    @include media-down(xs) {
      display: none;
    }
  }

  :deep(.kit-btn-icon) {
    @include media-down(xs) {
      margin-right: 0;
    }
  }
}

// Dropdown styles
.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 6px;
  text-align: left;
  width: 100%;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  svg {
    font-size: 1.15rem;
  }
}

// Dialog & Forms styles
.edit-quote-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;

  .quote-preview {
    background-color: var(--bg-tertiary-color);
    border-left: 4px solid var(--fg-accent-color);
    padding: 12px;
    border-radius: 4px;
    p {
      margin: 0;
      font-style: italic;
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .input-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
    }

    .full-width-input {
      width: 100%;
    }

    .note-textarea {
      width: 100%;
      height: 100px;
      border: 1px solid var(--border-secondary-color);
      background-color: var(--bg-primary-color);
      color: var(--fg-primary-color);
      border-radius: 8px;
      padding: 10px;
      font-family: inherit;
      font-size: 0.95rem;
      resize: vertical;
      outline: none;

      &:focus {
        border-color: var(--fg-accent-color);
      }
    }
  }

  .color-picker {
    display: flex;
    gap: 12px;

    .color-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      outline: none;
      transition:
        transform 0.1s,
        border-color 0.1s;

      &:hover {
        transform: scale(1.1);
      }

      &.is-active {
        border-color: var(--fg-primary-color);
        transform: scale(1.1);
      }
    }
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pulse-animation {
  animation: pulse-op 1.2s infinite;
  color: var(--fg-accent-color) !important;
}

@keyframes pulse-op {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
  }
}
</style>
