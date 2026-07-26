<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitInput, KitSelect, KitTabs } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useAuthStore } from '~/shared/store/auth.store'
import { useLibraryStore } from '../../store/library.store'

const visible = defineModel<boolean>('visible', { required: true })
const store = useLibraryStore()
const toast = useToast()
const { t } = useI18n()
const authStore = useAuthStore()

const activeTab = ref<'file' | 'images'>('file')
const isUploading = ref(false)
const uploadProgressText = ref('')

const tabItems = computed(() => [
  { id: 'file', label: t('library.readyFile') },
  { id: 'images', label: t('library.buildFromImages') },
])

const customManga = ref({
  title: '',
  author: '',
  language: 'ja',
  chapters: [
    { id: Date.now(), title: `${t('library.chapter')} 1`, files: [] as File[] },
  ],
})

const langOptions = computed(() => [
  { label: t('library.langJa'), value: 'ja' },
  { label: t('library.langZh'), value: 'zh' },
  { label: t('library.langEn'), value: 'en' },
  { label: t('library.langRu'), value: 'ru' },
])

const archiveInputRef = ref<HTMLInputElement | null>(null)

function triggerArchiveUpload() {
  archiveInputRef.value?.click()
}

async function onArchiveSelected(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    target.value = ''

    isUploading.value = true
    uploadProgressText.value = t('library.uploadingAndProcessing')

    try {
      const book = await store.uploadBook(file)
      await authStore.checkAuth()
      toast.success(t('library.uploadSuccess'))
      visible.value = false

      if (book && book.id) {
        store.analyzeVocabulary(book.id).catch(e => console.error('Auto vocab analysis failed', e))
      }
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : t('library.uploadError'))
    }
    finally {
      isUploading.value = false
    }
  }
}

function addChapter() {
  customManga.value.chapters.push({
    id: Date.now(),
    title: `${t('library.chapter')} ${customManga.value.chapters.length + 1}`,
    files: [],
  })
}

function removeChapter(idx: number) {
  customManga.value.chapters.splice(idx, 1)
}

function handleChapterFiles(idx: number, e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    customManga.value.chapters[idx].files = Array.from(target.files)
  }
}

const canSubmitManga = computed(() => {
  return customManga.value.title.trim().length > 0
    && customManga.value.chapters.some(c => c.files.length > 0)
})

async function submitCustomManga() {
  if (!canSubmitManga.value)
    return

  isUploading.value = true
  try {
    uploadProgressText.value = t('library.creatingBook')
    const newBook = await store.createCustomManga(
      customManga.value.title,
      customManga.value.author,
      customManga.value.language,
    )

    const totalChapters = customManga.value.chapters.length

    for (let i = 0; i < totalChapters; i++) {
      const chapter = customManga.value.chapters[i]
      if (chapter.files.length === 0)
        continue

      uploadProgressText.value = t('library.uploadingChapter', { current: i + 1, total: totalChapters, pages: chapter.files.length })
      await store.uploadMangaChapter(newBook.id, chapter.title, chapter.files)
    }

    await authStore.checkAuth()

    if (newBook && newBook.id) {
      store.analyzeVocabulary(newBook.id).catch(e => console.error('Auto vocab analysis failed', e))
    }

    uploadProgressText.value = t('analysis.done')
    setTimeout(() => {
      visible.value = false
      customManga.value = {
        title: '',
        author: '',
        language: 'ja',
        chapters: [{ id: Date.now(), title: `${t('library.chapter')} 1`, files: [] }],
      }
    }, 1000)
  }
  catch (err) {
    uploadProgressText.value = `Ошибка: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`
  }
  finally {
    isUploading.value = false
  }
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('library.addBookTitle')"
    icon="mdi:book-plus-outline"
    :max-width="600"
    :persistent="isUploading"
  >
    <div v-if="isUploading" class="uploading-state">
      <Icon icon="mdi:cloud-upload-outline" class="spin-icon pulse" />
      <h3>{{ t('library.uploadingWait') }}</h3>
      <p>{{ uploadProgressText }}</p>
    </div>

    <div v-else class="upload-modal-content">
      <KitTabs v-model="activeTab" :items="tabItems" :cache="false">
        <template #file>
          <div class="tab-pane archive-pane">
            <Icon icon="mdi:file-document-multiple-outline" class="pane-icon" />
            <h4>EPUB, FB2, CBZ, ZIP</h4>
            <p>{{ t('library.uploadReadyBook') }}</p>
            <KitBtn
              size="lg"
              color="primary"
              icon="mdi:upload"
              @click="triggerArchiveUpload"
            >
              {{ t('library.selectFile') }}
            </KitBtn>
            <input
              ref="archiveInputRef"
              type="file"
              accept=".epub,.cbz,.zip,.fb2"
              hidden
              @change="onArchiveSelected"
            >
          </div>
        </template>

        <template #images>
          <div class="tab-pane images-pane">
            <div class="form-row">
              <div class="form-group flex-2">
                <label>{{ t('library.mangaTitle') }}</label>
                <KitInput v-model="customManga.title" :placeholder="t('library.mangaTitlePlaceholder')" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label>{{ t('library.authorOptional') }}</label>
                <KitInput v-model="customManga.author" :placeholder="t('library.authorName')" />
              </div>
              <div class="form-group flex-1">
                <label>{{ t('library.originalLanguage') }}</label>
                <KitSelect v-model="customManga.language" :options="langOptions" />
              </div>
            </div>

            <div class="chapters-section">
              <div class="chapters-header">
                <label>{{ t('library.chaptersAndPages') }}</label>
                <KitBtn
                  size="xs"
                  variant="text"
                  color="primary"
                  icon="mdi:plus"
                  @click="addChapter"
                >
                  {{ t('library.addChapter') }}
                </KitBtn>
              </div>

              <div class="chapters-list">
                <div v-for="(chapter, idx) in customManga.chapters" :key="chapter.id" class="chapter-card">
                  <div class="chapter-header">
                    <KitInput v-model="chapter.title" :placeholder="t('library.chapterTitlePlaceholder')" class="chapter-input" />
                    <KitBtn
                      v-if="customManga.chapters.length > 1"
                      size="sm"
                      variant="text"
                      color="error"
                      icon="mdi:delete-outline"
                      @click="removeChapter(idx)"
                    />
                  </div>

                  <div class="chapter-files">
                    <input
                      :id="`file-${chapter.id}`"
                      type="file"
                      multiple
                      accept="image/jpeg, image/png, image/webp"
                      class="hidden-file-input"
                      @change="handleChapterFiles(idx, $event)"
                    >

                    <label :for="`file-${chapter.id}`" class="file-drop-area" :class="{ 'has-files': chapter.files.length > 0 }">
                      <Icon :icon="chapter.files.length > 0 ? 'mdi:check-circle' : 'mdi:image-multiple-outline'" />
                      <span>{{ chapter.files.length > 0 ? t('library.selectedCount', { count: chapter.files.length }) : t('library.clickToSelect') }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </KitTabs>
    </div>

    <template v-if="!isUploading && activeTab === 'images'" #footer>
      <KitBtn variant="tonal" @click="visible = false">
        {{ t('dictionary.cancel') }}
      </KitBtn>
      <KitBtn color="primary" :disabled="!canSubmitManga" @click="submitCustomManga">
        {{ t('library.saveAndUpload') }}
      </KitBtn>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.upload-modal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

.archive-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  gap: 12px;

  .pane-icon {
    font-size: 4rem;
    color: var(--fg-accent-color);
    opacity: 0.8;
  }

  h4 {
    margin: 0;
    font-size: 1.2rem;
  }
  p {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
  }
}

.images-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .form-row {
    display: flex;
    gap: 12px;
    @include media-down(sm) {
      flex-direction: column;
    }
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
    &.flex-1 {
      flex: 1;
    }
    &.flex-2 {
      flex: 2;
    }
  }

  .chapters-section {
    margin-top: 8px;
    border-top: 1px dashed var(--border-secondary-color);
    padding-top: 16px;
  }

  .chapters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    label {
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }

  .chapters-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 40vh;
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

  .chapter-card {
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chapter-header {
    display: flex;
    align-items: center;
    gap: 8px;
    .chapter-input {
      flex-grow: 1;
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
    padding: 16px;
    border: 1px dashed var(--fg-secondary-color);
    border-radius: 8px;
    cursor: pointer;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    transition: all 0.2s;
    font-size: 0.9rem;

    svg {
      font-size: 1.4rem;
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
}

.uploading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 16px;

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
