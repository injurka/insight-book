<script setup lang="ts">
import type { GameFeedback } from '../model/use-detective-game'
import type { LearningStage, SrsWord, WordChallenge } from '@/shared/types'
import { ref, watch } from 'vue'

interface Props {
  word: SrsWord
  challenge: WordChallenge
  stage: LearningStage
  recognitionOptions: string[]
  feedback: GameFeedback | null
  isChecking: boolean
  isSaving: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  submit: [answer: string]
  continue: []
}>()

const answer = ref('')

const stageLabels: Record<LearningStage, string> = {
  recognition: 'Узнавание',
  meaning: 'Значение',
  context: 'Контекст',
  recall: 'Воспоминание',
  production: 'Своя фраза',
}

const stageInstructions: Record<LearningStage, string> = {
  recognition: 'Ключевое слово прозвучало в показании. Найдите его.',
  meaning: 'Что означает это слово? Ответьте по-русски.',
  context: 'Вставьте слово в реплику из материалов дела.',
  recall: 'Вспомните, что сообщил свидетель, и ответьте по-английски.',
  production: 'Составьте свою английскую фразу с этим словом.',
}

const textPlaceholder: Record<LearningStage, string> = {
  recognition: '',
  meaning: 'Например: заметить',
  context: '',
  recall: 'Восстановите полную фразу на английском',
  production: 'Напишите предложение на английском',
}

const isChoiceStage = (stage: LearningStage) => stage === 'recognition' || stage === 'context'
const choiceOptions = () => props.stage === 'recognition' ? props.recognitionOptions : props.challenge.contextOptions

watch(() => [props.word.id, props.stage], () => {
  answer.value = ''
})

function submitText(): void {
  emit('submit', answer.value.trim())
}

function submitChoice(option: string): void {
  emit('submit', option)
}
</script>

<template>
  <section class="exercise-card">
    <div class="exercise-kicker">
      <span>ДОПРОС · ЭТАП {{ stageLabels[stage].toUpperCase() }}</span>
      <span class="word-counter">SRS WORD #{{ word.id }}</span>
    </div>

    <div class="exercise-word">
      <p>{{ stageInstructions[stage] }}</p>
      <h2>{{ word.word }}</h2>
      <span v-if="stage === 'meaning'" class="word-language">English → Русский</span>
    </div>

    <div class="quote-panel">
      <span class="quote-label">{{ stage === 'context' ? 'ФРАГМЕНТ ИЗ ПОКАЗАНИЙ' : 'ПОКАЗАНИЕ СВИДЕТЕЛЯ' }}</span>
      <p v-if="stage === 'context'" class="quote-text">
        {{ challenge.contextSentence }}
      </p>
      <p v-else class="quote-text">
        “{{ challenge.recognitionLine }}”
      </p>
    </div>

    <div v-if="stage === 'recall' || stage === 'production'" class="prompt-panel">
      <span class="quote-label">{{ stage === 'recall' ? 'ВОПРОС СЛЕДОВАТЕЛЯ' : 'ВАШ ОТЧЁТ' }}</span>
      <p>{{ stage === 'recall' ? challenge.recallPrompt : challenge.productionPrompt }}</p>
    </div>

    <div v-if="isChoiceStage(stage)" class="answer-options">
      <button
        v-for="option in choiceOptions()"
        :key="option"
        type="button"
        class="option-button"
        :disabled="feedback?.correct || isSaving"
        @click="submitChoice(option)"
      >
        <span class="option-marker" />
        {{ option }}
      </button>
    </div>
    <form v-else class="answer-form" @submit.prevent="submitText">
      <input
        v-if="stage !== 'production'"
        v-model="answer"
        :placeholder="textPlaceholder[stage]"
        :disabled="feedback?.correct || isChecking || isSaving"
        :aria-label="stage === 'meaning' ? 'Перевод слова' : 'Ответ по-английски'"
      >
      <textarea
        v-else
        v-model="answer"
        rows="3"
        :placeholder="textPlaceholder[stage]"
        :disabled="feedback?.correct || isChecking || isSaving"
        aria-label="Предложение на английском"
      />
      <button
        type="submit"
        class="submit-button"
        :disabled="!answer.trim() || feedback?.correct || isChecking || isSaving"
      >
        <span v-if="isChecking" class="button-spinner" />
        {{ isChecking ? 'Проверяем…' : stage === 'production' ? 'Проверить фразу' : 'Ответить' }}
      </button>
    </form>

    <div v-if="feedback" class="feedback" :class="{ correct: feedback.correct, incorrect: !feedback.correct }" role="status">
      <span class="feedback-mark">{{ feedback.correct ? '✓' : '↻' }}</span>
      <div>
        <strong>{{ feedback.correct ? 'Показание подтверждено' : 'Нужна ещё одна попытка' }}</strong>
        <p>{{ feedback.message }}</p>
        <p v-if="feedback.correct && feedback.correctedAnswer" class="correction">
          {{ feedback.correctedAnswer }}
        </p>
      </div>
    </div>

    <button
      v-if="feedback?.correct"
      type="button"
      class="continue-button"
      :disabled="isSaving"
      @click="emit('continue')"
    >
      {{ isSaving ? 'Сохраняем прогресс…' : 'Продолжить' }}
      <span aria-hidden="true">→</span>
    </button>
  </section>
</template>

<style scoped>
.exercise-card {
  padding: clamp(20px, 3vw, 34px);
  border: 1px solid rgba(206, 220, 229, 0.15);
  background: linear-gradient(145deg, rgba(38, 55, 68, 0.95), rgba(28, 43, 56, 0.97));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.18);
}
.exercise-kicker {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  color: #d8a65e;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.word-counter {
  color: #8294a1;
}
.exercise-word {
  margin: 26px 0 22px;
}
.exercise-word p {
  margin: 0 0 8px;
  color: #aebbc4;
  font-size: 12px;
  line-height: 1.6;
}
.exercise-word h2 {
  margin: 0;
  color: #f1ece2;
  font-family: Georgia, serif;
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 400;
  letter-spacing: -0.025em;
}
.word-language {
  display: inline-block;
  margin-top: 7px;
  color: #d8a65e;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.quote-panel,
.prompt-panel {
  padding: 17px;
  border-left: 2px solid #d8a65e;
  background: rgba(9, 22, 33, 0.38);
}
.quote-label {
  color: #8294a1;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.quote-text {
  margin: 9px 0 0;
  color: #e8e3d9;
  font-family: Georgia, serif;
  font-size: 17px;
  line-height: 1.55;
}
.prompt-panel {
  margin-top: 12px;
  border-left-color: #76a6a7;
}
.prompt-panel p {
  margin: 8px 0 0;
  color: #e8e3d9;
  font-size: 13px;
  line-height: 1.7;
}
.answer-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-top: 20px;
}
.option-button {
  display: flex;
  min-height: 49px;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  border: 1px solid rgba(206, 220, 229, 0.16);
  border-radius: 3px;
  background: rgba(239, 243, 245, 0.035);
  color: #d8e0e4;
  cursor: pointer;
  text-align: left;
  transition:
    border 0.15s ease,
    background 0.15s ease;
}
.option-button:hover:not(:disabled) {
  border-color: rgba(216, 166, 94, 0.7);
  background: rgba(216, 166, 94, 0.09);
}
.option-button:disabled {
  cursor: default;
  opacity: 0.78;
}
.option-marker {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border: 1px solid #8194a1;
  border-radius: 50%;
}
.answer-form {
  display: grid;
  gap: 11px;
  margin-top: 20px;
}
.answer-form input,
.answer-form textarea {
  width: 100%;
  min-height: 48px;
  padding: 13px 14px;
  border: 1px solid rgba(206, 220, 229, 0.2);
  border-radius: 3px;
  outline: none;
  background: rgba(9, 22, 33, 0.42);
  color: #f1ece2;
  font: inherit;
  font-size: 14px;
}
.answer-form textarea {
  resize: vertical;
}
.answer-form input:focus,
.answer-form textarea:focus {
  border-color: #d8a65e;
}
.answer-form input::placeholder,
.answer-form textarea::placeholder {
  color: #708390;
}
.submit-button,
.continue-button {
  display: inline-flex;
  min-height: 43px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  border: 0;
  border-radius: 3px;
  background: #d8a65e;
  color: #172431;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.submit-button:disabled,
.continue-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.feedback {
  display: grid;
  grid-template-columns: 25px 1fr;
  gap: 11px;
  margin-top: 17px;
  padding: 14px;
  border: 1px solid rgba(205, 134, 115, 0.2);
  background: rgba(205, 134, 115, 0.08);
}
.feedback.correct {
  border-color: rgba(118, 166, 167, 0.24);
  background: rgba(118, 166, 167, 0.09);
}
.feedback-mark {
  color: #e39a84;
  font-size: 17px;
}
.feedback.correct .feedback-mark {
  color: #9bc2b8;
}
.feedback strong {
  color: #e8e3d9;
  font-size: 12px;
}
.feedback p {
  margin: 5px 0 0;
  color: #afbdc4;
  font-size: 11px;
  line-height: 1.55;
}
.feedback .correction {
  color: #d9bc8e;
  font-family: Georgia, serif;
  font-size: 13px;
}
.continue-button {
  width: 100%;
  justify-content: space-between;
  margin-top: 14px;
}
.button-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(23, 36, 49, 0.25);
  border-top-color: #172431;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 520px) {
  .answer-options {
    grid-template-columns: 1fr;
  }
}
</style>
