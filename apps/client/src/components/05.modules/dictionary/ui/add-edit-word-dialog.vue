<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput } from '~/components/01.kit'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const localWord = ref<Partial<UserDictItem>>({})

watch(() => store.wordToEdit, (newWord) => {
  if (newWord) {
    localWord.value = { ...newWord }
  }
  else {
    localWord.value = {}
  }
}, { deep: true })

const isEditing = computed(() => !!localWord.value.id)

function handleSave() {
  store.saveWordToDict(localWord.value as any)
}

function handleDelete() {
  if (localWord.value.word) {
    store.removeFromDict(localWord.value.word)
  }
}
</script>

<template>
  <KitDialog v-model:visible="store.addEditWordModalOpen" :title="isEditing ? 'Редактировать слово' : 'Добавить в словарь'" icon="mdi:star-outline">
    <div v-if="localWord" class="dialog-content">
      <div class="word-preview">
        <h3 class="hanzi">
          {{ localWord.word }}
        </h3>
        <p class="pinyin">
          {{ localWord.pinyin }}
        </p>
        <div class="translation" v-html="localWord.translation" />
      </div>

      <div class="form-fields">
        <label for="notes">Заметки</label>
        <KitInput id="notes" v-model="localWord.notes" placeholder="Ваши заметки..." />

        <label for="tags">Теги (через запятую)</label>
        <KitInput id="tags" v-model="localWord.tags" placeholder="hsk1, еда, ..." />
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

  .hanzi {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--fg-accent-color);
  }

  .pinyin {
    margin: 0 0 12px;
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
  }
}

.translation {
  font-size: 0.95rem;
  line-height: 1.5;
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
