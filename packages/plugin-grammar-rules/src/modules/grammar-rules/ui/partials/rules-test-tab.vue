<script setup lang="ts">
import type {
  AnyRuleTest,
  ClozeChoiceTest,
  ClozeInputTest,
  MultipleChoiceTest,
  Rule,
  RuleTest,
  SentenceScrambleTest,
} from '../../../../shared/types'
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'
import { useGrammarSrs } from '../../composables/use-grammar-srs'
import { useMistakeQueue } from '../../composables/use-mistake-queue'
import { useTestEngine } from '../../composables/use-test-engine'
import TestClozeInput from './test-engine/test-cloze-input.vue'
import TestEmptyState from './test-engine/test-empty-state.vue'
import TestFeedbackCard from './test-engine/test-feedback-card.vue'
import TestHeaderModes from './test-engine/test-header-modes.vue'
import TestMultipleChoice from './test-engine/test-multiple-choice.vue'
import TestProgressBar from './test-engine/test-progress-bar.vue'
import TestRoundSummary from './test-engine/test-round-summary.vue'
import TestSentenceScramble from './test-engine/test-sentence-scramble.vue'

interface Props {
  filteredRules: Rule[]
  tests: RuleTest[]
  currentLang: string
  targetRule?: Rule | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'clearTargetRule'): void
  (e: 'backToRules'): void
}>()

const { t } = useI18n()
const { mistakes, mistakeCount, addMistake, removeMistake } = useMistakeQueue()

const currentLangRef = toRef(props, 'currentLang')
const filteredRulesRef = toRef(props, 'filteredRules')

// 1. SRS & Mistake queues
const { recordRuleResult, rulesDueForReview, stats: srsStats } = useGrammarSrs(filteredRulesRef, currentLangRef)

const allTestsRef = toRef(props, 'tests')
// 2. Mode: 'all' | 'srs' | 'mistakes'
const testMode = ref<'all' | 'srs' | 'mistakes'>('all')

const activeTests = computed(() => {
  if (testMode.value === 'mistakes') {
    return mistakes.value
  }

  // If a target rule is focused, prioritize its tests
  if (props.targetRule) {
    return allTestsRef.value.filter(t => t.ruleId === props.targetRule!.id)
  }

  const activeRuleIds = testMode.value === 'srs'
    ? rulesDueForReview.value.map(r => r.id)
    : filteredRulesRef.value.map(r => r.id)

  return allTestsRef.value.filter(test => activeRuleIds.includes(test.ruleId))
})

// 3. Test Engine
const {
  sessionTests,
  currentTestIndex,
  currentTest,
  currentRule,
  isSubmitted,
  isRoundComplete,
  score,
  streak,
  hasAnswer,
  selectedOption,
  typedInput,
  scrambleAvailableTokens,
  scrambleSelectedTokens,
  currentFeedback,
  selectChoice,
  selectScrambleToken,
  removeScrambleToken,
  clearCurrentAnswer,
  submitAnswer,
  nextQuestion,
  restartTest,
} = useTestEngine(activeTests, filteredRulesRef, {
  onResult: (ruleId, isCorrect, test) => {
    recordRuleResult(ruleId, isCorrect)

    if (!isCorrect) {
      addMistake(test)
    }
    else {
      removeMistake(test.id)
    }
  },
})

// Helpers for polymorphic test types
const currentTestPolymorphic = computed<AnyRuleTest | null>(() => {
  return currentTest.value as AnyRuleTest | null
})
const currentTestType = computed(() => {
  return currentTestPolymorphic.value?.type || 'multiple_choice'
})

const currentChoiceTest = computed<MultipleChoiceTest | ClozeChoiceTest | null>(() => {
  const type = currentTestType.value

  if ((type === 'multiple_choice' || type === 'cloze_choice') && currentTest.value) {
    return currentTest.value as MultipleChoiceTest | ClozeChoiceTest
  }

  return null
})

const currentClozeInputTest = computed<ClozeInputTest | null>(() => {
  if (currentTestType.value === 'cloze_input' && currentTest.value) {
    return currentTest.value as ClozeInputTest
  }

  return null
})

const currentScrambleTest = computed<SentenceScrambleTest | null>(() => {
  if (currentTestType.value === 'sentence_scramble' && currentTest.value) {
    return currentTest.value as SentenceScrambleTest
  }

  return null
})

function setTestMode(mode: 'all' | 'srs' | 'mistakes') {
  testMode.value = mode
  restartTest()
}
function onRestartRound() {
  restartTest()
}
function onReviewMistakes() {
  testMode.value = 'mistakes'
  restartTest()
}
// Global keyboard navigation: Enter to submit/advance
function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Enter') {
    return
  }

  if (!isSubmitted.value && hasAnswer.value) {
    e.preventDefault()
    submitAnswer()
  }
  else if (isSubmitted.value) {
    e.preventDefault()
    nextQuestion()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="rules-test-tab">
    <!-- Header Track & Mode Selector -->
    <TestHeaderModes
      :mode="testMode"
      :all-count="allTestsRef.length"
      :srs-due-count="rulesDueForReview.length"
      :mistakes-count="mistakeCount"
      :stats="srsStats"
      :target-rule="targetRule"
      @change-mode="setTestMode"
      @clear-target-rule="emit('clearTargetRule')"
    />

    <!-- Round Complete State -->
    <TestRoundSummary
      v-if="isRoundComplete"
      :score="score"
      :total="sessionTests.length"
      :mistakes-count="mistakeCount"
      @restart="onRestartRound"
      @review-mistakes="onReviewMistakes"
      @back-to-rules="emit('backToRules')"
    />

    <!-- Empty State -->
    <TestEmptyState
      v-else-if="sessionTests.length === 0"
      :mode="testMode"
      @switch-mode="setTestMode('all')"
    />

    <!-- Active Test Card -->
    <div v-else-if="currentTest" class="test-card-container">
      <div class="test-card">
        <!-- Progress Bar & Score -->
        <TestProgressBar
          :current-index="currentTestIndex"
          :total-count="sessionTests.length"
          :score="score"
          :streak="streak"
          :rule="currentRule"
        />

        <!-- Question Prompt Header -->
        <div class="question-header">
          <p v-if="currentTestPolymorphic?.prompt" class="question-instruction">
            {{ currentTestPolymorphic.prompt }}
          </p>
          <h3 v-if="'question' in currentTest" class="question-title">
            {{ (currentTest as MultipleChoiceTest).question }}
          </h3>
        </div>

        <!-- 1. MULTIPLE CHOICE & CLOZE CHOICE -->
        <TestMultipleChoice
          v-if="currentChoiceTest"
          :test="currentChoiceTest"
          :selected-option="selectedOption"
          :is-submitted="isSubmitted"
          @select="selectChoice"
        />

        <!-- 2. CLOZE INPUT (Fill in the blank) -->
        <TestClozeInput
          v-else-if="currentClozeInputTest"
          v-model:typed-input="typedInput"
          :test="currentClozeInputTest"
          :is-submitted="isSubmitted"
          @submit="submitAnswer"
        />

        <!-- 3. SENTENCE SCRAMBLE (Word ordering) -->
        <TestSentenceScramble
          v-else-if="currentScrambleTest"
          :test="currentScrambleTest"
          :available-tokens="scrambleAvailableTokens"
          :selected-tokens="scrambleSelectedTokens"
          :is-submitted="isSubmitted"
          @select-token="selectScrambleToken"
          @remove-token="removeScrambleToken"
          @clear-tokens="clearCurrentAnswer"
        />

        <!-- FEEDBACK BANNER (After Submit) -->
        <TestFeedbackCard
          v-if="isSubmitted && currentFeedback"
          :feedback="currentFeedback"
        />

        <!-- ACTION CONTROLS -->
        <div class="test-footer-actions">
          <KitBtn
            v-if="!isSubmitted"
            color="accent"
            size="md"
            :disabled="!hasAnswer"
            class="submit-action-btn"
            @click="submitAnswer"
          >
            {{ t('plugins.grammar-rules.checkAnswer') }}
          </KitBtn>

          <KitBtn
            v-else
            color="accent"
            size="md"
            class="submit-action-btn"
            @click="nextQuestion"
          >
            {{ currentTestIndex + 1 >= sessionTests.length ? t('plugins.grammar-rules.finishRound') : t('plugins.grammar-rules.nextQuestion') }}
          </KitBtn>

          <KitBtn
            variant="text"
            color="secondary"
            size="sm"
            icon="mdi:refresh"
            @click="() => restartTest()"
          >
            {{ t('plugins.grammar-rules.resetTest') }}
          </KitBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-test-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.test-card-container {
  display: flex;
  justify-content: center;
  width: 100%;
}

.test-card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 680px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);

  @include media-down(sm) {
    padding: 18px;
    gap: 18px;
    border-radius: 16px;
  }
}

.question-header {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .question-instruction {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .question-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.4;
    color: var(--fg-primary-color);
  }
}

.test-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color);

  .submit-action-btn {
    min-width: 160px;
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;

    .submit-action-btn {
      width: 100%;
    }
  }
}
</style>
