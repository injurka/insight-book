<script setup lang="ts">
import type { WordFormData } from '../../model'
import type { SelectOption } from '~/01.shared/types/models'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTts } from '~/01.shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitToggle } from '~/02.kit/molecules/kit-toggle/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useDictionaryStore } from '../../store/dictionary.store'

const repos = useRepos()

const analysisStore = useAnalysisStore()
const dictStore = useDictionaryStore()
const { speak, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()

const localWord = ref<WordFormData>({})
const isEditing = computed(() => !!localWord.value.id)

const isDeckPromptOpen = ref(false)
const isAutoFilling = ref(false)

watch(() => analysisStore.addEditWordModalOpen, async (isOpen) => {
  if (isOpen)
    await dictStore.fetchDecks()
})

function handleSave() {
  analysisStore.saveWordToDict(localWord.value)
}

function handleDelete() {
  if (localWord.value.word)
    analysisStore.removeFromDict(localWord.value.word)
}

function playTTS() {
  if (localWord.value.word)
    speak(localWord.value.word, localWord.value.language)
}

function openCreateDeckPrompt() {
  isDeckPromptOpen.value = true
}

async function onInlineDeckSubmit(name: string) {
  if (name && name.trim()) {
    const lang = localWord.value.language || 'en'
    try {
      const newDeck = await dictStore.createDeck(name.trim(), lang)
      localWord.value.deckIds = [...(localWord.value.deckIds || []), newDeck.id]
    }
    catch {
      // Ошибка обрабатывается в сторе (показывается toast)
    }
  }
}

async function autoFillWithAI() {
  if (!localWord.value.word)
    return
  isAutoFilling.value = true
  const lang = localWord.value.language || 'en'

  try {
    const res = await repos.dictionary.autoFillWord(localWord.value.word, lang)
    const validEntries = Object.entries(res).filter(([_, v]) => v)
    Object.assign(localWord.value, Object.fromEntries(validEntries))

    toast.success(t('dictionary.fieldsAutoFilled'))
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('dictionary.aiAutoFillError'))
  }
  finally {
    isAutoFilling.value = false
  }
}

watch(() => analysisStore.wordToEdit, (newWord) => {
  if (newWord)
    localWord.value = { ...newWord }

  else
    localWord.value = {}
}, { deep: true })

const deckIdsModel = computed<(string | number)[]>({
  get: () => {
    if (!localWord.value.deckIds || localWord.value.deckIds.length === 0)
      return ['none']

    return localWord.value.deckIds
  },
  set: (val) => {
    const lastSelected = val[val.length - 1]
    if (lastSelected === 'none') {
      localWord.value.deckIds = []

      return
    }

    const numericDecks = val.filter(v => v !== 'none').map(Number)
    localWord.value.deckIds = numericDecks
  },
})

const deckOptions = computed(() => {
  if (!localWord.value.language)
    return [{ label: t('dictionary.noDeckGeneral'), value: 'none' }]
  const opts: SelectOption[] = [{ label: t('dictionary.noDeckGeneral'), value: 'none' }]
  const langDecks = dictStore.decks.filter(deckItem => deckItem.language === localWord.value.language)
  langDecks.forEach(deckItem => opts.push({ label: deckItem.name, value: deckItem.id }))

  return opts
})

const currentDifficultyOptions = computed(() => {
  const lang = localWord.value.language || 'en'
  const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default

  return [
    { label: t('dictionary.noDifficulty'), value: '' },
    ...system.map(opt => ({ label: opt.label, value: opt.value })),
  ]
})

const difficultyModel = computed({
  get: () => localWord.value.difficulty || '',
  set: (val) => { localWord.value.difficulty = val || null },
})

const previewTranslation = ref(true)
const previewGrammar = ref(true)
const previewVocabulary = ref(true)
</script>

<template>
  <KitDialog
    v-model:visible="analysisStore.addEditWordModalOpen"
    :title="isEditing ? t('dictionary.editCard') : t('dictionary.addToDict')"
    :max-width="550"
    z-index="1500"
  >
    <div v-if="localWord" class="dialog-content">
      <div class="word-preview">
        <div class="word-header">
          <div class="header-spacer" />
          <h3 class="dict-word">
            {{ localWord.word }}
          </h3>
          <div class="tts-wrapper">
            <KitTooltip :text="t('analysis.voice')">
              <KitBtn
                :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
                variant="text"
                size="sm"
                color="accent"
                :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
                @click="playTTS"
              />
            </KitTooltip>
          </div>
        </div>
        <p v-if="localWord.transcription " class="dict-transcription">
          {{ localWord.transcription }}
        </p>
      </div>

      <div v-if="localWord.contextSentence || (localWord.encounters && localWord.encounters.length)" class="encounters-box">
        <h4>{{ t('dictionary.journalContext') }}</h4>
        <div v-if="localWord.contextSentence && !localWord.encounters?.some(e => e.sentence === localWord.contextSentence)" class="encounter-item new">
          <span class="badge">{{ t('dictionary.statusNew') }}</span> {{ localWord.contextSentence }}
        </div>
        <div v-for="enc in localWord.encounters" :key="enc.id" class="encounter-item">
          <span class="source">{{ enc.book?.title || t('dictWord.fromBook') }}:</span>
          {{ enc.sentence }}
        </div>
      </div>

      <div class="form-fields">
        <div class="form-group">
          <label>{{ t('dictionary.deck') }}</label>
          <div class="deck-selector-row">
            <KitSelect
              v-model="deckIdsModel"
              :options="deckOptions"
              :placeholder="t('dictionary.selectDeck')"
              multiple
            />
            <KitBtn
              icon="mdi:plus"
              variant="outlined"
              color="secondary"
              @click="openCreateDeckPrompt"
            >
              {{ t('dictionary.new') }}
            </KitBtn>
          </div>
        </div>

        <div class="row-flex">
          <div class="form-group flex-1">
            <label>{{ t('dictionary.difficulty') }}</label>
            <KitSelect v-model="difficultyModel" :options="currentDifficultyOptions" />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('dictionary.tagsComma') }}</label>
            <KitInput v-model="localWord.tags" :placeholder="t('dictionary.tagsPlaceholder')" />
          </div>
        </div>

        <div class="form-group">
          <div class="form-group-header">
            <label>{{ t('dictionary.translationHtml') }}</label>
            <KitToggle
              v-model="previewTranslation"
              :options="[
                { value: false, icon: 'mdi:pencil', tooltip: t('dictionary.edit') || 'Редактировать' },
                { value: true, icon: 'mdi:eye', tooltip: t('dictionary.preview') || 'Предпросмотр' },
              ]"
              size="sm"
            />
          </div>
          <div v-if="previewTranslation" class="markdown-preview preview-box" v-html="localWord.translation || ''" />
          <textarea
            v-else
            v-model="localWord.translation"
            class="custom-textarea"
            rows="4"
          />
        </div>

        <div class="form-group">
          <div class="form-group-header">
            <label>{{ t('dictionary.grammar') }}</label>
            <KitToggle
              v-model="previewGrammar"
              :options="[
                { value: false, icon: 'mdi:pencil', tooltip: t('dictionary.edit') || 'Редактировать' },
                { value: true, icon: 'mdi:eye', tooltip: t('dictionary.preview') || 'Предпросмотр' },
              ]"
              size="sm"
            />
          </div>
          <div v-if="previewGrammar" class="markdown-preview preview-box" v-html="localWord.grammarNote || ''" />
          <textarea
            v-else
            v-model="localWord.grammarNote"
            class="custom-textarea"
            rows="2"
            :placeholder="t('dictionary.grammarRulesExtra')"
          />
        </div>

        <div class="form-group">
          <div class="form-group-header">
            <label>{{ t('dictionary.vocabulary') }}</label>
            <KitToggle
              v-model="previewVocabulary"
              :options="[
                { value: false, icon: 'mdi:pencil', tooltip: t('dictionary.edit') || 'Редактировать' },
                { value: true, icon: 'mdi:eye', tooltip: t('dictionary.preview') || 'Предпросмотр' },
              ]"
              size="sm"
            />
          </div>
          <div v-if="previewVocabulary" class="markdown-preview preview-box" v-html="localWord.vocabularyNote || ''" />
          <textarea
            v-else
            v-model="localWord.vocabularyNote"
            class="custom-textarea"
            rows="2"
            :placeholder="t('dictionary.relatedVocab')"
          />
        </div>

        <div class="form-group">
          <label>{{ t('dictionary.notesMnemonic') }}</label>
          <textarea v-model="localWord.notes" class="custom-textarea" rows="2" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="footer-actions">
        <KitTooltip :text="t('dictionary.autoFillAi')" placement="top">
          <KitBtn
            variant="tonal"
            color="accent"
            prepend-icon="mdi:robot-outline"
            :loading="isAutoFilling"
            @click="autoFillWithAI"
          >
            <span class="hide-mobile">{{ t('dictionary.autoFill') }}</span>
          </KitBtn>
        </KitTooltip>

        <KitTooltip v-if="isEditing" :text="t('dictionary.deleteItem')" placement="top">
          <KitBtn
            variant="outlined"
            color="secondary"
            prepend-icon="mdi:delete-outline"
            @click="handleDelete"
          >
            <span class="hide-mobile">{{ t('dictionary.deleteItem') }}</span>
          </KitBtn>
        </KitTooltip>
        <div class="spacer" />
        <KitBtn variant="tonal" @click="analysisStore.addEditWordModalOpen = false">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn color="primary" @click="handleSave">
          {{ isEditing ? t('dictionary.save') : t('library.addBook') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>

  <KitPrompt
    v-model:visible="isDeckPromptOpen"
    :title="t('dictionary.newDeckName')"
    :placeholder="t('dictionary.newDeckName')"
    :confirm-text="t('dictionary.create')"
    @submit="onInlineDeckSubmit"
  />
</template>

<style lang="scss" scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.word-preview {
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.word-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  gap: 8px;
}
.header-spacer {
  grid-column: 1;
}
.dict-word {
  grid-column: 2;
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-accent-color);
  text-align: center;
}
.tts-wrapper {
  grid-column: 3;
  justify-self: start;
}
.dict-transcription {
  margin: 4px 0 0 0;
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
}
.encounters-box {
  background: var(--bg-secondary-color);
  padding: 12px;
  border-radius: 8px;
  max-height: 150px;
  overflow-y: auto;
}
.encounters-box h4 {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.encounter-item {
  font-size: 0.9rem;
  font-style: italic;
  margin-bottom: 8px;
  padding-left: 10px;
  border-left: 3px solid var(--border-primary-color);
}
.encounter-item.new {
  border-left-color: var(--fg-accent-color);
  color: var(--fg-primary-color);
  font-weight: 500;
}
.encounter-item .badge {
  background: var(--fg-accent-color);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-style: normal;
  margin-right: 6px;
}
.encounter-item .source {
  font-weight: bold;
  font-style: normal;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  margin-right: 6px;
}
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
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
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 0.95rem;
  min-height: 44px;
  max-height: 300px;
  overflow-y: auto;
  line-height: 1.5;
}
.preview-box:empty::after {
  content: 'Нет данных для предпросмотра...';
  color: var(--fg-tertiary-color);
  font-style: italic;
}
.deck-selector-row {
  display: flex;
  gap: 8px;
  .kit-select-wrapper {
    flex-grow: 1;
  }
}
.row-flex {
  display: flex;
  gap: 16px;
}
.flex-1 {
  flex: 1;
}
.custom-textarea {
  width: 100%;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--fg-accent-color);
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
.hide-mobile {
  @include media-down(sm) {
    display: none;
  }
}
.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}
.pulse-animation {
  animation: pulse 1.2s infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
  }
}
</style>
