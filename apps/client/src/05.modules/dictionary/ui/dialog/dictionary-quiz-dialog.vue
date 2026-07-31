<script setup lang="ts">
import type { LevelNode, Question, QuizState } from '../../model'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'

import { KitBtn, KitDialog, KitTabs } from '~/02.kit'

interface Props {
  initialLang?: string
  initialLevel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  success: []
}>()

const repos = useRepos()

const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()

const currentState = ref<QuizState>('select_level')

const selectedLang = ref('zh')
const selectedLevel = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const isFullscreen = ref(false)

const tabItems = computed(() => {
  const items = [
    { id: 'zh', label: `${t('library.langZh')} (ZH)` },
    { id: 'ja', label: `${t('library.langJa')} (JA)` },
    { id: 'en', label: `${t('library.langEn')} (EN)` },
    { id: 'ru', label: `${t('library.langRu')} (RU)` },
  ]
  return items.filter(item => item.id !== locale.value)
})

// Game state

const levelsByLang = ref<Record<string, LevelNode[]>>({
  zh: [],
  ja: [],
  en: [],
  ru: [],
})
const questions = ref<Question[]>([])
const currentQuestionIndex = ref(0)
const lives = ref(3)
const correctCount = ref(0)

// Reorder specific state
const reorderSelected = ref<string[]>([])
const reorderRemaining = ref<string[]>([])

// Answering state
const selectedOption = ref<string | null>(null)
const isChecked = ref(false)
const isCorrectAnswer = ref(false)

// Result state
const testResult = ref<{
  success: boolean
  score: number
  starsEarned: number
  isPassed: boolean
  nextLevelUnlocked: boolean
  nextLevelValue: string | null
} | null>(null)

const LEVEL_ORDER: Record<string, string[]> = {
  zh: ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  ja: ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1'],
  en: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  ru: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  default: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
}

const activeLevelValue = computed(() => {
  const currentLevels = levelsByLang.value[selectedLang.value] || []
  const active = currentLevels.find(lvl => lvl.unlocked && lvl.bestScore < 80)
  if (!active) {
    const unlocked = currentLevels.filter(lvl => lvl.unlocked)
    return unlocked[unlocked.length - 1]?.levelValue || ''
  }
  return active.levelValue
})

// Initialize levels map
async function loadLevels() {
  if (levelsByLang.value[selectedLang.value]?.length > 0)
    return

  isLoading.value = true
  errorMessage.value = ''

  const lang = selectedLang.value
  try {
    const res = await repos.quiz.getLevels(lang)
    const order = LEVEL_ORDER[lang] || LEVEL_ORDER.default
    levelsByLang.value[lang] = res.sort((a: any, b: any) => {
      const idxA = order.indexOf(a.levelValue)
      const idxB = order.indexOf(b.levelValue)
      return idxA - idxB
    })
  }
  catch (e) {
    errorMessage.value = 'Не удалось загрузить карту уровней'
    console.error(e)
  }
  finally {
    isLoading.value = false
  }
}

// Watchers
watch(visible, (isOpen) => {
  if (isOpen) {
    currentState.value = 'select_level'
    levelsByLang.value = { zh: [], ja: [], en: [], ru: [] }
    if (props.initialLang) {
      selectedLang.value = props.initialLang
    }
    else {
      if (!tabItems.value.some(t => t.id === selectedLang.value)) {
        selectedLang.value = tabItems.value[0]?.id || 'en'
      }
    }
    if (props.initialLevel) {
      selectedLevel.value = props.initialLevel
      startQuizFlow(props.initialLevel)
    }
    else {
      loadLevels()
    }
  }
})

watch(selectedLang, () => {
  if (visible.value && !props.initialLevel) {
    loadLevels()
  }
})

// Start Quiz Flow
async function startQuizFlow(levelVal: string) {
  selectedLevel.value = levelVal
  currentState.value = 'loading'
  errorMessage.value = ''

  try {
    const res = await repos.quiz.generate(selectedLang.value, levelVal)
    questions.value = res.questions.map((q: any) => ({ ...q }))

    // Reset test variables
    currentQuestionIndex.value = 0
    lives.value = 3
    correctCount.value = 0
    currentState.value = 'testing'

    setupCurrentQuestion()
  }
  catch (e: any) {
    currentState.value = 'select_level'
    const msg = e.message || ''
    if (msg === 'quiz_level_locked') {
      errorMessage.value = t('dictionary.quiz.errors.levelLocked')
    }
    else if (msg.startsWith('quiz_deck_not_found:')) {
      const parts = msg.split(':')
      errorMessage.value = t('dictionary.quiz.errors.deckNotFound', { level: parts[1], lang: parts[2] })
    }
    else if (msg === 'quiz_no_words') {
      errorMessage.value = t('dictionary.quiz.errors.noWords')
    }
    else {
      errorMessage.value = msg || 'Ошибка генерации вопросов. Пожалуйста, попробуйте еще раз.'
    }
    loadLevels()
  }
}

const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])

function setupCurrentQuestion() {
  selectedOption.value = null
  isChecked.value = false
  isCorrectAnswer.value = false

  if (currentQuestion.value?.type === 'reorder') {
    reorderSelected.value = []
    // Shuffled copy of options
    reorderRemaining.value = [...currentQuestion.value.options]
  }
}

// Action for clicking a choice
function selectOption(opt: string) {
  if (isChecked.value)
    return
  selectedOption.value = opt
}

// Click on word in reorder
function clickRemainingWord(idx: number) {
  if (isChecked.value)
    return
  const word = reorderRemaining.value[idx]
  reorderSelected.value.push(word)
  reorderRemaining.value.splice(idx, 1)
}

function clickSelectedWord(idx: number) {
  if (isChecked.value)
    return
  const word = reorderSelected.value[idx]
  reorderRemaining.value.push(word)
  reorderSelected.value.splice(idx, 1)
}

// Validate current answer
function checkAnswer() {
  if (isChecked.value)
    return

  const q = currentQuestion.value
  let answerStr = ''

  if (q.type === 'reorder') {
    const needsSpaces = !['zh', 'ja'].includes(selectedLang.value)
    answerStr = reorderSelected.value.join(needsSpaces ? ' ' : '')
  }
  else {
    answerStr = selectedOption.value || ''
  }

  if (!answerStr && q.type !== 'reorder')
    return

  isChecked.value = true
  q.userAnswer = answerStr

  let isCorrect = false
  if (q.type === 'reorder') {
    const normalize = (str: string) => str.replace(/[\s.,!?;:()¿¡"']/g, '').toLowerCase()
    isCorrect = normalize(answerStr) === normalize(q.correctAnswer)
  }
  else {
    isCorrect = answerStr === q.correctAnswer
  }

  isCorrectAnswer.value = isCorrect
  q.isCorrect = isCorrect

  if (isCorrect) {
    correctCount.value++
  }
  else {
    lives.value--
  }
}

// Proceed to next question
async function nextQuestion() {
  if (lives.value <= 0) {
    finishQuiz()
    return
  }

  if (currentQuestionIndex.value + 1 < questions.value.length) {
    currentQuestionIndex.value++
    setupCurrentQuestion()
  }
  else {
    finishQuiz()
  }
}

// Finish and Submit
async function finishQuiz() {
  currentState.value = 'loading'

  const totalQ = questions.value.length
  const scorePct = Math.round((correctCount.value / totalQ) * 100)

  try {
    const res = await repos.quiz.submit(selectedLang.value, selectedLevel.value, scorePct)
    testResult.value = res
    currentState.value = 'summary'
    emit('success')
  }
  catch (e) {
    currentState.value = 'select_level'
    errorMessage.value = 'Ошибка отправки результатов'
    console.error(e)
  }
}

// Progress helper
const quizProgressPercent = computed(() => {
  if (questions.value.length === 0)
    return 0
  return Math.round((currentQuestionIndex.value / questions.value.length) * 100)
})

function exitQuiz() {
  visible.value = false
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('dictionary.quiz.title', { lang: selectedLang.toUpperCase() })"
    icon="mdi:trophy-outline"
    :max-width="currentState === 'testing' ? 680 : 780"
    :minimizable="false"
    :fullscreen="isFullscreen"
    :persistent="true"
  >
    <template #header-actions>
      <button
        class="dialog-icon-btn minimize-button"
        :title="isFullscreen ? 'Свернуть' : 'Развернуть на весь экран'"
        @click="isFullscreen = !isFullscreen"
      >
        <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
      </button>
    </template>
    <!-- 1. ROADMAP VIEW -->
    <div v-if="currentState === 'select_level'" class="quiz-roadmap-view">
      <div v-if="errorMessage" class="error-banner">
        <Icon icon="mdi:alert-circle-outline" /> {{ errorMessage }}
      </div>

      <KitTabs v-model="selectedLang" :items="tabItems" :cache="false">
        <template v-for="tab in tabItems" :key="tab.id" #[tab.id]>
          <div class="roadmap-grid">
            <template v-if="isLoading && !levelsByLang[tab.id]?.length">
              <div v-for="i in (LEVEL_ORDER[tab.id]?.length || 6)" :key="i" class="roadmap-node skeleton">
                <div class="node-header">
                  <span class="skeleton-text level" />
                  <span class="skeleton-text stars" />
                </div>
                <div class="node-body">
                  <span class="skeleton-text score" />
                </div>
                <div class="node-footer">
                  <span class="skeleton-btn" />
                </div>
              </div>
            </template>
            <template v-else>
              <div
                v-for="lvl in levelsByLang[tab.id]"
                :key="lvl.levelValue"
                class="roadmap-node"
                :class="{ 'locked': !lvl.unlocked, 'passed': lvl.bestScore >= 80, 'is-active-target': lvl.levelValue === activeLevelValue }"
              >
                <div class="node-header">
                  <span class="node-level">{{ lvl.levelValue }}</span>
                  <div class="node-stars">
                    <Icon
                      v-for="n in 3"
                      :key="n"
                      :icon="n <= lvl.stars ? 'mdi:star' : 'mdi:star-outline'"
                      :class="{ active: n <= lvl.stars }"
                    />
                  </div>
                </div>

                <div class="node-body">
                  <span v-if="lvl.bestScore > 0" class="best-score">{{ t('dictionary.quiz.bestScore', { score: lvl.bestScore }) }}</span>
                  <span v-else class="best-score">{{ t('dictionary.quiz.notPassed') }}</span>
                </div>

                <div class="node-footer">
                  <KitBtn
                    v-if="lvl.unlocked"
                    icon="mdi:play"
                    color="primary"
                    variant="tonal"
                    class="start-node-btn"
                    @click="startQuizFlow(lvl.levelValue)"
                  >
                    {{ lvl.bestScore >= 80 ? t('dictionary.quiz.repeat') : t('dictionary.quiz.start') }}
                  </KitBtn>
                  <div v-else class="locked-label">
                    <Icon icon="mdi:lock" /> {{ t('dictionary.quiz.locked') }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
      </KitTabs>
    </div>

    <!-- 2. LOADING STATE -->
    <div v-else-if="currentState === 'loading'" class="quiz-loading-view">
      <div class="ai-loader-box">
        <div class="loader-spinner" />
        <p class="loader-text">
          {{ t('dictionary.quiz.loadingTitle') }}
        </p>
        <span class="loader-subtext">{{ t('dictionary.quiz.loadingDesc', { level: selectedLevel }) }}</span>
      </div>
    </div>

    <!-- 3. TESTING STATE -->
    <div v-else-if="currentState === 'testing' && currentQuestion" class="quiz-testing-view">
      <!-- Header Info -->
      <div class="test-header">
        <div class="progress-container">
          <span class="progress-fraction">{{ t('dictionary.quiz.questionCount', { current: currentQuestionIndex + 1, total: questions.length }) }}</span>
          <div class="bar-bg">
            <div class="bar-fill" :style="{ width: `${quizProgressPercent}%` }" />
          </div>
        </div>

        <div class="hearts-container">
          <Icon
            v-for="h in 3"
            :key="h"
            :icon="h <= lives ? 'mdi:heart' : 'mdi:heart-broken'"
            :class="{ active: h <= lives, broken: h > lives }"
          />
        </div>
      </div>

      <!-- Question Box -->
      <div class="question-container-card">
        <span class="question-tag">{{ currentQuestion.type === 'choice' ? 'Лексика' : currentQuestion.type === 'cloze' ? 'Грамматика' : 'Перевод и Порядок слов' }}</span>

        <h3 v-if="currentQuestion.type !== 'reorder'" class="question-title">
          {{ currentQuestion.question }}
        </h3>
        <div v-else class="reorder-translation-prompt">
          <span class="prompt-label">{{ t('dictionary.quiz.verifyTranslate') }}</span>
          <p class="prompt-text">
            « {{ currentQuestion.question }} »
          </p>
        </div>

        <!-- Cloze & Choice Answers -->
        <div v-if="currentQuestion.type !== 'reorder'" class="options-grid">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt"
            class="option-btn"
            :class="{
              selected: selectedOption === opt,
              correct: isChecked && opt === currentQuestion.correctAnswer,
              wrong: isChecked && selectedOption === opt && opt !== currentQuestion.correctAnswer,
            }"
            :disabled="isChecked"
            @click="selectOption(opt)"
          >
            {{ opt }}
            <Icon
              v-if="isChecked && opt === currentQuestion.correctAnswer"
              icon="mdi:check-circle"
              class="validation-icon correct-icon"
            />
            <Icon
              v-if="isChecked && selectedOption === opt && opt !== currentQuestion.correctAnswer"
              icon="mdi:close-circle"
              class="validation-icon wrong-icon"
            />
          </button>
        </div>

        <!-- Reorder Answer Box -->
        <div v-else class="reorder-interface">
          <!-- User assembled sentence -->
          <div class="reorder-assembled-zone" :class="{ empty: reorderSelected.length === 0, checked: isChecked, correct: isChecked && isCorrectAnswer, wrong: isChecked && !isCorrectAnswer }">
            <span v-if="reorderSelected.length === 0" class="placeholder">{{ t('dictionary.quiz.reorderPlaceholder') }}</span>
            <button
              v-for="(w, idx) in reorderSelected"
              :key="idx"
              class="word-token selected-token"
              :disabled="isChecked"
              @click="clickSelectedWord(idx)"
            >
              {{ w }}
            </button>
          </div>

          <!-- Feedback explanation for reorder -->
          <div v-if="isChecked" class="reorder-correct-answer">
            <span class="correct-label">{{ t('dictionary.quiz.correctAnswer') }}</span>
            <p class="correct-text">
              {{ currentQuestion.correctAnswer }}
            </p>
          </div>

          <!-- Shuffled remaining words -->
          <div v-if="!isChecked" class="reorder-words-pool">
            <button
              v-for="(w, idx) in reorderRemaining"
              :key="idx"
              class="word-token pool-token"
              @click="clickRemainingWord(idx)"
            >
              {{ w }}
            </button>
          </div>
        </div>
      </div>

      <!-- Explanation Banner -->
      <div v-if="isChecked" class="explanation-box" :class="{ correct: isCorrectAnswer, wrong: !isCorrectAnswer }">
        <div class="exp-title">
          <Icon :icon="isCorrectAnswer ? 'mdi:emoticon-happy-outline' : 'mdi:alert-circle-outline'" />
          <span>{{ isCorrectAnswer ? t('dictionary.quiz.checkCorrect') : t('dictionary.quiz.checkIncorrect') }}</span>
        </div>
        <p class="exp-text">
          {{ currentQuestion.explanation }}
        </p>
      </div>
    </div>

    <!-- 4. SUMMARY VIEW -->
    <div v-else-if="currentState === 'summary' && testResult" class="quiz-summary-view">
      <!-- Success/Fail Hero Banner -->
      <div class="summary-hero" :class="{ success: testResult.isPassed, fail: !testResult.isPassed }">
        <div class="hero-graphics">
          <Icon :icon="testResult.isPassed ? 'mdi:trophy-award' : 'mdi:emoticon-sad-outline'" class="hero-icon" />
        </div>

        <h2 class="hero-title">
          {{ testResult.isPassed ? t('dictionary.quiz.summaryPassed') : t('dictionary.quiz.summaryFailed') }}
        </h2>
        <p class="hero-sub">
          {{ testResult.isPassed ? t('dictionary.quiz.summaryPassedDesc', { score: testResult.score }) : t('dictionary.quiz.summaryFailedDesc', { score: testResult.score }) }}
        </p>

        <!-- Stars display -->
        <div v-if="testResult.isPassed" class="summary-stars">
          <Icon
            v-for="n in 3"
            :key="n"
            icon="mdi:star"
            :class="{ active: n <= testResult.starsEarned }"
          />
        </div>
      </div>

      <!-- Next Level Promo -->
      <div v-if="testResult.nextLevelUnlocked" class="next-level-unlocked-banner">
        <Icon icon="mdi:lock-open-variant-outline" class="unlock-icon" />
        <div>
          <h4>{{ t('dictionary.quiz.nextLevelUnlocked') }}</h4>
          <p>{{ t('dictionary.quiz.nextLevelDesc', { level: testResult.nextLevelValue }) }}</p>
        </div>
      </div>

      <!-- Review of mistakes -->
      <h3 class="review-title">
        {{ t('dictionary.quiz.detailReview') }}
      </h3>
      <div class="review-questions-list">
        <div
          v-for="(q, idx) in questions"
          :key="idx"
          class="review-item"
          :class="{ correct: q.isCorrect, wrong: !q.isCorrect }"
        >
          <div class="item-header">
            <span class="item-index">{{ t('dictionary.quiz.reviewQuestion', { index: idx + 1 }) }}</span>
            <span class="item-status-badge">
              <Icon :icon="q.isCorrect ? 'mdi:check-circle-outline' : 'mdi:close-circle-outline'" />
              {{ q.isCorrect ? t('dictionary.quiz.reviewCorrect') : t('dictionary.quiz.reviewIncorrect') }}
            </span>
          </div>

          <div class="item-body">
            <p class="item-question-text">
              <strong v-if="q.type === 'reorder'">{{ t('dictionary.quiz.correctAnswer') }}</strong> {{ q.question }}
            </p>
            <p class="item-answer-line">
              <strong>{{ t('dictionary.quiz.yourAnswer') }}</strong> <span class="answer-val">{{ q.userAnswer || 'Нет ответа' }}</span>
            </p>
            <p v-if="!q.isCorrect" class="item-answer-line correct-line">
              <strong>{{ t('dictionary.quiz.correctAnswer') }}</strong> <span class="answer-val">{{ q.correctAnswer }}</span>
            </p>
            <div class="item-explanation-detail">
              <strong>{{ t('dictionary.quiz.explanation') }}</strong> {{ q.explanation }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="currentState === 'testing' && currentQuestion">
        <KitBtn
          v-if="!isChecked"
          class="verify-btn"
          color="accent"
          variant="solid"
          :disabled="currentQuestion.type === 'reorder' ? reorderSelected.length === 0 : !selectedOption"
          @click="checkAnswer"
        >
          {{ t('dictionary.quiz.checkAnswer') }}
        </KitBtn>
        <KitBtn
          v-else
          class="verify-btn"
          color="primary"
          variant="solid"
          @click="nextQuestion"
        >
          {{ t('dictionary.quiz.nextQuestion') }} <Icon icon="mdi:arrow-right" class="ml-1" />
        </KitBtn>
      </template>

      <template v-else-if="currentState === 'summary' && testResult">
        <KitBtn color="secondary" variant="outlined" @click="currentState = 'select_level'; loadLevels()">
          {{ t('dictionary.quiz.toRoadmap') }}
        </KitBtn>
        <KitBtn
          v-if="!testResult.isPassed"
          color="primary"
          variant="solid"
          @click="startQuizFlow(selectedLevel)"
        >
          {{ t('dictionary.quiz.tryAgain') }}
        </KitBtn>
        <KitBtn
          v-else-if="testResult.nextLevelValue"
          color="primary"
          variant="solid"
          @click="startQuizFlow(testResult.nextLevelValue)"
        >
          {{ t('dictionary.quiz.nextLevelBtn', { level: testResult.nextLevelValue }) }}
        </KitBtn>
        <KitBtn
          v-else
          color="primary"
          variant="solid"
          @click="exitQuiz"
        >
          {{ t('dictionary.quiz.doneBtn') }}
        </KitBtn>
      </template>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.quiz-roadmap-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 350px;
}

.error-banner {
  background: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.08);
  border: 1px dashed var(--fg-error-color, #f44336);
  padding: 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-error-color, #f44336);
  font-size: 0.9rem;
}

.roadmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 8px;
}

.roadmap-node {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 160px;
  box-sizing: border-box;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);

  &.locked {
    opacity: 0.6;
    background: rgba(var(--bg-tertiary-color-rgb, 240, 240, 240), 0.5);
    border-style: dashed;
  }

  &.passed {
    border-color: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.4);
    box-shadow: 0 4px 12px rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.05);
  }

  &.is-active-target {
    border-color: var(--fg-accent-color);
    box-shadow:
      0 0 0 2px rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.2),
      0 8px 24px rgba(0, 0, 0, 0.08);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -2px;
      border: 2px solid var(--fg-accent-color);
      border-radius: 18px;
      animation: pulse-border 2s infinite ease-in-out;
      pointer-events: none;
    }
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 8px;

    .node-level {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--fg-primary-color);
    }

    .node-stars {
      display: flex;
      gap: 1px;
      svg {
        font-size: 1rem;
        color: var(--fg-muted-color);

        &.active {
          color: #ffc107;
        }
      }
    }
  }

  .node-body {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;

    .best-score {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      font-weight: 500;
    }
  }

  .node-footer {
    width: 100%;

    .start-node-btn {
      width: 100%;
    }

    .locked-label {
      font-size: 0.85rem;
      color: var(--fg-muted-color);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
    }
  }
}

.quiz-loading-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  height: 100%;

  .ai-loader-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;

    .loader-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid var(--bg-tertiary-color);
      border-top-color: var(--fg-accent-color);
      border-radius: 50%;
      animation: spin 1s infinite linear;
    }

    .loader-text {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      margin: 0;
    }

    .loader-subtext {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      max-width: 320px;
    }
  }
}

.quiz-testing-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  .progress-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .progress-fraction {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--fg-secondary-color);
      white-space: nowrap;
    }

    .bar-bg {
      height: 8px;
      background: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;

      .bar-fill {
        height: 100%;
        background: var(--fg-accent-color);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
    }
  }

  .hearts-container {
    display: flex;
    gap: 6px;

    svg {
      font-size: 1.5rem;
      color: var(--fg-muted-color);
      transition: transform 0.2s ease;

      &.active {
        color: var(--fg-error-color, #e91e63);
        filter: drop-shadow(0 2px 4px rgba(233, 30, 99, 0.2));
      }

      &.broken {
        opacity: 0.3;
        transform: scale(0.9);
      }
    }
  }
}

.question-container-card {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  padding: 24px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .question-tag {
    align-self: flex-start;
    background: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.1);
    color: var(--fg-accent-color);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 99px;
    text-transform: uppercase;
  }

  .question-title {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 8px 0;
    line-height: 1.4;
  }

  .reorder-translation-prompt {
    margin: 8px 0;

    .prompt-label {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }

    .prompt-text {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      margin: 4px 0 0 0;
    }
  }
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  .option-btn {
    width: 100%;
    text-align: left;
    padding: 16px 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-primary-color);
    color: var(--fg-primary-color);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      border-color: var(--fg-accent-color);
      background: var(--bg-hover-color);
    }

    &.selected {
      border-color: var(--fg-accent-color);
      background: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.05);
      color: var(--fg-accent-color);
    }

    &.correct {
      border-color: var(--fg-success-color, #4caf50) !important;
      background: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.08) !important;
      color: var(--fg-success-color, #4caf50) !important;
    }

    &.wrong {
      border-color: var(--fg-error-color, #f44336) !important;
      background: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.08) !important;
      color: var(--fg-error-color, #f44336) !important;
    }

    .validation-icon {
      font-size: 1.25rem;
    }
  }
}

.reorder-interface {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .reorder-assembled-zone {
    min-height: 64px;
    border: 2px dashed var(--border-secondary-color);
    background: var(--bg-primary-color);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    &.empty {
      justify-content: center;

      .placeholder {
        font-size: 0.85rem;
        color: var(--fg-muted-color);
      }
    }

    &.checked.correct {
      border-color: var(--fg-success-color, #4caf50);
      background: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.04);
    }

    &.checked.wrong {
      border-color: var(--fg-error-color, #f44336);
      background: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.04);
    }
  }

  .reorder-correct-answer {
    background: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.06);
    border: 1px solid rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.15);
    padding: 10px 14px;
    border-radius: 8px;

    .correct-label {
      font-size: 0.8rem;
      color: var(--fg-success-color, #4caf50);
      font-weight: 700;
    }

    .correct-text {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--fg-primary-color);
      margin: 4px 0 0 0;
    }
  }

  .reorder-words-pool {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 10px 0;
    border-top: 1px solid var(--border-secondary-color);
  }

  .word-token {
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);

    &:hover:not(:disabled) {
      background: var(--bg-hover-color);
      border-color: var(--border-primary-color);
      transform: translateY(-1px);
    }

    &.selected-token {
      background: var(--bg-primary-color);
      border-color: var(--fg-accent-color);
    }
  }
}

.explanation-box {
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.correct {
    background: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.08);
    border: 1px solid rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.15);

    .exp-title {
      color: var(--fg-success-color, #4caf50);
    }
  }

  &.wrong {
    background: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.08);
    border: 1px solid rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.15);

    .exp-title {
      color: var(--fg-error-color, #f44336);
    }
  }

  .exp-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 0.95rem;

    svg {
      font-size: 1.15rem;
    }
  }

  .exp-text {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.4;
  }
}

.verify-btn {
  min-width: 140px;
}

.quiz-summary-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.summary-hero {
  border-radius: 24px;
  padding: 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #fff;

  &.success {
    background: linear-gradient(135deg, #4caf50, #2e7d32);
    box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
  }

  &.fail {
    background: linear-gradient(135deg, #f44336, #c62828);
    box-shadow: 0 8px 24px rgba(244, 67, 54, 0.25);
  }

  .hero-icon {
    font-size: 3.5rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .hero-title {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0;
  }

  .hero-sub {
    font-size: 0.95rem;
    opacity: 0.9;
    margin: 0;
  }

  .summary-stars {
    display: flex;
    gap: 6px;
    margin-top: 8px;

    svg {
      font-size: 1.75rem;
      color: rgba(255, 255, 255, 0.3);

      &.active {
        color: #ffeb3b;
        filter: drop-shadow(0 2px 4px rgba(255, 235, 59, 0.4));
      }
    }
  }
}

.next-level-unlocked-banner {
  background: rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.08);
  border: 1px solid rgba(var(--fg-success-color-rgb, 76, 175, 80), 0.2);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;

  .unlock-icon {
    font-size: 2rem;
    color: var(--fg-success-color, #4caf50);
  }

  h4 {
    margin: 0 0 2px 0;
    color: var(--fg-success-color, #4caf50);
    font-weight: 700;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

.review-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin: 10px 0 0 0;
}

.review-questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 6px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 3px;
  }

  .review-item {
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &.correct {
      border-left: 4px solid var(--fg-success-color, #4caf50);

      .item-status-badge {
        color: var(--fg-success-color, #4caf50);
      }
    }

    &.wrong {
      border-left: 4px solid var(--fg-error-color, #f44336);
      background: rgba(var(--fg-error-color-rgb, 244, 67, 54), 0.02);

      .item-status-badge {
        color: var(--fg-error-color, #f44336);
      }
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .item-index {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--fg-muted-color);
      }

      .item-status-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8rem;
        font-weight: 700;
      }
    }

    .item-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.85rem;

      .item-question-text {
        color: var(--fg-primary-color);
        margin: 0;
      }

      .item-answer-line {
        color: var(--fg-secondary-color);
        margin: 0;

        .answer-val {
          color: var(--fg-primary-color);
          font-weight: 500;
        }

        &.correct-line {
          .answer-val {
            color: var(--fg-success-color, #4caf50);
            font-weight: 600;
          }
        }
      }

      .item-explanation-detail {
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px dashed var(--border-secondary-color);
        color: var(--fg-secondary-color);
        font-style: italic;
      }
    }
  }
}

.summary-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse-border {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.025);
    opacity: 0.45;
  }
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
}

.ml-1 {
  margin-left: 4px;
}

@keyframes skeleton-pulse {
  0% {
    background-color: var(--bg-secondary-color);
    opacity: 0.6;
  }
  50% {
    background-color: var(--bg-tertiary-color);
    opacity: 0.85;
  }
  100% {
    background-color: var(--bg-secondary-color);
    opacity: 0.6;
  }
}

.roadmap-node.skeleton {
  pointer-events: none;
  border-style: dashed;
  background: var(--bg-secondary-color);
  opacity: 0.8;

  .skeleton-text {
    height: 16px;
    border-radius: 4px;
    animation: skeleton-pulse 1.5s infinite ease-in-out;
    background-color: var(--bg-tertiary-color);

    &.level {
      width: 60px;
      height: 24px;
    }
    &.stars {
      width: 45px;
      height: 16px;
    }
    &.score {
      width: 100px;
      height: 18px;
    }
  }

  .skeleton-btn {
    display: block;
    width: 100%;
    height: 36px;
    border-radius: 8px;
    animation: skeleton-pulse 1.5s infinite ease-in-out;
    background-color: var(--bg-tertiary-color);
  }
}
</style>
