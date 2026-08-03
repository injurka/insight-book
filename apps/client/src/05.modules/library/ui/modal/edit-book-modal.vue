<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn, KitCheckbox, KitDialog, KitImage, KitInput, KitPrompt, KitSelect } from '~/02.kit'
import { useEditBookForm } from '../../composables/use-edit-book-form'

interface Props {
  book: Book | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', payload: { bookData: Partial<Book>, coverFile: File | null }): void
  (e: 'delete', bookId: number): void
}>()

const authStore = useAuthStore()
const { t } = useI18n()

const visible = defineModel<boolean>('visible', { required: true })

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

function onConfirmDelete() {
  handleDelete()
}

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
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('library.editBook')"
    icon="mdi:file-document-edit-outline"
    :max-width="500"
  >
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
        <input
          ref="editCoverInput"
          type="file"
          accept="image/*"
          hidden
          @change="onEditCoverChange"
        >
      </div>

      <div class="form-group">
        <label>{{ t('library.bookTitle') }}</label>
        <KitInput v-model="editingBook.title" :placeholder="t('library.bookTitle')" />
      </div>

      <div class="form-group">
        <label>{{ t('library.author') }}</label>
        <KitInput v-model="editingBook.author" :placeholder="t('library.authorName')" />
      </div>

      <div class="form-group row-group">
        <div class="form-group">
          <label>{{ t('settings.appLanguage') }}</label>
          <KitSelect v-if="editingBook.language !== undefined" v-model="editingBook.language" :options="bookLanguageOptions" />
        </div>
        <div class="form-group">
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
        <KitCheckbox v-model="editingBook.isFavorite" :label="t('library.addToFavorites')" :disabled="isReadOnly" />
      </div>

      <div v-if="!authStore.isSingleMode" class="publish-request-block">
        <template v-if="isReadOnly">
          <div class="status-info">
            <div class="status-badge success">
              <Icon icon="mdi:check-circle" class="iconify" />
              {{ t('library.publicStatusPublished') }}
            </div>
            <p class="warning-text">
              {{ t('library.publicBookWarning') }}
            </p>
          </div>
        </template>
        <template v-else-if="editingBook.publicStatus === 'pending'">
          <div class="status-info">
            <div class="status-badge warning">
              <Icon icon="mdi:clock-outline" class="iconify" />
              {{ t('library.publicStatusPending') }}
            </div>
          </div>
          <KitBtn
            variant="outlined"
            color="error"
            size="sm"
            @click="editingBook.publicStatus = 'private'"
          >
            {{ t('library.cancelPublishRequest') }}
          </KitBtn>
        </template>
        <template v-else>
          <div class="status-info">
            <div class="status-badge">
              {{ t('library.notPublished') || 'Не опубликовано' }}
            </div>
          </div>
          <KitBtn
            variant="outlined"
            color="primary"
            size="sm"
            icon="mdi:earth"
            @click="editingBook.publicStatus = 'pending'"
          >
            {{ t('library.sendPublishRequest') }}
          </KitBtn>
        </template>
      </div>

      <div class="form-group row-group">
        <div class="form-group flex-2">
          <label>{{ t('library.series') }}</label>
          <KitInput v-model="editingBook.series" :placeholder="t('library.seriesPlaceholder')" />
        </div>
        <div class="form-group">
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

      &.flex-2 {
        flex: 2;
      }
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
.spacer {
  flex-grow: 1;
}
.publish-request-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-secondary-color);

  .status-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 16px;
  &.success {
    background-color: rgba(var(--v-theme-success), 0.15);
    color: var(--fg-success-color, #4caf50);
  }
  &.warning {
    background-color: rgba(var(--v-theme-warning), 0.15);
    color: var(--fg-warning-color, #ff9800);
  }
  .iconify {
    font-size: 1.2rem;
  }
}
.warning-text {
  font-size: 0.85rem;
  color: var(--fg-error-color, #f44336);
  margin: 0;
}
</style>
