<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToast } from '~/01.shared/composables/use-toast'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitViewSwitcher } from '~/02.kit/molecules/kit-view-switcher/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useLibraryStore } from '~/05.modules/library'
import { useDictFilterOptions } from '../../composables/use-dict-filter-options'
import { useDictionaryStore } from '../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })

const store = useDictionaryStore()
const libraryStore = useLibraryStore()
const auth = useAuthStore()
const network = useNetworkStore()
const { t } = useI18n()
const { newDeckLangOptions } = useDictFilterOptions()

const router = useRouter()
const toast = useToast()
const isOpeningBook = ref(false)
const panel = ref<'decks' | 'books'>('decks')
const deckSearch = ref('')
const bookSearch = ref('')
const newDeckName = ref('')
const newDeckLang = ref('en')
const isCreateDeckOpen = ref(false)
const isRenamePromptOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const renameDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteMode = ref<'keep' | 'delete_all' | 'delete_exclusive'>('keep')

const panelItems = computed(() => [
  { id: 'decks' as const, label: `${t('dictionary.allDecks')} (${store.decks.length})`, icon: 'mdi:folder-multiple-outline' },
  { id: 'books' as const, label: t('dictionary.createFromBook'), icon: 'mdi:book-plus-outline' },
])
const canCreateFromBook = computed(() => !!(auth.user || auth.isSingleMode) && !network.effectiveOffline)
const deleteModeOptions = computed<{ value: 'keep' | 'delete_all' | 'delete_exclusive', label: string }[]>(() => [
  { value: 'keep', label: t('dictionary.deleteModeKeep') },
  { value: 'delete_exclusive', label: t('dictionary.deleteModeExclusive') },
  { value: 'delete_all', label: t('dictionary.deleteModeAll') },
])
const filteredDecks = computed(() => {
  const query = deckSearch.value.trim().toLocaleLowerCase()

  return store.decks.filter(deck => !query || deck.name.toLocaleLowerCase().includes(query) || deck.language.toLocaleLowerCase().includes(query))
})
const textBooks = computed(() => libraryStore.books.filter(book => book.type !== 'manga'))
const filteredBooks = computed(() => {
  const query = bookSearch.value.trim().toLocaleLowerCase()

  return textBooks.value.filter(book => !query || `${book.title} ${book.author || ''} ${book.language}`.toLocaleLowerCase().includes(query))
})

watch(visible, async (isVisible) => {
  if (isVisible) {
    panel.value = 'decks'
    deleteMode.value = 'keep'
    await store.fetchDecks()
  }
}, { immediate: true })
watch(panel, async (value) => {
  if (value === 'books' && canCreateFromBook.value)
    await libraryStore.fetchBooks()
})

function getDeckWordCount(deckId: number): number {
  return store.deckCounts.find(row => row.deckId === deckId)?.count || 0
}
async function createNewDeck() {
  const name = newDeckName.value.trim()

  if (!name || store.isLoading)
    return

  try {
    await store.createDeck(name, newDeckLang.value)
    newDeckName.value = ''
    isCreateDeckOpen.value = false
  }
  catch {
    // The store displays the error; keep the entered name for retry.
  }
}
async function startBookDeck(book: Book) {
  if (!canCreateFromBook.value || isOpeningBook.value)
    return

  isOpeningBook.value = true

  try {
    // Closing KitDialog first runs history.back(), which races with router.push().
    const failure = await router.push({ name: AppRouteNames.BookDeck, params: { bookId: book.id } })

    if (!failure)
      visible.value = false
  }
  catch {
    toast.error(t('dictionary.bookDeckNavigationError'))
  }
  finally {
    isOpeningBook.value = false
  }
}

function openRenameDeck(id: number, currentName: string) {
  renameDeckTarget.value = { id, name: currentName }
  isRenamePromptOpen.value = true
}
async function onRenameDeckSubmit(newName: string) {
  if (renameDeckTarget.value && newName.trim() && newName !== renameDeckTarget.value.name)
    await store.updateDeck(renameDeckTarget.value.id, newName.trim())

  renameDeckTarget.value = null
}
function openDeleteDeck(id: number, name: string) {
  deleteMode.value = 'keep'
  deleteDeckTarget.value = { id, name }
  isDeleteConfirmOpen.value = true
}
async function onDeleteDeckConfirm() {
  if (deleteDeckTarget.value)
    await store.deleteDeck(deleteDeckTarget.value.id, deleteMode.value)

  isDeleteConfirmOpen.value = false
  deleteDeckTarget.value = null
  deleteMode.value = 'keep'
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('dictionary.manageDecks')"
    :max-width="760"
    :minimizable="false"
  >
    <div class="manage-content">
      <KitViewSwitcher
        v-model="panel"
        :items="panelItems"
        full-width
        :aria-label="t('dictionary.manageDecks')"
      />

      <section v-if="panel === 'decks'" class="panel-content">
        <div class="panel-heading">
          <div>
            <h3>{{ t('dictionary.allDecks') }}</h3>
            <p>{{ t('dictionary.manageDecksHint') }}</p>
          </div>
          <KitBtn
            :icon="isCreateDeckOpen ? 'mdi:close' : 'mdi:plus'"
            class="create-deck-toggle"
            variant="tonal"
            :aria-label="t(isCreateDeckOpen ? 'dictionary.cancel' : 'dictionary.createEmptyDeck')"
            @click="isCreateDeckOpen = !isCreateDeckOpen"
          >
            <span class="create-button-label">{{ t(isCreateDeckOpen ? 'dictionary.cancel' : 'dictionary.createEmptyDeck') }}</span>
          </KitBtn>
        </div>

        <form v-if="isCreateDeckOpen" class="create-deck-form" @submit.prevent="createNewDeck">
          <div class="create-form-copy">
            <strong>{{ t('dictionary.createEmptyDeck') }}</strong>
            <span>{{ t('dictionary.createEmptyDeckHint') }}</span>
          </div>
          <div class="create-form-controls">
            <KitInput
              v-model="newDeckName"
              class="new-deck-name"
              :placeholder="t('dictionary.newDeckName')"
              maxlength="200"
              autofocus
            />
            <KitSelect v-model="newDeckLang" :options="newDeckLangOptions" />
            <KitBtn type="submit" :disabled="!newDeckName.trim()" :loading="store.isLoading">
              {{ t('dictionary.create') }}
            </KitBtn>
          </div>
        </form>

        <KitInput
          v-model="deckSearch"
          class="search-input"
          prepend-icon="mdi:magnify"
          clearable
          :placeholder="t('dictionary.searchDecks')"
        />

        <div v-if="!store.decks.length" class="empty-state">
          <div class="empty-icon-box">
            <Icon icon="mdi:folder-open-outline" />
          </div>
          <strong>{{ t('dictionary.noDecks') }}</strong>
          <p>{{ t('dictionary.noDecksHint') }}</p>
          <KitBtn variant="tonal" @click="isCreateDeckOpen = true">
            {{ t('dictionary.createEmptyDeck') }}
          </KitBtn>
        </div>
        <div v-else-if="!filteredDecks.length" class="empty-filter-state">
          {{ t('dictionary.noDeckSearchResults') }}
        </div>
        <ul v-else class="decks-list">
          <li v-for="deck in filteredDecks" :key="deck.id" class="deck-item">
            <div class="deck-icon-box">
              <Icon icon="mdi:cards-outline" />
            </div>
            <div class="deck-info">
              <span class="deck-name" :title="deck.name">{{ deck.name }}</span>
              <div class="deck-meta">
                <span class="deck-language">{{ deck.language.toUpperCase() }}</span>
                <span>{{ t('dictionary.wordsCount', { count: getDeckWordCount(deck.id) }) }}</span>
              </div>
            </div>
            <div class="deck-actions">
              <KitBtn
                icon="mdi:pencil-outline"
                size="sm"
                variant="tonal"
                :aria-label="t('dictionary.renameDeckNamed', { name: deck.name })"
                @click="openRenameDeck(deck.id, deck.name)"
              />
              <KitBtn
                icon="mdi:trash-can-outline"
                size="sm"
                variant="tonal"
                color="error"
                :aria-label="t('dictionary.deleteDeckNamed', { name: deck.name })"
                @click="openDeleteDeck(deck.id, deck.name)"
              />
            </div>
          </li>
        </ul>
      </section>

      <section v-else class="panel-content books-panel">
        <div class="panel-heading">
          <div>
            <h3>{{ t('dictionary.createFromBook') }}</h3>
            <p>{{ t('dictionary.chooseBookForDeck') }}</p>
          </div>
          <KitBtn
            icon="mdi:arrow-left"
            variant="text"
            :aria-label="t('dictionary.allDecks')"
            @click="panel = 'decks'"
          />
        </div>
        <KitInput
          v-model="bookSearch"
          class="search-input"
          prepend-icon="mdi:magnify"
          clearable
          :placeholder="t('dictionary.searchBooks')"
        />
        <div v-if="!canCreateFromBook" class="empty-filter-state" role="status">
          {{ t(network.effectiveOffline ? 'dictionary.bookDeckOffline' : 'dictionary.bookDeckLogin') }}
        </div>
        <div v-else-if="libraryStore.booksError" class="empty-state" role="alert">
          <p>{{ t('dictionary.bookLoadError') }}</p>
          <KitBtn variant="tonal" @click="libraryStore.fetchBooks()">
            {{ t('dictionary.retryLoad') }}
          </KitBtn>
        </div>
        <div v-else-if="libraryStore.isLoading && !textBooks.length" class="loading-books" role="status">
          <Icon icon="mdi:loading" class="spin" />
          {{ t('dictionary.loadingBooks') }}
        </div>
        <div v-else-if="!textBooks.length" class="empty-state">
          <div class="empty-icon-box">
            <Icon icon="mdi:book-open-page-variant-outline" />
          </div>
          <strong>{{ t('dictionary.noTextBooks') }}</strong>
          <p>{{ t('dictionary.noTextBooksHint') }}</p>
        </div>
        <div v-else-if="!filteredBooks.length" class="empty-filter-state">
          {{ t('dictionary.noBookSearchResults') }}
        </div>
        <ul v-else class="books-list">
          <li v-for="book in filteredBooks" :key="book.id">
            <button
              type="button"
              class="book-choice"
              :disabled="isOpeningBook"
              @click="startBookDeck(book)"
            >
              <div class="book-icon-box">
                <Icon icon="mdi:book-open-page-variant-outline" />
              </div>
              <div class="book-info">
                <strong>{{ book.title }}</strong>
                <span>{{ book.author || t('dictionary.bookAuthorUnknown') }}</span>
                <small>{{ book.language.toUpperCase() }} · {{ t('dictionary.bookPages', { count: book.totalPages }) }}</small>
              </div>
              <span class="book-action">{{ t('dictionary.chooseBook') }}<Icon icon="mdi:arrow-right" /></span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </KitDialog>

  <KitPrompt
    v-model:visible="isRenamePromptOpen"
    :title="t('dictionary.renameDeck')"
    :placeholder="t('dictionary.newDeckName')"
    :default-value="renameDeckTarget?.name"
    :confirm-text="t('dictionary.save')"
    @submit="onRenameDeckSubmit"
  />

  <KitDialog v-model:visible="isDeleteConfirmOpen" :title="t('dictionary.deleteDeckTitle')" :max-width="480">
    <div class="delete-confirm-content">
      <p>{{ t('dictionary.deleteDeckDesc', { name: deleteDeckTarget?.name || '' }) }}</p>
      <div class="delete-options" role="radiogroup" :aria-label="t('dictionary.deleteDeckTitle')">
        <label
          v-for="option in deleteModeOptions"
          :key="option.value"
          class="delete-option"
          :class="{ selected: deleteMode === option.value }"
        >
          <input
            v-model="deleteMode"
            type="radio"
            name="delete-deck-mode"
            :value="option.value"
          >
          <span>{{ option.label }}</span>
        </label>
      </div>
      <div class="delete-actions">
        <KitBtn variant="tonal" @click="isDeleteConfirmOpen = false">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn color="error" :loading="store.isLoading" @click="onDeleteDeckConfirm">
          {{ t('dictionary.deleteItem') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.manage-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 360px;
}
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-heading h3,
.panel-heading p {
  margin: 0;
}
.panel-heading h3 {
  font-size: 1rem;
}
.panel-heading p {
  margin-top: 3px;
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
}
.create-deck-form {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 14px;
  background: var(--bg-secondary-color);
}
.create-form-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.create-form-copy span {
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
}
.create-form-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 145px auto;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 100%;
}
.decks-list,
.books-list {
  display: grid;
  gap: 8px;
  max-height: min(48vh, 440px);
  overflow-y: auto;
  margin: 0;
  padding: 2px;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary-color) transparent;
}
.books-list {
  grid-template-columns: minmax(0, 1fr);
}
.books-list > li {
  min-width: 0;
}
.deck-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 13px;
  background: var(--bg-secondary-color);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.deck-item:hover {
  background: var(--bg-hover-color);
  border-color: var(--border-primary-color);
}
.deck-icon-box,
.book-icon-box {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
  color: var(--fg-accent-color);
  font-size: 1.3rem;
}
.deck-info,
.book-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.deck-name,
.book-info strong {
  overflow: hidden;
  color: var(--fg-primary-color);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deck-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
}
.deck-language {
  padding: 1px 6px;
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 600;
}
.deck-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
}
.book-choice {
  display: flex;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 13px;
  background: var(--bg-secondary-color);
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.book-choice:hover,
.book-choice:focus-visible {
  background: var(--bg-hover-color);
  border-color: var(--border-primary-color);
  outline: none;
}
.book-info > span,
.book-info > small {
  overflow: hidden;
  color: var(--fg-secondary-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  color: var(--fg-accent-color);
  font-size: 0.82rem;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 16px;
  border: 1px dashed var(--border-primary-color);
  border-radius: 14px;
  text-align: center;
}
.empty-icon-box {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 14px;
  background: var(--bg-hover-color);
  color: var(--fg-accent-color);
  font-size: 1.5rem;
}
.empty-state p {
  max-width: 360px;
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.84rem;
}
.empty-filter-state,
.loading-books {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--fg-secondary-color);
  text-align: center;
}
.spin {
  animation: spin 1s linear infinite;
}
.delete-confirm-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.delete-confirm-content > p {
  margin: 0;
}
.delete-options {
  display: grid;
  gap: 8px;
}
.delete-option {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 11px;
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.delete-option:hover,
.delete-option.selected {
  border-color: var(--fg-accent-color);
  background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.07);
}
.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}
.delete-option input {
  accent-color: var(--fg-accent-color);
  flex: 0 0 auto;
  margin: 0 10px 0 0;
}
.delete-option:focus-within {
  outline: 2px solid var(--fg-accent-color);
  outline-offset: 2px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 600px) {
  .manage-content {
    gap: 12px;
  }
  .create-form-controls {
    grid-template-columns: 1fr 1fr;
  }
  .create-form-controls > .new-deck-name {
    grid-column: 1 / -1;
  }
  .create-form-controls > :last-child {
    grid-column: 1 / -1;
  }
  .deck-item {
    gap: 8px;
    padding: 9px;
  }
  .deck-icon-box,
  .book-icon-box {
    flex-basis: 34px;
    width: 34px;
    height: 34px;
  }
  .deck-actions {
    gap: 1px;
  }
  .book-action {
    font-size: 0;
  }
  .book-action :deep(.iconify) {
    font-size: 1.1rem;
  }
  .create-button-label {
    display: none;
  }
  .create-deck-toggle {
    width: 38px;
    padding: 0;
  }
  .create-deck-toggle :deep(.kit-btn-icon) {
    margin-right: 0;
  }
}
</style>
