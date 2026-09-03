<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useDictFilterOptions } from '../../composables/use-dict-filter-options'
import { useDictionaryStore } from '../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })

const store = useDictionaryStore()
const { t } = useI18n()
const { newDeckLangOptions } = useDictFilterOptions()

const newDeckName = ref('')
const newDeckLang = ref('en')

const isRenamePromptOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const renameDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteMode = ref<'keep' | 'delete_all' | 'delete_exclusive'>('keep')

const deleteModeOptions = computed<{ value: 'keep' | 'delete_all' | 'delete_exclusive', label: string }[]>(() => [
  { value: 'keep', label: t('dictionary.deleteModeKeep') },
  { value: 'delete_exclusive', label: t('dictionary.deleteModeExclusive') },
  { value: 'delete_all', label: t('dictionary.deleteModeAll') },
])

function getDeckWordCount(deckId: number): number {
  return store.words.filter(w => w.deckIds?.includes(deckId)).length
}

async function createNewDeck() {
  if (newDeckName.value.trim()) {
    await store.createDeck(newDeckName.value.trim(), newDeckLang.value)
    newDeckName.value = ''
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
  <KitDialog v-model:visible="visible" :title="t('dictionary.manageDecks')" :max-width="520">
    <div class="manage-decks-content">
      <!-- Create Deck Section -->
      <div class="create-deck-section">
        <div class="create-deck-row">
          <KitInput
            v-model="newDeckName"
            :placeholder="t('dictionary.newDeckName')"
            class="new-deck-input"
            @keyup.enter="createNewDeck"
          />
          <KitSelect
            v-model="newDeckLang"
            :options="newDeckLangOptions"
            class="new-deck-lang"
          />
          <KitBtn
            color="primary"
            icon="mdi:plus"
            :disabled="!newDeckName.trim()"
            :title="t('dictionary.create')"
            @click="createNewDeck"
          />
        </div>
      </div>

      <!-- Decks List Section -->
      <div class="decks-section">
        <div v-if="store.decks.length > 0" class="decks-list-header">
          <span class="decks-count">{{ t('dictionary.allDecks') }} ({{ store.decks.length }})</span>
        </div>

        <div v-if="store.decks.length === 0" class="empty-state">
          <div class="empty-icon-box">
            <Icon icon="mdi:folder-open-outline" class="empty-icon" />
          </div>
          <p class="empty-title">
            {{ t('dictionary.noDecks') }}
          </p>
          <p class="empty-hint">
            {{ t('dictionary.noDecksHint') }}
          </p>
        </div>

        <ul v-else class="decks-manage-list">
          <li v-for="deck in store.decks" :key="deck.id" class="deck-manage-item">
            <div class="deck-main">
              <div class="deck-icon-box">
                <Icon icon="mdi:folder-text-outline" class="deck-icon" />
              </div>
              <div class="deck-info">
                <span class="deck-name" :title="deck.name">{{ deck.name }}</span>
                <div class="deck-meta">
                  <span class="deck-lang-badge">{{ deck.language.toUpperCase() }}</span>
                  <span class="deck-word-count">
                    <Icon icon="mdi:cards-outline" />
                    <span>{{ t('dictionary.wordsCount', { count: getDeckWordCount(deck.id) }) }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="deck-actions">
              <KitBtn
                icon="mdi:pencil-outline"
                size="sm"
                variant="tonal"
                :title="t('dictionary.renameDeck')"
                @click="openRenameDeck(deck.id, deck.name)"
              />
              <KitBtn
                icon="mdi:trash-can-outline"
                size="sm"
                variant="tonal"
                color="error"
                :title="t('dictionary.deleteItem')"
                @click="openDeleteDeck(deck.id, deck.name)"
              />
            </div>
          </li>
        </ul>
      </div>
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

  <KitDialog
    v-model:visible="isDeleteConfirmOpen"
    :title="t('dictionary.deleteDeckTitle')"
    :max-width="440"
  >
    <div class="delete-confirm-content">
      <p>{{ t('dictionary.deleteDeckDesc', { name: deleteDeckTarget?.name || '' }) }}</p>

      <div class="delete-options">
        <div
          v-for="option in deleteModeOptions"
          :key="option.value"
          class="delete-option"
          :class="{ 'is-selected': deleteMode === option.value }"
          @click="deleteMode = option.value"
        >
          <KitCheckbox
            :model-value="deleteMode === option.value"
            :label="option.label"
            class="readonly-checkbox"
          />
        </div>
      </div>

      <div class="delete-actions">
        <KitBtn variant="tonal" size="md" @click="isDeleteConfirmOpen = false">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn color="error" size="md" @click="onDeleteDeckConfirm">
          {{ t('dictionary.deleteItem') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.manage-decks-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-deck-section {
  background: var(--bg-secondary-color);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  .create-deck-row {
    display: flex;
    gap: 8px;
    align-items: center;

    .new-deck-input {
      flex: 1;
    }

    .new-deck-lang {
      width: 120px;
      flex-shrink: 0;
    }
  }
}

.decks-section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .decks-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;

    .decks-count {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.decks-manage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 380px;
  overflow-y: auto;
  padding: 2px;
  margin: 0;
  list-style: none;

  scrollbar-width: thin;
  scrollbar-color: var(--border-primary-color) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-primary-color);
    border-radius: 3px;
  }
}

.deck-manage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--border-primary-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  }

  .deck-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;

    .deck-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
      color: var(--fg-accent-color);
      flex-shrink: 0;
      transition: transform 0.2s ease;

      .deck-icon {
        font-size: 1.35rem;
      }
    }

    .deck-info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;

      .deck-name {
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--fg-primary-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .deck-meta {
        display: flex;
        align-items: center;
        gap: 8px;

        .deck-lang-badge {
          font-size: 0.7rem;
          font-weight: 600;
          background: var(--bg-primary-color);
          padding: 1px 6px;
          border-radius: 6px;
          border: 1px solid var(--border-primary-color);
          color: var(--fg-secondary-color);
          letter-spacing: 0.5px;
        }

        .deck-word-count {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--fg-secondary-color);

          .iconify {
            font-size: 0.85rem;
          }
        }
      }
    }
  }

  .deck-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 16px;
  background: var(--bg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: 14px;
  text-align: center;
  gap: 6px;

  .empty-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--bg-hover-color);
    color: var(--fg-secondary-color);
    margin-bottom: 4px;

    .empty-icon {
      font-size: 1.75rem;
    }
  }

  .empty-title {
    margin: 0;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
  }

  .empty-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }
}

.delete-confirm-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  p {
    margin: 0;
    color: var(--fg-primary-color);
  }

  .delete-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;

    .delete-option {
      cursor: pointer;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-hover-color);
        border-color: var(--border-primary-color);
      }

      &.is-selected {
        border-color: var(--fg-accent-color);
        background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
      }

      :deep(.kit-checkbox) {
        align-items: center;
      }

      :deep(.checkbox-box) {
        margin-top: 2px;
      }

      :deep(.checkbox-label) {
        color: var(--fg-primary-color);
        font-size: 0.875rem;
        line-height: 1.4;
      }
    }
  }

  .delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
}

.readonly-checkbox {
  pointer-events: none;
}
</style>
