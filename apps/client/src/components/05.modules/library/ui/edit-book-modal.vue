<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput, KitSelect } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useLibraryStore } from '../store/library.store'

const props = defineProps<{
  book: Book | null
}>()

const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

const visible = defineModel<boolean>('visible', { required: true })

const store = useLibraryStore()
const toast = useToast()

const editCoverInput = ref<HTMLInputElement | null>(null)
const editingBook = ref<Partial<Book>>({})
const editingCoverFile = ref<File | null>(null)

const bookLanguageOptions = [
  { label: 'Английский (en)', value: 'en' },
  { label: 'Китайский (zh)', value: 'zh' },
  { label: 'Японский (ja)', value: 'ja' },
]

function formatToDateTimeLocal(dateString?: string) {
  if (!dateString)
    return ''
  return dateString.replace(' ', 'T').slice(0, 16)
}

function parseFromDateTimeLocal(localString?: string) {
  if (!localString)
    return ''
  return `${localString.replace('T', ' ')}:00`
}

watch(() => props.book, (newBook) => {
  if (newBook) {
    editingCoverFile.value = null
    editingBook.value = {
      ...newBook,
      language: newBook.language === 'jp' ? 'ja' : newBook.language,
      createdAt: formatToDateTimeLocal(newBook.createdAt),
    }
  }
  else {
    editingBook.value = {}
  }
}, { immediate: true })

const coverSrc = computed(() => {
  if (!editingBook.value.coverUrl)
    return ''
  return editingBook.value.coverUrl.startsWith('data:')
    ? editingBook.value.coverUrl
    : `${BASE}${editingBook.value.coverUrl}`
})

function onEditCoverChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  editingCoverFile.value = file
  const reader = new FileReader()
  reader.onload = (event) => {
    editingBook.value.coverUrl = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function handleSave() {
  if (!editingBook.value.id)
    return

  try {
    const payload = { ...editingBook.value }
    payload.createdAt = parseFromDateTimeLocal(payload.createdAt)
    payload.currentPage = Number(payload.currentPage)

    if (editingCoverFile.value) {
      await store.updateBookCover(payload.id, editingCoverFile.value)
      delete payload.coverUrl
    }

    await store.updateBookInfo(payload.id, payload)
    visible.value = false
    toast.success('Книга обновлена')
  }
  catch (e: any) {
    toast.error(e.message || 'Не удалось обновить книгу')
  }
}

async function handleDelete() {
  if (!editingBook.value.id)
    return
  try {
    await store.deleteBook(editingBook.value.id)
    visible.value = false
    toast.success('Книга удалена')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка удаления')
  }
}
</script>

<template>
  <KitDialog v-model:visible="visible" title="Редактировать книгу" icon="mdi:file-document-edit-outline" :max-width="500">
    <div class="edit-form-grid">
      <div class="form-group">
        <label>Обложка</label>
        <div class="edit-cover-preview" @click="editCoverInput?.click()">
          <img v-if="coverSrc" :src="coverSrc" alt="Обложка">
          <div v-else class="placeholder">
            <Icon icon="mdi:image-plus" />
          </div>
          <div class="overlay">
            Изменить
          </div>
        </div>
        <input ref="editCoverInput" type="file" accept="image/*" hidden @change="onEditCoverChange">
      </div>

      <div class="form-group">
        <label>Название</label>
        <KitInput v-model="editingBook.title!" placeholder="Название книги" />
      </div>

      <div class="form-group">
        <label>Автор</label>
        <KitInput v-model="editingBook.author!" placeholder="Имя автора" />
      </div>

      <div class="form-group row-group">
        <div class="form-group">
          <label>Язык</label>
          <KitSelect v-if="editingBook.language !== undefined" v-model="editingBook.language" :options="bookLanguageOptions" aria-label="Выбор языка" />
        </div>
      </div>

      <div class="form-group">
        <label>Дата добавления</label>
        <input v-model="editingBook.createdAt" type="datetime-local" class="native-date-input">
      </div>
    </div>

    <template #footer>
      <KitBtn variant="text" class="mr-auto" @click="handleDelete">
        Удалить
      </KitBtn>
      <div style="flex-grow:1" />
      <KitBtn variant="tonal" @click="visible = false">
        Отмена
      </KitBtn>
      <KitBtn color="primary" @click="handleSave">
        Сохранить
      </KitBtn>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.edit-form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }
  }

  .row-group {
    flex-direction: row;
    align-items: center;
    gap: 12px;

    .form-group {
      flex: 1;
    }
  }

  .native-date-input {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    font-family: inherit;
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: 6px;
    outline: none;
    height: 38px;
    padding: 0 12px;
    font-size: 0.875rem;

    &:focus {
      border-color: var(--fg-accent-color);
    }
  }
}

.edit-cover-preview {
  width: 120px;
  height: 180px;
  border-radius: 8px;
  background-color: var(--bg-tertiary-color);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border: 1px dashed var(--border-primary-color);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--fg-secondary-color);
  }

  .overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .overlay {
    opacity: 1;
  }
}

.mr-auto {
  margin-right: auto;
}
</style>
