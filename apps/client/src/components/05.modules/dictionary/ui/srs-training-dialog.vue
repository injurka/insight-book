<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { useTts } from '~/shared/composables/use-tts'
import { api } from '~/shared/services/api.service'
import { useDictionaryStore } from '../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })
const dictStore = useDictionaryStore()
const { speak, stop } = useTts()

const currentIndex = ref(0)
const isFlipped = ref(false)
const isSubmitting = ref(false)

const currentCard = computed(() => dictStore.reviewQueue[currentIndex.value])
const isFinished = computed(() => currentIndex.value >= dictStore.reviewQueue.length)

// Вычисляем оставшиеся счетчики для шапки
const remainingQueue = computed(() => dictStore.reviewQueue.slice(currentIndex.value))
const newCount = computed(() => remainingQueue.value.filter(c => c.status === 0).length)
const reviewCount = computed(() => remainingQueue.value.filter(c => c.status > 0).length)

const currentContext = computed(() => {
  if (!currentCard.value?.encounters?.length)
    return null

  const enc = currentCard.value.encounters[0]
  const regex = new RegExp(`(${currentCard.value.word})`, 'gi')

  return enc.sentence.replace(regex, '[___]')
})

function flip() {
  isFlipped.value = true
  speak(currentCard.value.word)
}

function calculateNextInterval(grade: number): number {
  if (!currentCard.value)
    return 0
  const { repetitions, interval, easeFactor } = currentCard.value

  if (grade === 0)
    return 0 // Меньше дня

  let newEf = easeFactor
  const gradeVal = grade === 1 ? 3 : grade === 2 ? 4 : 5
  newEf = easeFactor + (0.1 - (5 - gradeVal) * (0.08 + (5 - gradeVal) * 0.02))
  newEf = Math.max(1.3, newEf)

  if (repetitions === 0)
    return 1 // 1 день
  if (repetitions === 1)
    return 6 // 6 дней
  return Math.round(interval * newEf)
}

function formatInterval(days: number): string {
  if (days === 0)
    return '< 10м'
  if (days === 1)
    return '1 дн'
  if (days < 30)
    return `${days} дн`
  return `${Math.round(days / 30)} мес`
}

// Вычисляем лейблы для кнопок заранее
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
  isSubmitting.value = true
  try {
    await api.dictionary.submitReview(currentCard.value.id, grade)
    currentIndex.value++
    isFlipped.value = false
    stop()
  }
  finally {
    isSubmitting.value = false
  }
}

watch(visible, (val) => {
  if (val) {
    currentIndex.value = 0
    isFlipped.value = false
  }
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :max-width="550"
    persistent
  >
    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          Повторение
        </h2>
        <div v-if="!isFinished" class="srs-stats">
          <span class="stat-new" title="Новые карточки">{{ newCount }}</span>
          <span class="stat-review" title="На повторении">{{ reviewCount }}</span>
        </div>
      </div>
    </template>

    <div v-if="isFinished" class="finished-state">
      <h2>🎉 Отличная работа!</h2>
      <p>Вы повторили все карточки на сегодня.</p>
      <KitBtn color="primary" @click="visible = false">
        Закрыть
      </KitBtn>
    </div>

    <div v-else-if="currentCard" class="flashcard">
      <div class="card-front">
        <!-- Контекстный режим -->
        <div v-if="currentContext" class="context-cloze">
          {{ currentContext }}
        </div>
        <!-- Классический режим -->
        <div v-else class="word-huge">
          {{ currentCard.word }}
        </div>
      </div>

      <div v-if="isFlipped" class="card-back fade-in">
        <hr>
        <div class="transcription">
          {{ currentCard.transcription }}
        </div>
        <div class="translation" v-html="currentCard.translation" />

        <div v-if="currentContext" class="original-sentence fade-in">
          <b>Контекст:</b> {{ currentCard.encounters?.[0]?.sentence }}
        </div>
      </div>

      <div class="actions">
        <KitBtn v-if="!isFlipped" color="primary" size="lg" @click="flip">
          Показать ответ
        </KitBtn>

        <div v-else-if="intervals" class="grade-buttons fade-in">
          <button class="grade-btn error" :disabled="isSubmitting" @click="gradeCard(0)">
            <span class="g-label">Снова</span>
            <span class="g-time">{{ intervals.again }}</span>
          </button>
          <button class="grade-btn warning" :disabled="isSubmitting" @click="gradeCard(1)">
            <span class="g-label">Тяжело</span>
            <span class="g-time">{{ intervals.hard }}</span>
          </button>
          <button class="grade-btn primary" :disabled="isSubmitting" @click="gradeCard(2)">
            <span class="g-label">Хорошо</span>
            <span class="g-time">{{ intervals.good }}</span>
          </button>
          <button class="grade-btn success" :disabled="isSubmitting" @click="gradeCard(3)">
            <span class="g-label">Легко</span>
            <span class="g-time">{{ intervals.easy }}</span>
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

.flashcard {
  display: flex;
  flex-direction: column;
  text-align: center;
  min-height: 350px;
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
}

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
    font-size: 2rem;
    color: var(--fg-accent-color);
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

.grade-buttons {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 16px;

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
  }
}

.fade-in {
  animation: fadeIn 0.3s;
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
