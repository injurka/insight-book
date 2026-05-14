<script setup lang="ts">
import type { UserDictItem, WordEncounter } from '~/shared/types/models'
import { computed, ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { useTts } from '~/shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
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

const localWord = ref<WordFormData>({})
const isEditing = computed(() => !!localWord.value.id)

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
    speak(localWord.value.word)
  }
}

async function createInlineDeck() {
  // eslint-disable-next-line no-alert
  const name = prompt('Название новой колоды:')

  if (name && name.trim()) {
    const lang = localWord.value.language || 'en'
    try {
      const newDeck = await dictStore.createDeck(name.trim(), lang)
      localWord.value.deckId = newDeck.id
    }
    catch {
      // error handled in store
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
            <KitBtn icon="mdi:plus" variant="outlined" color="secondary" @click="createInlineDeck">
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
          <textarea v-model="localWord.notes" class="custom-textarea" rows="2" />
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
</style>
