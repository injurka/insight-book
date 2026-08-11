<script setup lang="ts">
import { Icon } from '@iconify/vue'
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
  <KitDialog v-model:visible="visible" :title="t('dictionary.manageDecks')" :max-width="500">
    <div class="manage-decks-content">
      <div class="create-deck-row">
        <KitInput v-model="newDeckName" :placeholder="t('dictionary.newDeckName')" @keyup.enter="createNewDeck" />
        <KitSelect v-model="newDeckLang" :options="newDeckLangOptions" class="new-deck-lang" />
        <KitBtn color="primary" icon="mdi:plus" @click="createNewDeck" />
      </div>

      <div v-if="store.decks.length === 0" class="empty-state">
        <p>{{ t('dictionary.noDecks') }}</p>
      </div>
      <ul v-else class="decks-manage-list">
        <li v-for="deck in store.decks" :key="deck.id" class="deck-manage-item">
          <div class="deck-info">
            <Icon icon="mdi:folder-outline" />
            <span class="deck-name">{{ deck.name }}</span>
            <span class="deck-lang">{{ deck.language.toUpperCase() }}</span>
          </div>
          <div class="deck-actions">
            <KitBtn
              icon="mdi:pencil"
              size="xs"
              variant="text"
              @click="openRenameDeck(deck.id, deck.name)"
            />
            <KitBtn
              icon="mdi:delete-outline"
              size="xs"
              variant="text"
              color="error"
              @click="openDeleteDeck(deck.id, deck.name)"
            />
          </div>
        </li>
      </ul>
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
    :max-width="400"
  >
    <div class="delete-confirm-content">
      <p>{{ t('dictionary.deleteDeckDesc', { name: deleteDeckTarget?.name || '' }) }}</p>

      <div class="delete-options">
        <div
          v-for="option in deleteModeOptions"
          :key="option.value"
          class="delete-option"
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
        <KitBtn variant="outlined" @click="isDeleteConfirmOpen = false">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn color="error" @click="onDeleteDeckConfirm">
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
}

.create-deck-row {
  display: flex;
  gap: 8px;
}

.decks-manage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 0;
  margin-bottom: 0px;
}

.deck-manage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-tertiary-color);
  border-radius: 6px;
  border: 1px solid var(--border-secondary-color);

  .deck-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .deck-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .deck-lang {
      font-size: 0.75rem;
      background: var(--bg-primary-color);
      padding: 1px 4px;
      border-radius: 4px;
      color: var(--fg-secondary-color);
    }
  }

  .deck-actions {
    display: flex;
    gap: 4px;
  }
}

.empty-state {
  text-align: center;
  padding: 24px 0;
  color: var(--fg-secondary-color);
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
    margin-top: 8px;

    .delete-option {
      cursor: pointer;

      :deep(.kit-checkbox) {
        align-items: center;
      }

      :deep(.checkbox-box) {
        margin-top: 2px;
      }

      :deep(.checkbox-label) {
        color: var(--fg-secondary-color);
        line-height: 1.4;
      }
    }
  }

  .delete-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
}

.readonly-checkbox {
  pointer-events: none;
}
</style>
