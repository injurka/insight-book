<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BOOK_TAGS } from '~/01.shared/constants/tags'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTabs } from '~/02.kit/molecules/kit-tabs/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useBookStatsEdit } from '../composables/use-book-stats-edit'

const visible = defineModel<boolean>('visible', { required: true })
const libraryStore = useLibraryStore()
const networkStore = useNetworkStore()
const { t } = useI18n()
const tab = ref<'manual' | 'automatic'>('manual')
const {
  editForm,
  editDescLang,
  currentDifficultyOptions,
  isSaving,
  isDirty,
  saveStats,
  triggerAiAnalysis,
  triggerVocabularyAnalysis,
} = useBookStatsEdit(visible)
const busy = computed(() => isSaving.value || libraryStore.isAnalyzingBook || libraryStore.isAnalyzingVocab)
const tabs = computed(() => [
  { id: 'manual' as const, label: t('bookStats.manualEdit') },
  { id: 'automatic' as const, label: t('bookStats.automatic') },
])
const settingsStore = useGlobalSettingsStore()
const selectedTags = computed({
  get: () => editForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
  set: (tags: (string | number)[]) => { editForm.tags = tags.join(', ') },
})
const tagOptions = computed(() => [
  ...Object.entries(BOOK_TAGS).map(([value, labels]) => ({
    value,
    label: labels[settingsStore.appLanguage as keyof typeof labels] || labels.en,
  })),
  ...selectedTags.value.filter(tag => !(tag in BOOK_TAGS)).map(tag => ({ value: tag, label: tag })),
])
const languages = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]
watch(visible, (open) => {
  if (open)
    tab.value = 'manual'
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('bookStats.editorTitle')"
    :description="libraryStore.currentBookInfo?.title"
    icon="mdi:book-edit-outline"
    :max-width="620"
    :minimizable="false"
    :resizable="false"
    :persistent="busy || isDirty"
    :closable="!busy && !isDirty"
  >
    <div class="editor-content">
      <KitTabs v-model="tab" :items="tabs" :disabled="busy">
        <template #manual>
          <form id="book-stats-form" @submit.prevent="saveStats">
            <fieldset :disabled="busy || networkStore.effectiveOffline" :inert="busy || networkStore.effectiveOffline" class="editor-fields">
              <div class="field">
                <span id="book-difficulty-label">{{ t('bookStats.difficulty') }}</span>
                <KitSelect v-model="editForm.difficulty" :options="currentDifficultyOptions" aria-labelledby="book-difficulty-label" />
              </div>
              <div class="field">
                <span id="book-tags-label">{{ t('bookStats.genres') }}</span>
                <KitSelect
                  v-model="selectedTags"
                  :options="tagOptions"
                  multiple
                  aria-labelledby="book-tags-label"
                />
              </div>
              <div class="field">
                <div class="annotation-header">
                  <label for="book-annotation">{{ t('bookStats.annotation') }}</label>
                  <KitSelect
                    v-model="editDescLang"
                    :options="languages"
                    size="sm"
                    :aria-label="t('bookStats.descriptionLang')"
                  />
                </div>
                <textarea
                  id="book-annotation"
                  v-model="editForm.descriptionByLang[editDescLang]"
                  rows="6"
                  :placeholder="t('bookStats.annotationPlaceholder')"
                />
                <p class="hint">
                  {{ t('bookStats.languageHint') }}
                </p>
              </div>
            </fieldset>
          </form>
        </template>
        <template #automatic>
          <div class="automatic-tools">
            <p class="hint">
              {{ t('bookStats.automaticHint') }}
            </p>
            <p v-if="isDirty" class="draft-notice" role="status">
              {{ t('bookStats.saveDraftFirst') }}
            </p>
            <section class="tool-card">
              <h3>{{ t('bookStats.aiInfoTitle') }}</h3>
              <p>{{ t('bookStats.aiInfoHint') }}</p>
              <KitBtn
                variant="tonal"
                color="primary"
                icon="mdi:creation"
                :loading="libraryStore.isAnalyzingBook"
                :disabled="busy || isDirty || networkStore.effectiveOffline"
                @click="triggerAiAnalysis"
              >
                {{ t('bookStats.generateAiInfo') }}
              </KitBtn>
            </section>
            <section v-if="libraryStore.currentBookInfo?.type !== 'manga'" class="tool-card">
              <h3>{{ t('bookStats.vocabularyTitle') }}</h3>
              <p>{{ t('bookStats.vocabularyHint') }}</p>
              <KitBtn
                variant="outlined"
                icon="mdi:chart-pie"
                :loading="libraryStore.isAnalyzingVocab"
                :disabled="busy || isDirty || networkStore.effectiveOffline"
                @click="triggerVocabularyAnalysis"
              >
                {{ t('bookStats.collectVocab') }}
              </KitBtn>
            </section>
            <p v-if="busy" class="hint" role="status">
              {{ t('bookStats.analysisPending') }}
            </p>
          </div>
        </template>
      </KitTabs>
      <p v-if="networkStore.effectiveOffline" class="draft-notice" role="status">
        {{ t('network.needOnline') }}
      </p>
    </div>
    <template #footer>
      <div class="editor-footer">
        <span class="hint">{{ isDirty ? t('bookStats.unsavedChanges') : '' }}</span>
        <KitBtn variant="text" :disabled="busy" @click="visible = false">
          {{ isDirty ? t('bookStats.discardChanges') : t('bookStats.cancel') }}
        </KitBtn>
        <KitBtn
          v-if="tab === 'manual'"
          type="submit"
          form="book-stats-form"
          color="primary"
          :loading="isSaving"
          :disabled="busy || !isDirty || networkStore.effectiveOffline"
        >
          {{ t('bookStats.save') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
:deep(.mobile-tab-info) {
  display: none;
}
.editor-content {
  padding: 20px 2px 4px;
}
.editor-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
}
.annotation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
textarea {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--border-primary-color);
  border-radius: 8px;
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font: inherit;
  line-height: 1.6;
}
textarea:focus-visible {
  outline: 2px solid var(--fg-accent-color);
  outline-offset: 2px;
}
.hint {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  line-height: 1.6;
}
.automatic-tools {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tool-card {
  padding: 16px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  background: var(--bg-secondary-color);
}
.tool-card h3 {
  margin: 0;
  font-size: 1rem;
}
.tool-card p {
  margin: 8px 0 16px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.6;
}
.draft-notice {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-warning-color);
  color: var(--fg-warning-color);
  font-size: 0.85rem;
  line-height: 1.6;
}
.editor-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.editor-footer > .hint {
  margin-right: auto;
}
@include media-down(sm) {
  .editor-footer > .hint {
    flex-basis: 100%;
  }
  .editor-footer :deep(.kit-btn) {
    flex: 1;
    min-height: 44px;
  }
  .tool-card :deep(.kit-btn) {
    width: 100%;
  }
}
</style>
