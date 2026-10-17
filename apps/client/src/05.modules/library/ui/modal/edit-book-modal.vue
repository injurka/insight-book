<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitImage } from '~/02.kit/atoms/kit-image/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useEditBookForm } from '../../composables/use-edit-book-form'
import { useLibraryStore } from '../../store/library.store'
import PublishRequestBlock from './publish-request-block.vue'

type PublishStatus = NonNullable<Book['publicStatus']>

interface Props {
  book: Book | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'save', payload: { bookData: Partial<Book>, coverFile: File | null }): void
  (e: 'delete', bookId: number): void
}>()
const visible = defineModel<boolean>('visible', { required: true })

const store = useLibraryStore()
const networkStore = useNetworkStore()
const toast = useToast()
const authStore = useAuthStore()
const { t } = useI18n()
const {
  editCoverInput,
  editingBook,
  onEditCoverChange,
  handleSave,
  handleDelete,
} = useEditBookForm(toRef(props, 'book'), (event, data) => {
  if (event === 'save') {
    emit('save', data as { bookData: Partial<Book>, coverFile: File | null })
  }
  else if (event === 'delete') {
    emit('delete', data as number)
  }
})

const confirmDeleteVisible = ref(false)
const isPublishLoading = ref(false)

const bookLanguageOptions = computed(() => [
  { label: t('library.langEn'), value: 'en' },
  { label: t('library.langZh'), value: 'zh' },
  { label: t('library.langRu'), value: 'ru' },
  { label: t('library.langJa'), value: 'ja' },
])
const statusOptions = computed(() => [
  { label: t('library.statusReading'), value: 'reading' },
  { label: t('library.statusToRead'), value: 'to-read' },
  { label: t('library.statusRead'), value: 'have-read' },
])
const textDirectionOptions = computed(() => [
  { label: t('library.dirAuto'), value: 'auto' },
  { label: t('library.dirLtr'), value: 'ltr' },
  { label: t('library.dirVertical'), value: 'v_rtl' },
  { label: t('library.dirRtl'), value: 'rtl' },
])
const textDirectionModel = computed({
  get: () => editingBook.value.textDirection || 'auto',
  set: (val) => { editingBook.value.textDirection = val === 'auto' ? null : String(val) },
})
const isReadOnly = computed(() => editingBook.value.publicStatus === 'public' || editingBook.value.isPublic)

/**
 * Отправка заявки идёт сразу по клику в блоке публикации, отдельным PATCH'ем
 * только с publicStatus: держать её «в форме» до «Сохранить» нельзя — кнопка
 * обещает отправку, а закрытие модалки молча теряло заявку.
 */
async function updatePublishStatus(next: PublishStatus) {
  const bookId = editingBook.value.id
  const previous = editingBook.value.publicStatus ?? 'private'

  if (bookId === undefined || bookId === null || next === previous)
    return

  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  editingBook.value.publicStatus = next
  isPublishLoading.value = true

  try {
    await store.updateBookInfo(bookId, { publicStatus: next })
  }
  catch {
    editingBook.value.publicStatus = previous
    void store.fetchBooks()
  }
  finally {
    isPublishLoading.value = false
  }
}

function onPublishRequest() {
  void updatePublishStatus('pending')
}

function onPublishCancel() {
  void updatePublishStatus('private')
}

function onConfirmDelete() {
  handleDelete()
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('library.editBook')"
    icon="mdi:file-document-edit-outline"
    :max-width="640"
  >
    <div class="edit-book-form">
      <div class="book-identity">
        <button
          type="button"
          class="edit-cover-button"
          :aria-label="t('bookInfo.changeCover')"
          :disabled="isReadOnly"
          @click="editCoverInput?.click()"
        >
          <KitImage
            :src="editingBook.localCoverUrl || editingBook.coverUrl"
            :alt="editingBook.title || t('library.cover')"
            fallback-icon="mdi:image-plus"
          />
          <span class="cover-action">
            <Icon icon="mdi:camera-outline" />
            {{ t('bookInfo.changeCover') }}
          </span>
        </button>
        <input
          ref="editCoverInput"
          type="file"
          accept="image/*"
          hidden
          @change="onEditCoverChange"
        >

        <div class="identity-fields">
          <div class="form-field">
            <label for="edit-book-title">{{ t('library.bookTitle') }}</label>
            <KitInput
              id="edit-book-title"
              v-model="editingBook.title"
              :placeholder="t('library.bookTitle')"
              :disabled="isReadOnly"
            />
          </div>

          <div class="form-field">
            <label for="edit-book-author">{{ t('library.author') }}</label>
            <KitInput
              id="edit-book-author"
              v-model="editingBook.author"
              :placeholder="t('library.authorName')"
              :disabled="isReadOnly"
            />
          </div>
        </div>
      </div>

      <div class="metadata-grid">
        <div class="form-field">
          <label>{{ t('settings.appLanguage') }}</label>
          <KitSelect v-if="editingBook.language !== undefined" v-model="editingBook.language" :options="bookLanguageOptions" />
        </div>
        <div class="form-field">
          <label>{{ t('dictionary.status') }}</label>
          <KitSelect v-if="editingBook.status !== undefined" v-model="editingBook.status" :options="statusOptions" />
        </div>

        <div v-if="editingBook.type === 'manga'" class="form-field">
          <label>{{ t('library.textDirection') }}</label>
          <KitSelect v-if="editingBook.textDirection !== undefined" v-model="textDirectionModel" :options="textDirectionOptions" />
        </div>

        <div class="form-field metadata-field--full">
          <label for="edit-book-collection">{{ t('library.collection') }}</label>
          <KitInput
            id="edit-book-collection"
            v-model="editingBook.collection"
            :placeholder="t('library.collectionPlaceholder')"
            :disabled="isReadOnly"
          />
        </div>

        <div class="form-field">
          <label for="edit-book-series">{{ t('library.series') }}</label>
          <KitInput
            id="edit-book-series"
            v-model="editingBook.series"
            :placeholder="t('library.seriesPlaceholder')"
            :disabled="isReadOnly"
          />
        </div>
        <div class="form-field">
          <label for="edit-book-volume">{{ t('library.volumeNumber') }}</label>
          <KitInput
            id="edit-book-volume"
            v-model="editingBook.seriesNumber"
            type="number"
            placeholder="1"
            :disabled="isReadOnly"
          />
        </div>
      </div>

      <div class="book-options-row">
        <KitCheckbox
          v-model="editingBook.isFavorite"
          :label="t('library.addToFavorites')"
          :disabled="isReadOnly"
        />

        <div class="form-field date-field">
          <label for="edit-book-created-at">{{ t('library.dateAdded') }}</label>
          <input
            id="edit-book-created-at"
            v-model="editingBook.createdAt"
            type="datetime-local"
            class="native-date-input"
            :disabled="isReadOnly"
          >
        </div>
      </div>

      <PublishRequestBlock
        v-if="!authStore.isSingleMode"
        :status="editingBook.publicStatus"
        :is-read-only="isReadOnly"
        :loading="isPublishLoading"
        @request="onPublishRequest"
        @cancel="onPublishCancel"
      />
    </div>
    <template #footer>
      <KitBtn
        variant="text"
        class="mr-auto"
        color="error"
        @click="confirmDeleteVisible = true"
      >
        {{ t('dictionary.deleteItem') }}
      </KitBtn>
      <div class="spacer" />
      <KitBtn variant="tonal" @click="visible = false">
        {{ t('dictionary.cancel') }}
      </KitBtn>
      <KitBtn color="primary" :disabled="isReadOnly" @click="handleSave">
        {{ t('dictionary.save') }}
      </KitBtn>
    </template>
  </KitDialog>

  <KitPrompt
    v-model:visible="confirmDeleteVisible"
    :title="t('dictionary.deleteItem')"
    :description="t('library.deletePrompt')"
    :hide-input="true"
    :confirm-text="t('dictionary.deleteItem')"
    @submit="onConfirmDelete"
  />
</template>

<style lang="scss" scoped>
.edit-book-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px 2px 4px;
}

.book-identity {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
}

.identity-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.edit-cover-button {
  position: relative;
  display: block;
  width: 88px;
  height: 132px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-primary-color);
  border-radius: 10px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;

  :deep(.kit-image) {
    border-radius: inherit;
  }

  &:hover {
    border-color: var(--fg-accent-color);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 3px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
}

.cover-action {
  position: absolute;
  inset: auto 5px 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 5px 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.68);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.1;

  :deep(svg) {
    flex: 0 0 auto;
    font-size: 0.85rem;
  }
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  label {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    font-weight: 500;
  }
}

.metadata-field--full {
  grid-column: 1 / -1;
}

.book-options-row {
  display: grid;
  grid-template-columns: minmax(130px, 0.75fr) minmax(0, 1.25fr);
  align-items: end;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--border-secondary-color);

  :deep(.kit-checkbox) {
    box-sizing: border-box;
    min-height: 61px;
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--border-primary-color);
    border-radius: 8px;
    background-color: var(--bg-secondary-color);
  }
}

.date-field {
  min-width: 0;
}

.native-date-input {
  appearance: none;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  font-family: inherit;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  outline: none;
  height: 38px;
  padding: 0 10px;
  font-size: 0.875rem;

  &:focus {
    border-color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

@include media-down(xs) {
  .book-identity {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 12px;
  }

  .edit-cover-button {
    width: 76px;
    height: 114px;
  }

  .identity-fields {
    gap: 10px;
  }

  .book-options-row {
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
    gap: 8px;
  }

  .cover-action {
    inset-inline: 3px;
    font-size: 0.58rem;
  }
}
.mr-auto {
  margin-right: auto;
}
.spacer {
  flex-grow: 1;
}
</style>
