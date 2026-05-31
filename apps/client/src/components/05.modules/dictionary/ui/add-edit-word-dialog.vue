<script setup lang="ts">
import type { UserDictItem, WordEncounter } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput, KitPrompt, KitSelect, KitSkeleton, KitTooltip } from '~/components/01.kit'
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

// Состояние для окна создания колоды
const isDeckPromptOpen = ref(false)

// AI Модалка
const isAiModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<any>(null)

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

async function fetchAiExamples() {
  if (!localWord.value.word)
    return
  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    const res = await api.dictionary.generateExamples(localWord.value.word, localWord.value.language || 'en')
    aiData.value = res
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка генерации примеров')
    isAiModalOpen.value = false
  }
  finally {
    isAiLoading.value = false
  }
}

function applyAiToNotes() {
  if (!aiData.value)
    return
  const d = aiData.value
  let text = ``

  if (d.mnemonics)
    text += `💡 Мнемоника:\n${d.mnemonics}\n\n`
  if (d.grammar_note)
    text += `📚 Грамматика:\n${d.grammar_note}\n\n`

  if (d.examples && d.examples.length) {
    text += `🎯 Примеры:\n`
    d.examples.forEach((ex: any) => {
      text += `- ${ex.original} (${ex.transcription})\n  ${ex.translation}\n  *Дословно: ${ex.literal_translation}*\n`
    })
    text += `\n`
  }

  if (d.collocations && d.collocations.length) {
    text += `🔗 Словосочетания:\n`
    d.collocations.forEach((col: any) => {
      text += `- ${col.original} (${col.transcription}) — ${col.translation}\n`
    })
    text += `\n`
  }

  if (d.relations) {
    if (d.relations.synonyms && d.relations.synonyms.length) {
      text += `Синонимы: ${d.relations.synonyms.join(', ')}\n`
    }
    if (d.relations.antonyms && d.relations.antonyms.length) {
      text += `Антонимы: ${d.relations.antonyms.join(', ')}\n`
    }
  }

  const existing = localWord.value.notes ? `${localWord.value.notes.trim()}\n\n` : ''
  localWord.value.notes = existing + text.trim()
  isAiModalOpen.value = false
  toast.success('Примеры добавлены в заметки!')
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

// --- ЛОГИКА ДЛЯ СЛОЖНОСТИ ---
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
          <h3 class="dict-word">
            {{ localWord.word }}
          </h3>
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
          <KitTooltip text="Сгенерировать примеры (ИИ)">
            <KitBtn
              icon="mdi:robot-outline"
              variant="text"
              size="sm"
              color="primary"
              :disabled="!localWord.word"
              @click="fetchAiExamples"
            />
          </KitTooltip>
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
            <KitInput v-model="localWord.tags" placeholder="фраза, глагол..." />
          </div>
        </div>

        <div class="form-group">
          <label>Перевод (поддерживает HTML разметку)</label>
          <textarea v-model="localWord.translation" class="custom-textarea" rows="4" />
        </div>

        <div class="form-group">
          <label>Заметки</label>
          <textarea v-model="localWord.notes" class="custom-textarea" rows="4" placeholder="Тут можно сохранить примеры предложений и мнемоники" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="footer-actions">
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

  <!-- Дочернее окно AI разбора -->
  <KitDialog v-model:visible="isAiModalOpen" title="AI Примеры и анализ" :max-width="650">
    <div v-if="isAiLoading" class="ai-loading">
      <KitSkeleton width="100%" height="24px" class="mb-3" />
      <KitSkeleton width="80%" height="24px" class="mb-3" />
      <KitSkeleton width="100%" height="150px" />
      <p style="text-align: center; color: var(--fg-secondary-color); margin-top: 12px; font-style: italic;">
        Подбираем лучшие примеры...
      </p>
    </div>

    <div v-else-if="aiData" class="ai-results">
      <div v-if="aiData.mnemonics" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:lightbulb-on-outline" /> Мнемоника
        </div>
        <p class="ai-text">
          {{ aiData.mnemonics }}
        </p>
      </div>

      <div v-if="aiData.grammar_note" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:book-open-variant" /> Грамматика
        </div>
        <p class="ai-text">
          {{ aiData.grammar_note }}
        </p>
      </div>

      <div v-if="aiData.examples && aiData.examples.length" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:format-list-bulleted" /> Примеры
        </div>
        <ul class="ai-list">
          <li v-for="(ex, i) in aiData.examples" :key="i">
            <span class="ex-type">{{ ex.type }}</span>
            <div class="ex-orig">
              {{ ex.original }}
            </div>
            <div class="ex-transc">
              {{ ex.transcription }}
            </div>
            <div class="ex-transl">
              {{ ex.translation }}
            </div>
            <div class="ex-literal">
              Дословно: {{ ex.literal_translation }}
            </div>
          </li>
        </ul>
      </div>

      <div v-if="aiData.collocations && aiData.collocations.length" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:link-variant" /> Словосочетания
        </div>
        <ul class="ai-list">
          <li v-for="(col, i) in aiData.collocations" :key="i">
            <b>{{ col.original }}</b> ({{ col.transcription }}) — {{ col.translation }}
          </li>
        </ul>
      </div>

      <div v-if="aiData.relations" class="ai-section relations-section">
        <div v-if="aiData.relations.synonyms?.length">
          <b>Синонимы:</b> {{ aiData.relations.synonyms.join(', ') }}
        </div>
        <div v-if="aiData.relations.antonyms?.length">
          <b>Антонимы:</b> {{ aiData.relations.antonyms.join(', ') }}
        </div>
      </div>
    </div>

    <template #footer>
      <KitBtn variant="tonal" @click="isAiModalOpen = false">
        Закрыть
      </KitBtn>
      <KitBtn color="primary" icon="mdi:pencil-plus" :disabled="!aiData" @click="applyAiToNotes">
        Добавить в Заметки
      </KitBtn>
    </template>
  </KitDialog>
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.dict-word {
  font-size: 1.8rem;
  font-weight: 600;
  margin: 0;
  color: var(--fg-accent-color);
}
.dict-transcription {
  margin: 0;
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
.spin-animation {
  animation: spin 1s linear infinite;
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

/* AI Results styling */
.ai-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}
.ai-section {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  padding: 12px;
}
.ai-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ai-text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
  line-height: 1.5;
}
.ai-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  li {
    border-bottom: 1px dashed var(--border-primary-color);
    padding-bottom: 12px;
    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  .ex-type {
    display: inline-block;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
    margin-bottom: 4px;
  }
  .ex-orig {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
  .ex-transc {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin-bottom: 4px;
  }
  .ex-transl {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
  }
  .ex-literal {
    font-size: 0.85rem;
    color: var(--fg-muted-color);
    font-style: italic;
    margin-top: 4px;
  }
}
.relations-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  b {
    color: var(--fg-primary-color);
  }
}
.mb-3 {
  margin-bottom: 12px;
}
</style>
