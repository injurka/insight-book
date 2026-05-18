<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KitBtn, KitCheckbox, KitDialog } from '~/components/01.kit'
import { useTts } from '~/shared/composables/use-tts'
import { api } from '~/shared/services/api.service'
import { useDictionaryStore } from '../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })
const dictStore = useDictionaryStore()
const { speak, stop, isPlaying, isLoading } = useTts()

const sessionState = ref<'setup' | 'active' | 'finished'>('setup')
const currentIndex = ref(0)
const isFlipped = ref(false)
const isSubmitting = ref(false)

// Настройки режимов (Выбор на стартовом экране)
const allowStandard = ref(true)
const allowAudio = ref(true)

// Текущий режим конкретной карточки
type TrainingMode = 'standard' | 'audio'
const currentMode = ref<TrainingMode>('standard')

const currentCard = computed(() => dictStore.reviewQueue[currentIndex.value])
const isFinished = computed(() => currentIndex.value >= dictStore.reviewQueue.length)
const remainingQueue = computed(() => dictStore.reviewQueue.slice(currentIndex.value))
const newCount = computed(() => remainingQueue.value.filter(c => c.status === 0).length)
const reviewCount = computed(() => remainingQueue.value.filter(c => c.status > 0).length)

const originalSentence = computed(() => currentCard.value?.encounters?.[0]?.sentence || '')

const currentContext = computed(() => {
  if (!originalSentence.value || !currentCard.value)
    return null

  const regex = new RegExp(`(${currentCard.value.word})`, 'gi')
  return originalSentence.value.replace(regex, '[___]')
})

function startSession() {
  if (!allowStandard.value && !allowAudio.value) {
    allowStandard.value = true // защита от дурака
  }
  sessionState.value = 'active'
  initCard()
}

function initCard() {
  isFlipped.value = false

  if (!currentCard.value) {
    if (isFinished.value)
      sessionState.value = 'finished'
    return
  }

  // Доступные режимы зависят от контента и пользовательских настроек
  const availableModes: TrainingMode[] = []
  if (allowStandard.value)
    availableModes.push('standard')
  if (allowAudio.value && currentCard.value.word)
    availableModes.push('audio')

  if (availableModes.length === 0)
    availableModes.push('standard') // fallback

  // Случайный выбор режима из разрешенных
  currentMode.value = availableModes[Math.floor(Math.random() * availableModes.length)]

  if (currentMode.value === 'audio') {
    // Включаем звук с небольшой задержкой
    setTimeout(() => {
      if (currentCard.value?.word) {
        speak(currentCard.value.word)
      }
    }, 300)
  }
}

function flip() {
  isFlipped.value = true
  if (currentMode.value !== 'audio' && currentCard.value?.word) {
    speak(currentCard.value.word)
  }
}

function calculateNextInterval(grade: number): number {
  if (!currentCard.value)
    return 0

  const { repetitions, interval, easeFactor } = currentCard.value

  // Дублируем серверную логику шагов для отображения
  if (grade === 0) {
    return 1 / 1440 // 1 минута
  }
  else if (grade === 1) {
    if (repetitions === 0 || interval < 1)
      return 10 / 1440 // 10 минут
    return interval * 1.2
  }
  else if (grade === 2) {
    if (repetitions === 0 || interval < 1)
      return 1 // 1 день
    return interval * easeFactor
  }
  else if (grade === 3) {
    if (repetitions === 0 || interval < 1)
      return 4 // 4 дня
    return interval * easeFactor * 1.3
  }

  return interval
}

function formatInterval(days: number): string {
  const minutes = Math.round(days * 1440)
  if (minutes < 60)
    return `${minutes} м`

  const hours = Math.round(days * 24)
  if (hours < 24)
    return `${hours} ч`

  if (days < 30)
    return `${Math.round(days)} дн`
  if (days < 365)
    return `${Math.round(days / 30)} мес`

  return `${Math.round(days / 365)} г`
}

const intervals = computed(() => {
  if (!isFlipped.value || !currentCard.value)
    return null
  return {
    again: formatInterval(calculateNextInterval(0)),
    hard: formatInterval(calculateNextInterval(1)),
    good: formatInterval(calculateNextInterval(2)),
    easy: formatInterval(calculateNextInterval(3)),
  }
})

async function gradeCard(grade: number) {
  if (isSubmitting.value || !currentCard.value)
    return

  if (dictStore.trainingMode === 'random') {
    // В режиме случайной разминки мы не отправляем данные на сервер
    currentIndex.value++
    stop()
    return
  }

  // Режим SRS:
  isSubmitting.value = true
  try {
    const cardRef = currentCard.value
    await api.dictionary.submitReview(cardRef.id, grade)

    if (grade === 0) {
      // Если нажали "Снова", добавляем карточку в конец очереди
      dictStore.reviewQueue.push(cardRef)
    }

    currentIndex.value++
    stop()
  }
  finally {
    isSubmitting.value = false
  }
}

watch(visible, (val) => {
  if (val) {
    sessionState.value = 'setup'
    currentIndex.value = 0
  }
  else {
    stop()
  }
})

watch(currentIndex, () => {
  if (!isFinished.value && sessionState.value === 'active') {
    initCard()
  }
  else if (isFinished.value) {
    sessionState.value = 'finished'
  }
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :max-width="600"
    persistent
  >
    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          <template v-if="sessionState === 'setup'">
            Настройки тренировки
          </template>
          <template v-else>
            {{ dictStore.trainingMode === 'srs' ? 'Повторение (SRS)' : 'Случайная тренировка' }}
            <span v-if="!isFinished" class="mode-badge">
              ({{ currentMode === 'audio' ? 'Аудирование' : 'Чтение' }})
            </span>
          </template>
        </h2>

        <div v-if="sessionState === 'active' && !isFinished && dictStore.trainingMode === 'srs'" class="srs-stats">
          <span class="stat-new" title="Новые карточки">{{ newCount }}</span>
          <span class="stat-review" title="На повторении">{{ reviewCount }}</span>
        </div>
        <div v-else-if="sessionState === 'active' && !isFinished" class="srs-stats">
          <span class="stat-review" title="Осталось карточек">{{ remainingQueue.length }}</span>
        </div>
      </div>
    </template>

    <!-- ЭКРАН НАСТРОЙКИ (SETUP) -->
    <div v-if="sessionState === 'setup'" class="setup-state">
      <p class="setup-desc">
        Выберите режимы, которые будут использоваться при тренировке.
      </p>

      <div class="settings-group">
        <div class="checkbox-row">
          <KitCheckbox v-model="allowStandard" label="Чтение (классические карточки)" />
          <span class="checkbox-hint">Показ слова или предложения с пропуском. Вы вспоминаете перевод.</span>
        </div>
        <div class="checkbox-row">
          <KitCheckbox v-model="allowAudio" label="Аудирование (Восприятие на слух)" />
          <span class="checkbox-hint">Слово произносится ИИ. Вы должны вспомнить, что это было.</span>
        </div>
      </div>

      <div class="setup-actions">
        <KitBtn variant="tonal" size="sm" @click="visible = false">
          Отмена
        </KitBtn>
        <KitBtn color="primary" size="sm" @click="startSession">
          Начать
        </KitBtn>
      </div>
    </div>

    <!-- ЭКРАН ЗАВЕРШЕНИЯ -->
    <div v-else-if="sessionState === 'finished'" class="finished-state">
      <h2>🎉 Отличная работа!</h2>
      <p v-if="dictStore.trainingMode === 'srs'">
        Вы повторили все карточки на сегодня.
      </p>
      <p v-else>
        Разминка завершена.
      </p>
      <KitBtn color="primary" @click="visible = false">
        Закрыть
      </KitBtn>
    </div>

    <!-- АКТИВНАЯ ТРЕНИРОВКА -->
    <div v-else-if="currentCard" class="flashcard">
      <div class="card-front">
        <!-- РЕЖИМ: АУДИРОВАНИЕ -->
        <div v-if="currentMode === 'audio'" class="audio-mode">
          <KitBtn
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            size="lg"
            color="accent"
            @click="speak(currentCard.word)"
          />
          <p>Послушайте и вспомните слово</p>
        </div>

        <!-- РЕЖИМ: СТАНДАРТ -->
        <div v-else class="standard-mode">
          <!-- Контекстный режим -->
          <div v-if="currentContext" class="context-cloze">
            {{ currentContext }}
          </div>
          <!-- Классический режим -->
          <div v-else class="word-huge">
            {{ currentCard.word }}
          </div>
        </div>
      </div>

      <div v-if="isFlipped" class="card-back fade-in">
        <hr>

        <!-- Для аудио режима показываем слово крупно -->
        <div v-if="currentMode === 'audio'" class="word-huge back-word fade-in">
          {{ currentCard.word }}
        </div>

        <!-- Для остальных даем кнопку аудио, чтобы не дублировать огромный текст -->
        <div v-else class="back-action fade-in" style="margin-bottom: 12px">
          <KitBtn
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            variant="tonal"
            color="accent"
            size="sm"
            @click="speak(currentCard.word)"
          >
            Прослушать слово
          </KitBtn>
        </div>

        <div class="transcription">
          {{ currentCard.transcription }}
        </div>

        <div class="translation" v-html="currentCard.translation" />

        <div v-if="originalSentence" class="original-sentence fade-in">
          <b>Контекст:</b> {{ originalSentence }}
        </div>
      </div>

      <div class="actions">
        <KitBtn v-if="!isFlipped" color="primary" size="lg" @click="flip">
          Показать ответ
        </KitBtn>

        <div v-else-if="intervals" class="grade-buttons fade-in">
          <button class="grade-btn error" :disabled="isSubmitting" @click="gradeCard(0)">
            <span class="g-label">Снова</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.again }}</span>
          </button>
          <button class="grade-btn warning" :disabled="isSubmitting" @click="gradeCard(1)">
            <span class="g-label">Тяжело</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.hard }}</span>
          </button>
          <button class="grade-btn primary" :disabled="isSubmitting" @click="gradeCard(2)">
            <span class="g-label">Хорошо</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.good }}</span>
          </button>
          <button class="grade-btn success" :disabled="isSubmitting" @click="gradeCard(3)">
            <span class="g-label">Легко</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.easy }}</span>
          </button>
        </div>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.srs-header {
  display: flex;
  align-items: center;
  gap: 16px;

  .dialog-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;

    .mode-badge {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }
  }

  .srs-stats {
    display: flex;
    gap: 8px;
    font-weight: 600;
    font-size: 0.9rem;

    .stat-new {
      color: var(--fg-info-color);
      border-bottom: 2px solid currentColor;
      padding-bottom: 2px;
    }
    .stat-review {
      color: var(--fg-success-color);
      border-bottom: 2px solid currentColor;
      padding-bottom: 2px;
    }
  }
}

.setup-state {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .setup-desc {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
  }

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);

    .checkbox-row {
      display: flex;
      flex-direction: column;
      gap: 4px;

      :deep(.kit-checkbox) {
        .checkbox-label {
          font-weight: 500;
          font-size: 1rem;
        }
      }

      .checkbox-hint {
        padding-left: 26px;
        font-size: 0.85rem;
        color: var(--fg-muted-color);
      }
    }
  }

  .setup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

.flashcard {
  display: flex;
  flex-direction: column;
  text-align: center;
  min-height: 400px;
  height: 100%;
}

.card-back {
  margin-bottom: 16px;
}

.card-front {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

/* --- Стили режимов --- */

.audio-mode {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  p {
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.standard-mode {
  width: 100%;
}

/* ------------------- */

.context-cloze {
  font-size: 1.4rem;
  line-height: 1.6;
  font-style: italic;
  padding: 20px;
  color: var(--fg-primary-color);
}

.word-huge {
  font-size: 3rem;
  font-weight: bold;
  color: var(--fg-primary-color);

  &.back-word {
    font-size: 2.2rem;
    color: var(--fg-accent-color);
    margin-bottom: 8px;
  }
}

.transcription {
  color: var(--fg-secondary-color);
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.translation {
  font-size: 1.2rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.original-sentence {
  margin-top: 24px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  font-style: italic;
  padding: 12px;
  background: var(--bg-secondary-color);
  border-radius: 8px;
  text-align: left;
}

.actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 16px;
}

.grade-buttons {
  display: flex;
  gap: 12px;
  justify-content: space-between;

  .grade-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 4px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: var(--bg-secondary-color);
    cursor: pointer;
    transition: all 0.2s;

    .g-label {
      font-weight: 600;
      font-size: 0.95rem;
    }
    .g-time {
      font-size: 0.75rem;
      opacity: 0.8;
    }

    &.error {
      color: var(--fg-error-color);
      border-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.3);
    }
    &.warning {
      color: var(--fg-warning-color);
      border-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.3);
    }
    &.primary {
      color: var(--fg-accent-color);
      border-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.3);
    }
    &.success {
      color: var(--fg-success-color);
      border-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.3);
    }

    &:hover:not(:disabled) {
      background: var(--bg-tertiary-color);
      transform: translateY(-2px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.finished-state {
  text-align: center;
  padding: 40px 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  h2 {
    margin-bottom: 12px;
  }
  p {
    margin-bottom: 24px;
    color: var(--fg-secondary-color);
  }
}
</style>
