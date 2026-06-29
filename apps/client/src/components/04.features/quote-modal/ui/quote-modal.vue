<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'

const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  initialData: {
    text: string
    translation?: string
    note?: string
    color?: string
  }
  bookContext?: {
    id: number
    language: string
  }
  isFetchingTranslation?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'save': [data: { text: string, translation: string, note: string, color: string }]
}>()

const { t } = useI18n()
const toast = useToast()

const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']

const form = ref({
  text: '',
  translation: '',
  note: '',
  color: highlightColors[0],
})

watch(() => props.visible, (val) => {
  if (val) {
    form.value = {
      text: props.initialData.text || '',
      translation: props.initialData.translation || '',
      note: props.initialData.note || '',
      color: props.initialData.color || highlightColors[0],
    }
  }
})

watch(() => props.initialData.translation, (newVal) => {
  if (props.visible && newVal) {
    form.value.translation = newVal
  }
})

const isTranslating = ref(false)
const previewTranslation = ref(true)

async function translate() {
  if (!form.value.text || !props.bookContext)
    return

  isTranslating.value = true
  try {
    const res = await api.books.analyze(props.bookContext.id, form.value.text, props.bookContext.language)
    if (res && res.translation) {
      form.value.translation = res.translation
      toast.success(t('notebook.translation'))
    }
    else {
      toast.error(t('aiAnalysisError') || 'Не удалось получить перевод')
    }
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : (t('quote.translationError') || 'Ошибка перевода'))
  }
  finally {
    isTranslating.value = false
  }
}

function handleSave() {
  emit('save', { ...form.value })
}
</script>

<template>
  <KitDialog
    :visible="visible"
    :title="mode === 'edit' ? t('notebook.editQuote') : t('analysis.saveToNotebook')"
    :max-width="500"
    z-index="1450"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="save-quote-content">
      <div class="quote-preview" :style="{ borderLeftColor: form.color }">
        <p>“{{ form.text }}”</p>
      </div>

      <div class="input-group">
        <div class="form-group-header">
          <label class="input-label">{{ t('notebook.translation') }}</label>
          <div style="display: flex; gap: 8px; align-items: center">
            <button
              v-if="bookContext && form.text"
              type="button"
              class="ai-translate-link-btn"
              :disabled="isTranslating || isFetchingTranslation"
              style="background: transparent; border: none; color: var(--fg-accent-color); font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 4px; border-radius: 4px;"
              @click="translate"
            >
              <Icon :icon="(isTranslating || isFetchingTranslation) ? 'mdi:loading' : 'mdi:robot-outline'" :class="{ 'spin-animation': (isTranslating || isFetchingTranslation) }" />
              <span>{{ (isTranslating || isFetchingTranslation) ? t('notebook.translating') : t('notebook.aiTranslate') }}</span>
            </button>
            <div class="mode-toggle">
              <KitBtn :variant="!previewTranslation ? 'tonal' : 'text'" size="sm" icon="mdi:pencil" @click="previewTranslation = false" />
              <KitBtn :variant="previewTranslation ? 'tonal' : 'text'" size="sm" icon="mdi:eye" @click="previewTranslation = true" />
            </div>
          </div>
        </div>

        <div v-if="previewTranslation" class="markdown-preview preview-box" v-html="form.translation || (isFetchingTranslation ? t('analysis.analyzing') : '')" />
        <textarea
          v-else
          v-model="form.translation"
          class="translation-input"
          rows="3"
          :placeholder="isFetchingTranslation ? t('analysis.analyzing') : t('notebook.translation')"
          :disabled="isFetchingTranslation || isTranslating"
        />
      </div>

      <div class="input-group">
        <label class="input-label">{{ t('notebook.note') }}</label>
        <textarea
          v-model="form.note"
          :placeholder="t('notebook.note')"
          class="note-textarea translation-input"
          rows="2"
        />
      </div>

      <div class="input-group">
        <label class="input-label">{{ t('notebook.color') }}</label>
        <div class="color-picker">
          <button
            v-for="color in highlightColors"
            :key="color"
            type="button"
            class="color-btn"
            :class="{ 'is-active': form.color === color }"
            :style="{ backgroundColor: color }"
            @click="form.color = color"
          />
          <div
            class="color-btn custom-color-wrapper"
            :class="{ 'is-active': !highlightColors.includes(form.color) }"
            :style="{ background: !highlightColors.includes(form.color) ? form.color : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }"
          >
            <Icon v-if="highlightColors.includes(form.color)" icon="mdi:palette" class="custom-color-icon" />
            <input
              v-model="form.color"
              type="color"
              class="invisible-color-input"
            >
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <KitBtn variant="tonal" @click="emit('update:visible', false)">
          {{ t('notebook.cancel') }}
        </KitBtn>
        <KitBtn v-if="isFetchingTranslation || isTranslating" color="primary" disabled>
          <Icon icon="mdi:loading" class="spin-animation" />
        </KitBtn>
        <KitBtn v-else color="primary" @click="handleSave">
          {{ t('notebook.save') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.save-quote-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;

  .quote-preview {
    background-color: var(--bg-tertiary-color);
    border-left: 4px solid;
    padding: 12px;
    border-radius: 4px;
    p {
      margin: 0;
      font-style: italic;
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .input-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
      margin: 0;
    }

    .form-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .mode-toggle {
      display: flex;
      gap: 2px;
      background: var(--bg-secondary-color, #f3f4f6);
      padding: 2px;
      border-radius: 6px;

      :deep(.kit-btn) {
        min-width: 28px;
        height: 24px;
        padding: 0;
        --btn-border-radius: 4px;

        svg {
          width: 14px;
          height: 14px;
        }
      }
    }

    .preview-box {
      width: 100%;
      background-color: var(--bg-secondary-color, #f3f4f6);
      color: var(--fg-primary-color);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.95rem;
      min-height: 48px;
      max-height: 300px;
      overflow-y: auto;
      line-height: 1.5;
    }

    .translation-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border-primary-color);
      background-color: transparent;
      color: var(--fg-primary-color);
      font-family: inherit;
      font-size: 0.95rem;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;

      &:focus {
        border-color: var(--fg-primary-color);
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }
  }

  .color-picker {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;

    .color-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      border: none;
      outline: 2px solid transparent;
      outline-offset: -2px;
      transition: outline-color 0.1s;
      padding: 0;

      &.is-active {
        outline-color: var(--fg-primary-color);
      }
    }

    .custom-color-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      .custom-color-icon {
        color: white;
        font-size: 18px;
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
        pointer-events: none;
        z-index: 1;
      }

      .invisible-color-input {
        position: absolute;
        top: -5px;
        left: -5px;
        width: calc(100% + 10px);
        height: calc(100% + 10px);
        opacity: 0;
        cursor: pointer;
      }
    }
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.spin-animation {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-translate-link-btn {
  &:hover {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
