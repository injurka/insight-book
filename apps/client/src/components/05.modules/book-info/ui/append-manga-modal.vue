<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { KitBtn, KitDialog, KitInput } from '~/components/01.kit'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useToast } from '~/shared/composables/use-toast'

const visible = defineModel<boolean>('visible', { required: true })
const store = useLibraryStore()
const toast = useToast()

const isUploading = ref(false)
const chapterTitle = ref('')
const selectedFiles = ref<File[]>([])

function onFilesChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    // Сортируем так же, как и при массовой загрузке
    selectedFiles.value = Array.from(target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }
}

const canSubmit = computed(() => selectedFiles.value.length > 0)

async function submit() {
  if (!canSubmit.value || !store.currentBookInfo)
    return

  isUploading.value = true
  try {
    await store.uploadMangaChapter(store.currentBookInfo.id, chapterTitle.value, selectedFiles.value)
    toast.success(`Успешно добавлено ${selectedFiles.value.length} страниц`)

    // Очистка и закрытие
    visible.value = false
    chapterTitle.value = ''
    selectedFiles.value = []
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Ошибка добавления страниц')
  }
  finally {
    isUploading.value = false
  }
}
</script>

<template>
  <KitDialog v-model:visible="visible" title="Добавление страниц" icon="mdi:image-plus" :max-width="500" :persistent="isUploading">
    <div v-if="isUploading" class="uploading-state">
      <Icon icon="mdi:cloud-upload-outline" class="spin-icon pulse" />
      <h3>Загрузка страниц...</h3>
      <p>Пожалуйста, подождите. Это может занять некоторое время.</p>
    </div>

    <div v-else class="form-content">
      <div class="form-group">
        <label>Название главы (опционально)</label>
        <KitInput v-model="chapterTitle" placeholder="Например: Глава 2" />
        <span class="hint">Если оставить пустым, страницы просто добавятся в конец.</span>
      </div>

      <div class="form-group">
        <label>Страницы (изображения)</label>
        <input id="append-files-input" type="file" multiple accept="image/jpeg, image/png, image/webp" class="hidden-file-input" @change="onFilesChange">

        <label for="append-files-input" class="file-drop-area" :class="{ 'has-files': selectedFiles.length > 0 }">
          <Icon :icon="selectedFiles.length > 0 ? 'mdi:check-circle' : 'mdi:image-multiple-outline'" />
          <span>{{ selectedFiles.length > 0 ? `Выбрано изображений: ${selectedFiles.length}` : 'Нажмите, чтобы выбрать изображения' }}</span>
        </label>
      </div>
    </div>

    <template v-if="!isUploading" #footer>
      <KitBtn variant="tonal" @click="visible = false">
        Отмена
      </KitBtn>
      <KitBtn color="primary" :disabled="!canSubmit" @click="submit">
        Добавить
      </KitBtn>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.form-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--fg-muted-color);
  }
}

.hidden-file-input {
  display: none;
}

.file-drop-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 1px dashed var(--fg-secondary-color);
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  transition: all 0.2s;
  font-size: 0.95rem;

  svg {
    font-size: 1.6rem;
  }

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  &.has-files {
    background: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.1);
    border-color: var(--fg-success-color);
    color: var(--fg-success-color);
    border-style: solid;
  }
}

.uploading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;

  .spin-icon {
    font-size: 4rem;
    color: var(--fg-accent-color);
    margin-bottom: 16px;

    &.pulse {
      animation: pulse-op 1.5s infinite;
    }
  }
  h3 {
    margin: 0 0 8px;
    color: var(--fg-primary-color);
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
  }
}

@keyframes pulse-op {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
