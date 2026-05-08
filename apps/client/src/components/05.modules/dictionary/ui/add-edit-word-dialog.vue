<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { KitBtn, KitDialog, KitInput } from '~/components/01.kit'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()

const localWord = ref<Partial<UserDictItem>>({})

const isEditing = computed(() => !!localWord.value.id)

function handleSave() {
  store.saveWordToDict(localWord.value as UserDictItem)
}

function handleDelete() {
  if (localWord.value.word) {
    store.removeFromDict(localWord.value.word)
  }
}

watch(() => store.wordToEdit, (newWord) => {
  if (newWord) {
    localWord.value = { ...newWord }
  }
  else {
    localWord.value = {}
  }
}, { deep: true })
</script>

<template>
  <KitDialog v-model:visible="store.addEditWordModalOpen" :title="isEditing ? 'Редактировать слово' : 'Добавить в словарь'" icon="mdi:star-outline">
    <div v-if="localWord" class="dialog-content">
      <div class="word-preview">
        <h3 class="dict-word">
          {{ localWord.word }}
        </h3>
        <p class="dict-transcription">
          {{ localWord.transcription }}
        </p>
        <div class="translation-preview" v-html="localWord.translation" />
      </div>

      <div class="form-fields">
        <label for="translation">Перевод (поддерживает HTML разметку)</label>
        <textarea id="translation" v-model="localWord.translation" class="custom-textarea" rows="5" placeholder="Введите перевод..." />

        <label for="notes">Заметки</label>
        <KitInput id="notes" v-model="localWord.notes!" placeholder="Ваши заметки..." />

        <label for="tags">Теги (через запятую)</label>
        <KitInput id="tags" v-model="localWord.tags!" placeholder="важное, фраза, ..." />
      </div>
    </div>
    <template #footer>
      <div class="footer-actions">
        <KitBtn v-if="isEditing" variant="outlined" color="secondary" @click="handleDelete">
          Удалить
        </KitBtn>
        <div class="spacer" />
        <KitBtn variant="tonal" @click="store.addEditWordModalOpen = false">
          Отмена
        </KitBtn>
        <KitBtn color="primary" @click="handleSave">
          {{ isEditing ? 'Сохранить' : 'Добавить' }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.word-preview {
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);

  .dict-word {
    font-size: 1.8rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--fg-accent-color);
  }

  .dict-transcription {
    margin: 0 0 12px;
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
  }

  .translation-preview {
    font-size: 0.95rem;
    line-height: 1.5;
    padding-top: 12px;
    border-top: 1px dashed var(--border-primary-color);
    white-space: pre-wrap;

    :deep(b) {
      font-weight: 600;
      color: var(--fg-primary-color);
    }
    :deep(.dict-pos) {
      color: var(--fg-success-color);
      font-style: italic;
      font-size: 0.9em;
      margin: 0 4px;
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
    :deep(.dict-bullet) {
      display: block;
    }
  }
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    margin-bottom: -4px;
  }

  .custom-textarea {
    width: 100%;
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: 6px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--fg-accent-color);
    }
  }
}

.footer-actions {
  display: flex;
  width: 100%;
  gap: 8px;

  .spacer {
    flex-grow: 1;
  }
}
</style>
