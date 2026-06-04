<script setup lang="ts">
import type { UserDictItem, WordEncounter } from '~/shared/types/models'
import { computed, ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput, KitPrompt, KitSelect, KitTooltip } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useDictionaryStore } from '../store/dictionary.store'

interface WordFormData extends Partial<UserDictItem> {
  contextSentence?: string
  contextBookId?: number
  encounters?: (WordEncounter & { book?: { title: string } })[]
}

const analysisStore = useAnalysisStore()
const dictStore = useDictionaryStore()
const { speak, isPlaying, isLoading } = useTts()
const toast = useToast()

const localWord = ref<WordFormData>({})
const isEditing = computed(() => !!localWord.value.id)

const isDeckPromptOpen = ref(false)
const isAutoFilling = ref(false)

watch(() => analysisStore.addEditWordModalOpen, async (isOpen) => {
  if (isOpen) {
    await dictStore.fetchDecks()
  }
})

function handleSave() {
  analysisStore.saveWordToDict(localWord.value)
}

function handleDelete() {
  if (localWord.value.word) {
    analysisStore.removeFromDict(localWord.value.word)
  }
}

function playTTS() {
  if (localWord.value.word) {
    speak(localWord.value.word, localWord.value.language)
  }
}

function openCreateDeckPrompt() {
  isDeckPromptOpen.value = true
}

async function onInlineDeckSubmit(name: string) {
  if (name && name.trim()) {
    const lang = localWord.value.language || 'en'
    try {
      const newDeck = await dictStore.createDeck(name.trim(), lang)
      localWord.value.deckId = newDeck.id
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
    const res = await api.dictionary.autoFillWord(localWord.value.word, lang)

    if (res.transcription)
      localWord.value.transcription = res.transcription
    if (res.translation)
      localWord.value.translation = res.translation
    if (res.difficulty)
      localWord.value.difficulty = res.difficulty
    if (res.tags)
      localWord.value.tags = res.tags
    if (res.grammarNote)
      localWord.value.grammarNote = res.grammarNote
    if (res.vocabularyNote)
      localWord.value.vocabularyNote = res.vocabularyNote

    toast.success('Поля успешно заполнены!')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Ошибка автозаполнения ИИ')
  }
  finally {
    isAutoFilling.value = false
  }
}

watch(() => analysisStore.wordToEdit, (newWord) => {
  if (newWord) {
    localWord.value = { ...newWord }
  }
  else {
    localWord.value = {}
  }
}, { deep: true })

const deckIdModel = computed<string | number>({
  get: () => localWord.value.deckId ?? 'none',
  set: (val) => { localWord.value.deckId = val === 'none' ? null : Number(val) },
})

const deckOptions = computed(() => {
  if (!localWord.value.language)
    return [{ label: 'Без колоды', value: 'none' }]
  const opts: any[] = [{ label: 'Без колоды (Общая)', value: 'none' }]
  const langDecks = dictStore.decks.filter(d => d.language === localWord.value.language)
  langDecks.forEach(d => opts.push({ label: d.name, value: d.id }))
  return opts
})

const currentDifficultyOptions = computed(() => {
  const lang = localWord.value.language || 'en'
  const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default

  return [
    { label: 'Не указана', value: '' },
    ...system.map(opt => ({ label: opt.label, value: opt.value })),
  ]
})

const difficultyModel = computed({
  get: () => localWord.value.difficulty || '',
  set: (val) => { localWord.value.difficulty = val || null },
})
</script>

<template>
  <KitDialog v-model:visible="analysisStore.addEditWordModalOpen" :title="isEditing ? 'Редактировать карточку' : 'Добавить в словарь'" :max-width="550">
    <div v-if="localWord" class="dialog-content">
      <div class="word-preview">
        <div class="word-header">
          <div class="header-spacer" />
          <h3 class="dict-word">
            {{ localWord.word }}
          </h3>
          <div class="tts-wrapper">
            <KitTooltip text="Озвучить">
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
        <h4>Журнал встреч (Контекст)</h4>
        <div v-if="localWord.contextSentence && !localWord.encounters?.some(e => e.sentence === localWord.contextSentence)" class="encounter-item new">
          <span class="badge">Новое</span> {{ localWord.contextSentence }}
        </div>
        <div v-for="enc in localWord.encounters" :key="enc.id" class="encounter-item">
          <span class="source">{{ enc.book?.title || 'Из книги' }}:</span>
          {{ enc.sentence }}
        </div>
      </div>

      <div class="form-fields">
        <div class="form-group">
          <label>Колода</label>
          <div class="deck-selector-row">
            <KitSelect v-model="deckIdModel" :options="deckOptions" placeholder="Выберите колоду" />
            <KitBtn icon="mdi:plus" variant="outlined" color="secondary" @click="openCreateDeckPrompt">
              Новая
            </KitBtn>
          </div>
        </div>

        <div class="row-flex">
          <div class="form-group flex-1">
            <label>Сложность</label>
            <KitSelect v-model="difficultyModel" :options="currentDifficultyOptions" />
          </div>
          <div class="form-group flex-1">
            <label>Теги (через запятую)</label>
            <KitInput v-model="localWord.tags" placeholder="глагол, фраза, JLPT N5..." />
          </div>
        </div>

        <div class="form-group">
          <label>Перевод (поддерживает HTML разметку)</label>
          <textarea v-model="localWord.translation" class="custom-textarea" rows="4" />
        </div>

        <div class="form-group">
          <label>Грамматика</label>
          <textarea v-model="localWord.grammarNote" class="custom-textarea" rows="2" placeholder="Дополнительные грамматические правила..." />
        </div>

        <div class="form-group">
          <label>Лексика</label>
          <textarea v-model="localWord.vocabularyNote" class="custom-textarea" rows="2" placeholder="Связанная лексика..." />
        </div>

        <div class="form-group">
          <label>Заметки (Мнемоника, примеры)</label>
          <textarea v-model="localWord.notes" class="custom-textarea" rows="2" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="footer-actions">
        <KitTooltip text="Автозаполнить поля с помощью ИИ" placement="top">
          <KitBtn variant="tonal" color="accent" :icon="isAutoFilling ? 'mdi:loading' : 'mdi:robot-outline'" :class="{ 'spin-animation': isAutoFilling }" :disabled="isAutoFilling" @click="autoFillWithAI">
            <span class="hide-mobile">Автозаполнение</span>
          </KitBtn>
        </KitTooltip>

        <KitBtn v-if="isEditing" variant="outlined" color="secondary" @click="handleDelete">
          Удалить
        </KitBtn>
        <div class="spacer" />
        <KitBtn variant="tonal" @click="analysisStore.addEditWordModalOpen = false">
          Отмена
        </KitBtn>
        <KitBtn color="primary" @click="handleSave">
          {{ isEditing ? 'Сохранить' : 'Добавить' }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>

  <!-- Окно создания колоды -->
  <KitPrompt
    v-model:visible="isDeckPromptOpen"
    title="Новая колода"
    placeholder="Название колоды"
    confirm-text="Создать"
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
