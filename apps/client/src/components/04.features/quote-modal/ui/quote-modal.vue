<script setup lang="ts">
import type { LlmAnalysis } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitToggle } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useRepos } from '~/shared/plugins/di'

interface Props {
  visible: boolean
  mode: 'create' | 'edit'
  initialData: {
    id?: number | null
    text: string
    translation?: string
    note?: string
    color?: string
    analysisData?: LlmAnalysis | null
  }
  bookContext?: {
    id: number
    language: string
  }
  isFetchingTranslation?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'save': [data: { text: string, translation: string, note: string, color: string, analysisData: LlmAnalysis | null }]
}>()

const repos = useRepos()

const { t } = useI18n()
const toast = useToast()

const highlightColors = ['#fde047', '#86efac', '#f472b6', '#93c5fd', '#c4b5fd']

const form = ref({
  text: '',
  translation: '',
  note: '',
  color: highlightColors[0],
})

const analysisData = ref<LlmAnalysis | null>(null)
const showAdditionalFields = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    form.value = {
      text: props.initialData.text || '',
      translation: props.initialData.translation || '',
      note: props.initialData.note || '',
      color: props.initialData.color || highlightColors[0],
    }
    analysisData.value = props.initialData.analysisData || null
    showAdditionalFields.value = props.mode === 'edit' && !!(
      props.initialData.note
      || props.initialData.analysisData?.grammarRules?.length
      || props.initialData.analysisData?.vocabulary?.length
    )
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
    const res = await repos.analysis.analyze(props.bookContext.id, form.value.text, props.bookContext.language)
    if (res && res.translation) {
      form.value.translation = res.translation
      analysisData.value = res

      // Auto expand additional fields if grammar/vocab is present in LLM response
      if (res.grammarRules?.length || res.vocabulary?.length) {
        showAdditionalFields.value = true
      }

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
  emit('save', { ...form.value, analysisData: analysisData.value })
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
              v-if="mode === 'create' && bookContext && form.text"
              type="button"
              class="ai-translate-link-btn"
              :disabled="isTranslating || isFetchingTranslation"
              style="background: transparent; border: none; color: var(--fg-accent-color); font-size: 0.8rem; display: flex; align-items: center; gap: 4px; cursor: pointer; padding: 2px 4px; border-radius: 4px;"
              @click="translate"
            >
              <Icon :icon="(isTranslating || isFetchingTranslation) ? 'mdi:loading' : 'mdi:robot-outline'" :class="{ 'spin-animation': (isTranslating || isFetchingTranslation) }" />
              <span>{{ (isTranslating || isFetchingTranslation) ? t('notebook.translating') : t('notebook.aiTranslate') }}</span>
            </button>
            <KitToggle
              v-model="previewTranslation"
              :options="[
                { value: false, icon: 'mdi:pencil', tooltip: t('notebook.edit') || 'Редактировать' },
                { value: true, icon: 'mdi:eye', tooltip: t('notebook.preview') || 'Предпросмотр' },
              ]"
              size="sm"
            />
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

      <div class="additional-toggle-wrapper">
        <button
          type="button"
          class="additional-toggle-btn"
          @click="showAdditionalFields = !showAdditionalFields"
        >
          <span>{{ showAdditionalFields ? (t('quote.hideAdditional') || 'Скрыть дополнительные поля') : (t('quote.showAdditional') || 'Показать дополнительные поля (заметка, грамматика, словарь)') }}</span>
          <Icon :icon="showAdditionalFields ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
      </div>

      <div v-show="showAdditionalFields" class="additional-fields-container">
        <div class="input-group">
          <label class="input-label">{{ t('notebook.note') }}</label>
          <textarea
            v-model="form.note"
            :placeholder="t('quote.notePlaceholder') || 'Ваш комментарий к цитате...'"
            class="note-textarea translation-input"
            rows="2"
          />
        </div>

        <div v-if="analysisData" class="analysis-details">
          <!-- Grammar -->
          <div v-if="analysisData.grammarRules?.length" class="analysis-sub-section">
            <h4 class="sub-section-title">
              <Icon icon="mdi:puzzle-outline" class="sub-section-icon text-accent" />
              <span>{{ t('analysis.grammar') || 'Грамматика' }}</span>
            </h4>
            <div class="compact-cards-list">
              <div v-for="(rule, idx) in analysisData.grammarRules" :key="idx" class="compact-info-card">
                <div class="rule-pattern">
                  {{ rule.pattern }}
                </div>
                <div class="rule-explanation">
                  {{ rule.explanation }}
                </div>
                <div v-if="rule.example" class="rule-example">
                  <span>{{ rule.example }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Vocabulary -->
          <div v-if="analysisData.vocabulary?.length" class="analysis-sub-section">
            <h4 class="sub-section-title">
              <Icon icon="mdi:text-box-search-outline" class="sub-section-icon text-secondary" />
              <span>{{ t('analysis.vocabulary') || 'Словарь' }}</span>
            </h4>
            <div class="compact-cards-list">
              <template v-for="(v, idx) in analysisData.vocabulary" :key="idx">
                <div v-if="v && v.word" class="compact-info-card">
                  <div class="vocab-header">
                    <span class="vocab-word">{{ v.word }}</span>
                    <span v-if="v.transcription" class="vocab-transcription">[{{ v.transcription }}]</span>
                  </div>
                  <div class="vocab-meaning">
                    {{ v.meaning }}
                  </div>
                  <div v-if="v.usageInContext" class="vocab-context">
                    {{ v.usageInContext }}
                  </div>
                </div>
              </template>
            </div>
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

    .preview-box {
      width: 100%;
      background-color: var(--bg-secondary-color, #f3f4f6);
      color: var(--fg-primary-color);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.95rem;
      min-height: 44px;
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

.additional-toggle-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.additional-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--fg-accent-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-secondary-color);
  }
}

.additional-fields-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid var(--border-primary-color, rgba(255, 255, 255, 0.05));
  padding-top: 16px;
  margin-top: 8px;
}

.analysis-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analysis-sub-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-primary-color);

  .sub-section-icon {
    font-size: 1.1rem;
  }
  .text-accent {
    color: var(--fg-accent-color);
  }
  .text-secondary {
    color: var(--fg-secondary-color);
  }
}

.compact-cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compact-info-card {
  padding: 10px 12px;
  background-color: var(--bg-secondary-color, rgba(0, 0, 0, 0.02));
  border-radius: 8px;
  border-left: 3px solid var(--border-primary-color, rgba(255, 255, 255, 0.1));

  .rule-pattern {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin-bottom: 4px;
  }

  .rule-explanation {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;
  }

  .rule-example {
    font-size: 0.8rem;
    color: var(--fg-muted-color);
    font-style: italic;
    margin-top: 4px;
    padding-left: 8px;
    border-left: 2px solid var(--fg-accent-color);
  }

  .vocab-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .vocab-word {
    font-size: 1rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .vocab-transcription {
    font-size: 0.8rem;
    color: var(--fg-muted-color);
    font-family: monospace;
  }

  .vocab-meaning {
    font-size: 0.85rem;
    color: var(--fg-primary-color);
  }

  .vocab-context {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    margin-top: 4px;
    background: rgba(0, 0, 0, 0.05);
    padding: 6px 8px;
    border-radius: 4px;
    font-style: italic;
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
