<script setup lang="ts">
import type { CatalogDeck, CatalogWord, SelectOption } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog, KitInput, KitSelect, KitTabs } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { useDictionaryStore } from '../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })
const store = useDictionaryStore()
const toast = useToast()
const { t } = useI18n()

const activeTab = ref<'import' | 'catalog'>('catalog')

const tabItems = computed(() => [
  { id: 'catalog', label: t('dictionary.discover.marketplace_tab'), icon: 'mdi:store-search-outline' },
  { id: 'import', label: t('dictionary.discover.import_tab'), icon: 'mdi:file-import-outline' },
])

// -- Import Block --
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const previewRows = ref<string[][]>([])
const mapping = ref({ word: 0, translation: 1, transcription: 2, tags: 3 })
const importDeckId = ref('none')
const importNewDeckName = ref('')
const importAutoFill = ref(false)
const isImporting = ref(false)

const deckOptions = computed(() => {
  const opts: SelectOption[] = [{ label: t('dictionary.discover.no_deck'), value: 'none' }]
  store.decks.forEach((d) => {
    opts.push({ label: d.name, value: d.id })
  })
  return opts
})

function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
    target.value = ''

    // Read preview
    const text = await selectedFile.value.text()
    const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 3)
    previewRows.value = lines.map(l => l.split('\t').length > 1 ? l.split('\t') : l.split(','))
  }
}

async function doImport() {
  if (!selectedFile.value)
    return
  isImporting.value = true

  try {
    const text = await selectedFile.value.text()
    const allLines = text.split('\n').filter(l => l.trim().length > 0)
    const rows = allLines.map(l => l.split('\t').length > 1 ? l.split('\t') : l.split(','))

    await api.dictionary.importCsv({
      rows,
      mapping: mapping.value,
      deckId: importDeckId.value === 'none' ? null : Number(importDeckId.value),
      newDeckName: importNewDeckName.value,
      autoFill: importAutoFill.value,
    })

    toast.success(t('dictionary.discover.import_success'))
    await store.fetchDictionary()
    await store.fetchDecks()
    visible.value = false
  }
  catch (err: unknown) {
    toast.error(t('dictionary.discover.import_failed', { error: (err as Error).message }))
  }
  finally {
    isImporting.value = false
    selectedFile.value = null
    previewRows.value = []
  }
}

// -- Catalog Block --
const catalogDecks = ref<CatalogDeck[]>([])
const isCatalogLoading = ref(false)

const previewDeck = ref<CatalogDeck | null>(null)
const previewWords = ref<CatalogWord[]>([])
const isPreviewLoading = ref(false)

async function loadCatalog() {
  isCatalogLoading.value = true
  try {
    const res = await api.dictionary.catalog()
    catalogDecks.value = Array.isArray(res) ? res : (res as unknown as { data: CatalogDeck[] }).data || []
  }
  catch (err: unknown) {
    console.error(err)
  }
  finally {
    isCatalogLoading.value = false
  }
}

async function openPreview(deck: CatalogDeck) {
  previewDeck.value = deck
  previewWords.value = []
  isPreviewLoading.value = true
  try {
    previewWords.value = await api.dictionary.catalogWords(deck.id)
  }
  catch (err: unknown) {
    toast.error(t('dictionary.discover.preview_failed', { error: (err as Error).message }))
  }
  finally {
    isPreviewLoading.value = false
  }
}

function closePreview() {
  previewDeck.value = null
}

const cloningDeckId = ref<number | null>(null)

async function cloneDeck(id: number) {
  if (cloningDeckId.value !== null)
    return
  cloningDeckId.value = id
  try {
    await api.dictionary.cloneCatalog(id)
    toast.success(t('dictionary.discover.clone_success'))
    await store.fetchDictionary()
    await store.fetchDecks()

    previewDeck.value = null
    visible.value = false
  }
  catch (err: unknown) {
    toast.error(t('dictionary.discover.clone_failed', { error: (err as Error).message }))
  }
  finally {
    cloningDeckId.value = null
  }
}

onMounted(() => {
  loadCatalog()
})
</script>

<template>
  <KitDialog v-model:visible="visible" :title="t('dictionary.discover.title')" icon="mdi:bookshelf" :max-width="800">
    <div class="discover-modal-content">
      <KitTabs v-model="activeTab" :items="tabItems" :cache="false">
        <template #import>
          <div class="tab-pane import-pane">
            <div v-if="!selectedFile" class="upload-area" @click="triggerFileUpload">
              <Icon icon="mdi:file-upload-outline" class="upload-icon" />
              <h3>{{ t('dictionary.discover.upload_title') }}</h3>
              <p>{{ t('dictionary.discover.upload_desc') }}</p>
              <input ref="fileInputRef" type="file" accept=".csv,.txt" hidden @change="onFileSelected">
            </div>

            <div v-else class="mapping-area">
              <div class="selected-file-info">
                <span><b>{{ t('dictionary.discover.file') }}</b> {{ selectedFile.name }}</span>
                <KitBtn size="xs" variant="text" color="error" @click="selectedFile = null; previewRows = []">
                  {{ t('dictionary.discover.change') }}
                </KitBtn>
              </div>

              <h4>{{ t('dictionary.discover.data_mapping') }}</h4>
              <p>{{ t('dictionary.discover.data_mapping_desc') }}</p>

              <div class="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th v-for="(_, i) in previewRows[0] || []" :key="i">
                        <select v-if="i === mapping.word" v-model="mapping.word">
                          <option :value="i">
                            {{ t('dictionary.discover.col_word') }}
                          </option>
                        </select>
                        <select v-if="i === mapping.translation" v-model="mapping.translation">
                          <option :value="i">
                            {{ t('dictionary.discover.col_translation') }}
                          </option>
                        </select>
                        <select v-if="i === mapping.transcription" v-model="mapping.transcription">
                          <option :value="i">
                            {{ t('dictionary.discover.col_transcription') }}
                          </option>
                        </select>
                        <span v-if="i !== mapping.word && i !== mapping.translation && i !== mapping.transcription">{{ t('dictionary.discover.col_num', { num: i }) }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, r) in previewRows" :key="r">
                      <td v-for="(cell, c) in row" :key="c">
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4>{{ t('dictionary.discover.target_deck') }}</h4>
              <div class="form-row">
                <KitSelect v-model="importDeckId" :options="deckOptions" class="form-field" />
                <span>{{ t('dictionary.discover.or') }}</span>
                <KitInput v-model="importNewDeckName" :placeholder="t('dictionary.discover.new_deck_placeholder')" class="form-field" />
              </div>

              <div class="checkbox-row">
                <KitCheckbox v-model="importAutoFill" :label="t('dictionary.discover.auto_fill_label')" />
              </div>

              <KitBtn color="primary" class="submit-btn" :disabled="isImporting" @click="doImport">
                {{ isImporting ? t('dictionary.discover.importing') : t('dictionary.discover.import_btn') }}
              </KitBtn>
            </div>
          </div>
        </template>

        <template #catalog>
          <div class="catalog-pane">
            <Transition name="fade" mode="out-in">
              <div v-if="previewDeck" key="preview" class="preview-container">
                <div class="preview-header">
                  <KitBtn icon="mdi:arrow-left" variant="text" @click="closePreview" />
                  <h3>{{ previewDeck.name }}</h3>
                  <div class="spacer" style="flex-grow: 1" />
                  <KitBtn color="primary" size="sm" icon="mdi:plus" :loading="cloningDeckId === previewDeck.id" @click="cloneDeck(previewDeck.id)">
                    {{ t('dictionary.discover.add_to_library') }}
                  </KitBtn>
                </div>
                <div v-if="isPreviewLoading" class="loading-container">
                  <Icon icon="mdi:loading" class="spin-icon loading-icon" />
                </div>
                <div v-else class="preview-list">
                  <div v-for="w in previewWords" :key="w.id" class="preview-word-item">
                    <div class="w-main">
                      <span class="w-text">{{ w.word }}</span>
                      <span v-if="w.transcription" class="w-tr">{{ w.transcription }}</span>
                    </div>
                    <div class="w-trans" v-html="w.translation" />
                  </div>
                </div>
              </div>

              <div v-else key="catalog">
                <div v-if="isCatalogLoading" class="loading-container">
                  <Icon icon="mdi:loading" class="spin-icon loading-icon" />
                </div>
                <div v-else-if="catalogDecks.length === 0" class="empty-catalog">
                  {{ t('dictionary.discover.no_decks') }}
                </div>
                <div v-else class="catalog-grid">
                  <div v-for="deck in catalogDecks" :key="deck.id" class="catalog-card" @click="openPreview(deck)">
                    <div class="card-header">
                      <h4>{{ deck.name }}</h4>
                      <span class="deck-lang">{{ deck.language }}</span>
                    </div>
                    <p class="deck-desc">
                      {{ deck.description }}
                    </p>
                    <div class="card-footer">
                      <div class="footer-stats">
                        <span>{{ deck.difficulty || t('dictionary.discover.all_levels') }}</span>
                        <span>{{ t('dictionary.discover.words_count', { count: deck.wordCount }) }}</span>
                      </div>
                      <KitBtn variant="tonal" color="primary" size="sm" icon="mdi:plus" class="card-btn" :title="t('dictionary.discover.add_to_library')" :loading="cloningDeckId === deck.id" @click.stop="cloneDeck(deck.id)" />
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </template>
      </KitTabs>
    </div>
  </KitDialog>
</template>

<style scoped lang="scss">
.upload-area {
  text-align: center;
  padding: 48px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: 16px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  background-color: var(--bg-secondary-color);

  &:hover {
    background-color: var(--bg-tertiary-color);
    border-color: var(--border-primary-color);
  }
}

.upload-icon {
  font-size: 56px;
  color: var(--fg-tertiary-color);
  margin-bottom: 16px;
  transition: color 0.2s ease;
}

.upload-area:hover .upload-icon {
  color: var(--fg-accent-color);
}

.selected-file-info {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary-color);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border-secondary-color);
}

.preview-table {
  overflow-x: auto;
  margin-bottom: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  table {
    width: 100%;
    text-align: left;
    border-collapse: collapse;

    th {
      padding: 12px;
      background: var(--bg-secondary-color);
      border-bottom: 1px solid var(--border-secondary-color);

      select {
        width: 100%;
        padding: 6px;
        border-radius: 6px;
        border: 1px solid var(--border-secondary-color);
        background: var(--bg-primary-color);
        color: var(--fg-primary-color);
        outline: none;
      }

      span {
        color: var(--fg-secondary-color);
        font-weight: 600;
      }
    }

    tbody tr {
      border-bottom: 1px solid var(--border-secondary-color);

      &:last-child {
        border-bottom: none;
      }

      td {
        padding: 12px;
        font-size: 0.9rem;
        color: var(--fg-primary-color);
      }
    }
  }
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;

  .form-field {
    flex: 1;
  }

  span {
    align-self: center;
    color: var(--fg-secondary-color);
    font-weight: 500;
  }
}

.checkbox-row {
  margin-bottom: 24px;
}

.submit-btn {
  width: 100%;
  font-weight: 600;
  padding: 12px;
}

.loading-container,
.empty-catalog {
  text-align: center;
  padding: 60px 20px;
  color: var(--fg-secondary-color);
  font-size: 1.1rem;
}

.loading-icon {
  font-size: 40px;
  color: var(--fg-accent-color);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.catalog-card {
  background: var(--bg-secondary-color);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: pointer;
  transition:
    transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.25s ease,
    border-color 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--border-primary-color);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;

    h4 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      line-height: 1.3;
    }

    .deck-lang {
      background: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.15);
      color: var(--fg-accent-color);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  .deck-desc {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.5;
    flex: 1;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px dashed var(--border-secondary-color);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);

    .footer-stats {
      display: flex;
      gap: 12px;
      align-items: center;

      span {
        display: inline-flex;
        align-items: center;

        &:not(:last-child)::after {
          content: '•';
          margin-left: 12px;
          color: var(--border-primary-color);
        }
      }
    }
  }

  .card-btn {
    flex-shrink: 0;
    margin: 0;
  }
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;

  h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--fg-primary-color);
  }
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.preview-word-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;

  .w-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .w-text {
      font-weight: 600;
      color: var(--fg-accent-color);
      font-size: 1.1rem;
    }

    .w-tr {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }

  .w-trans {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    line-height: 1.4;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
