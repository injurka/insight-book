<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog, KitImage, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'
import { useEditBookForm } from '../../composables/use-edit-book-form'

const props = defineProps<{
  book: Book | null
}>()

const emit = defineEmits<{
  (e: 'save', payload: { bookData: Partial<Book>, coverFile: File | null }): void
  (e: 'delete', bookId: number): void
}>()

const { copy } = useClipboard()
const toast = useToast()
const authStore = useAuthStore()
const { t } = useI18n()

const visible = defineModel<boolean>('visible', { required: true })

const {
  editCoverInput,
  editingBook,
  onEditCoverChange,
  handleSave,
  handleDelete,
} = useEditBookForm(toRef(props, 'book'), emit)

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

function copyLink() {
  if (editingBook.value.id) {
    const link = `${window.location.origin}/book/${editingBook.value.id}`
    copy(link)
    toast.success(t('library.bookLinkCopied'))
  }
}
</script>

<template>
  <KitDialog v-model:visible="visible" :title="t('library.editBook')" icon="mdi:file-document-edit-outline" :max-width="500">
    <div class="edit-form-grid">
      <div class="form-group">
        <label>{{ t('library.cover') }}</label>
        <div class="edit-cover-preview" @click="editCoverInput?.click()">
          <KitImage
            :src="editingBook.localCoverUrl || editingBook.coverUrl"
            fallback-icon="mdi:image-plus"
          />
          <div class="overlay">
            {{ t('bookInfo.changeCover') }}
          </div>
        </div>
        <input ref="editCoverInput" type="file" accept="image/*" hidden @change="onEditCoverChange">
      </div>

      <div class="form-group">
        <label>{{ t('opds.name') }}</label>
        <KitInput v-model="editingBook.title" :placeholder="t('library.bookTitle')" />
      </div>

      <div class="form-group">
        <label>{{ t('library.author') }}</label>
        <KitInput v-model="editingBook.author" :placeholder="t('library.authorName')" />
      </div>

      <div class="form-group row-group">
        <div class="form-group" style="flex: 1">
          <label>{{ t('settings.appLanguage') }}</label>
          <KitSelect v-if="editingBook.language !== undefined" v-model="editingBook.language" :options="bookLanguageOptions" />
        </div>
        <div class="form-group" style="flex: 1">
          <label>{{ t('dictionary.status') }}</label>
          <KitSelect v-if="editingBook.status !== undefined" v-model="editingBook.status" :options="statusOptions" />
        </div>
      </div>

      <div v-if="editingBook.type === 'manga'" class="form-group">
        <label>{{ t('library.textDirection') }}</label>
        <KitSelect v-if="editingBook.textDirection !== undefined" v-model="textDirectionModel" :options="textDirectionOptions" />
      </div>

      <div class="form-group">
        <label>{{ t('library.collection') }}</label>
        <KitInput v-model="editingBook.collection" :placeholder="t('library.collectionPlaceholder')" />
      </div>

      <div class="checkbox-row">
        <KitCheckbox v-model="editingBook.isFavorite" :label="t('library.addToFavorites')" />

        <div v-if="!authStore.isSingleMode" class="public-wrapper">
          <KitCheckbox v-model="editingBook.isPublic" :label="t('library.makePublic')" />
          <KitTooltip v-if="editingBook.isPublic" :text="t('library.copyLink')" placement="top">
            <KitBtn size="xs" variant="outlined" icon="mdi:link-variant" @click="copyLink" />
          </KitTooltip>
        </div>
      </div>

      <div class="form-group row-group">
        <div class="form-group" style="flex: 2">
          <label>{{ t('library.series') }}</label>
          <KitInput v-model="editingBook.series" :placeholder="t('library.seriesPlaceholder')" />
        </div>
        <div class="form-group" style="flex: 1">
          <label>{{ t('library.volumeNumber') }}</label>
          <KitInput v-model="editingBook.seriesNumber" type="number" placeholder="1" />
        </div>
      </div>

      <div class="form-group">
        <label>{{ t('library.dateAdded') }}</label>
        <input v-model="editingBook.createdAt" type="datetime-local" class="native-date-input">
      </div>
    </div>
    <template #footer>
      <KitBtn variant="text" class="mr-auto" @click="handleDelete">
        {{ t('dictionary.deleteItem') }}
      </KitBtn>
      <div style="flex-grow:1" />
      <KitBtn variant="tonal" @click="visible = false">
        {{ t('dictionary.cancel') }}
      </KitBtn>
      <KitBtn color="primary" @click="handleSave">
        {{ t('dictionary.save') }}
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

    :deep(.kit-checkbox) {
      margin-top: 11px;
    }
  }
  .row-group {
    flex-direction: row;
    align-items: flex-start;
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

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    min-height: 28px;

    :deep(.kit-checkbox) {
      margin-top: 0 !important;
      margin-right: 24px;
    }

    .public-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
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

  :deep(.fallback-icon) {
    font-size: 3rem;
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
    z-index: 10;
  }
  &:hover .overlay {
    opacity: 1;
  }
}
.mr-auto {
  margin-right: auto;
}
</style>
