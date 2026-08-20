<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput } from '~/02.kit'
import { Icon } from '@iconify/vue'
import type {
  AnyRuleTest,
  ClozeChoiceTest,
  ClozeInputTest,
  MultipleChoiceOption,
  MultipleChoiceTest,
  Rule,
  RuleTest,
  SentenceScrambleTest
} from '~plugin-grammar-rules/shared/types'
import { useGrammarSrs } from '../../composables/use-grammar-srs'
import { useMistakeQueue } from '../../composables/use-mistake-queue'
import { useTestEngine } from '../../composables/use-test-engine'

interface Props {
  filteredRules: Rule[]
  tests: RuleTest[]
  currentLang: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const currentLangRef = toRef(props, 'currentLang')
const filteredRulesRef = toRef(props, 'filteredRules')
const allTestsRef = toRef(props, 'tests')

// 1. SRS & Mistake queues
const { recordRuleResult, rulesDueForReview, stats: srsStats } = useGrammarSrs(filteredRulesRef, currentLangRef)
const { mistakes, mistakeCount, addMistake, removeMistake } = useMistakeQueue()

// 2. Modes: 'all' | 'srs' | 'mistakes'
const testMode = ref<'all' | 'srs' | 'mistakes'>('all')

const activeTests = computed(() => {
  if (testMode.value === 'mistakes') {
    return mistakes.value
  }

  const activeRuleIds = testMode.value === 'srs'
    ? rulesDueForReview.value.map(r => r.id)
    : filteredRulesRef.value.map(r => r.id)

  return allTestsRef.value.filter(test => activeRuleIds.includes(test.ruleId))
})

// 3. Test Engine
const {
  currentTestIndex,
  currentTest,
  currentRule,
  isSubmitted,
  score,
  hasAnswer,
  selectedOption,
  typedInput,
  scrambleAvailableTokens,
  scrambleSelectedTokens,
  currentFeedback,
  selectChoice,
  selectScrambleToken,
  removeScrambleToken,
  submitAnswer,
  nextQuestion,
  restartTest
} = useTestEngine(activeTests, filteredRulesRef, {
  onResult: (ruleId, isCorrect, test) => {
    recordRuleResult(ruleId, isCorrect)
    if (!isCorrect) {
      addMistake(test)
    } else {
      removeMistake(test.id)
    }
  }
})

// Helpers for polymorphic test types
const currentTestPolymorphic = computed<AnyRuleTest | null>(() => {
  return currentTest.value as AnyRuleTest | null
})

const currentTestType = computed(() => {
  return currentTestPolymorphic.value?.type || 'multiple_choice'
})

const getOptionText = (opt: string | MultipleChoiceOption): string => {
  return typeof opt === 'object' && opt !== null ? opt.text : String(opt)
}

const getOptionsList = (test: MultipleChoiceTest | ClozeChoiceTest): Array<{ text: string, raw: string | MultipleChoiceOption }> => {
  if (!test.options) return []
  return (test.options as Array<string | MultipleChoiceOption>).map(opt => ({
    text: getOptionText(opt),
    raw: opt
  }))
}
</script>

<template>
  <div class="test-tab-content">
    <!-- Top Bar: Mode Selector & SRS Stats -->
    <div class="test-header-bar">
      <div class="mode-chips">
        <button
          class="mode-chip"
          :class="{ active: testMode === 'all' }"
          @click="testMode = 'all'"
        >
          <Icon icon="mdi:format-list-bulleted" />
          {{ t('plugins.grammar-rules.modeAll') }} ({{ allTestsRef.length }})
        </button>

        <button
          class="mode-chip"
          :class="{ active: testMode === 'srs' }"
          @click="testMode = 'srs'"
        >
          <Icon icon="mdi:calendar-clock" />
          {{ t('plugins.grammar-rules.modeSrs') }} ({{ rulesDueForReview.length }})
        </button>

        <button
          class="mode-chip"
          :class="{ active: testMode === 'mistakes', disabled: mistakeCount === 0 }"
          :disabled="mistakeCount === 0"
          @click="testMode = 'mistakes'"
        >
          <Icon icon="mdi:alert-circle-outline" />
          {{ t('plugins.grammar-rules.modeMistakes') }} ({{ mistakeCount }})
        </button>
      </div>

      <!-- SRS Quick Stats -->
      <div class="srs-quick-stats">
        <span class="stat-item mastered" title="Mastered rules">
          <Icon icon="mdi:check-decagram" /> {{ srsStats.masteredCount }}
        </span>
        <span class="stat-item learning" title="In progress">
          <Icon icon="mdi:trending-up" /> {{ srsStats.learningCount + srsStats.reviewCount }}
        </span>
        <span class="stat-item new" title="New rules">
          <Icon icon="mdi:star-outline" /> {{ srsStats.newCount }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="activeTests.length === 0" class="empty-state">
      <Icon icon="mdi:check-circle-outline" class="empty-icon success-icon" />
      <h3>{{ testMode === 'mistakes' ? t('plugins.grammar-rules.noMistakes') : t('plugins.grammar-rules.noTestsDue') }}</h3>
      <p>{{ t('plugins.grammar-rules.switchModeHint') }}</p>
      <KitBtn v-if="testMode !== 'all'" variant="outlined" @click="testMode = 'all'">
        {{ t('plugins.grammar-rules.modeAll') }}
      </KitBtn>
    </div>

    <!-- Active Test Container -->
    <div v-else-if="currentTest" class="test-container">
      <div class="test-progress-bar">
        <span class="progress-text">
          {{ t('plugins.grammar-rules.progressText', { current: (currentTestIndex % activeTests.length) + 1, total: activeTests.length }) }}
        </span>
        <span class="score-text">
          {{ t('plugins.grammar-rules.scoreText', { score }) }}
        </span>
      </div>

      <div class="test-card">
        <!-- Rule Header & Pattern Ref -->
        <div v-if="currentRule" class="test-rule-ref">
          <div class="rule-ref-title">
            <span class="rule-title-text">{{ currentRule.title }}</span>
            <span v-if="currentRule.level" class="rule-level-badge">{{ currentRule.level.toUpperCase() }}</span>
          </div>
          <code v-if="currentRule.pattern" class="pattern-hint">{{ currentRule.pattern }}</code>
        </div>

        <!-- Question / Prompt Header -->
        <div class="question-header">
          <p v-if="currentTestPolymorphic?.prompt" class="test-prompt">
            {{ currentTestPolymorphic.prompt }}
          </p>
          <h3 v-if="'question' in currentTest" class="test-question">
            {{ (currentTest as MultipleChoiceTest).question }}
          </h3>
        </div>

        <!-- 1. MULTIPLE CHOICE & CLOZE CHOICE RENDERER -->
        <div
          v-if="currentTestType === 'multiple_choice' || currentTestType === 'cloze_choice'"
          class="options-grid"
        >
          <!-- Sentence with blank if cloze_choice -->
          <div v-if="'sentenceWithBlank' in currentTest" class="cloze-sentence">
            {{ (currentTest as ClozeChoiceTest).sentenceWithBlank }}
          </div>

          <button
            v-for="opt in getOptionsList(currentTest as MultipleChoiceTest)"
            :key="opt.text"
            class="option-button"
            :class="{
              selected: selectedOption === opt.text,
              correct: isSubmitted && opt.text === (currentTest as MultipleChoiceTest).correctAnswer,
              incorrect: isSubmitted && selectedOption === opt.text && opt.text !== (currentTest as MultipleChoiceTest).correctAnswer,
              disabled: isSubmitted
            }"
            @click="selectChoice(opt.text)"
          >
            <span class="option-text">{{ opt.text }}</span>
            <Icon
              v-if="isSubmitted && opt.text === (currentTest as MultipleChoiceTest).correctAnswer"
              icon="mdi:check-circle"
              class="status-icon success"
            />
            <Icon
              v-if="isSubmitted && selectedOption === opt.text && opt.text !== (currentTest as MultipleChoiceTest).correctAnswer"
              icon="mdi:close-circle"
              class="status-icon error"
            />
          </button>
        </div>

        <!-- 2. CLOZE INPUT RENDERER (Typing / Fill-in-the-blank) -->
        <div v-else-if="currentTestType === 'cloze_input'" class="cloze-input-section">
          <div class="cloze-sentence-card">
            <span class="sentence-text">{{ (currentTest as ClozeInputTest).sentenceWithBlank }}</span>
          </div>

          <div class="input-form">
            <KitInput
              v-model="typedInput"
              :placeholder="t('plugins.grammar-rules.typeAnswerPlaceholder')"
              :disabled="isSubmitted"
              @keydown.enter="submitAnswer"
            />
          </div>

          <div v-if="(currentTest as ClozeInputTest).hints?.length" class="hints-box">
            <Icon icon="mdi:lightbulb-outline" />
            <span>{{ (currentTest as ClozeInputTest).hints?.join(' • ') }}</span>
          </div>
        </div>

        <!-- 3. SENTENCE SCRAMBLE RENDERER (Word Reordering) -->
        <div v-else-if="currentTestType === 'sentence_scramble'" class="scramble-section">
          <div class="scramble-translation">
            <Icon icon="mdi:translate" />
            <span>{{ (currentTest as SentenceScrambleTest).translation }}</span>
          </div>

          <!-- User Placed Tokens Slot Area -->
          <div class="tokens-assembled-box" :class="{ filled: scrambleSelectedTokens.length > 0 }">
            <span v-if="scrambleSelectedTokens.length === 0" class="tokens-placeholder">
              {{ t('plugins.grammar-rules.clickTokensToAssemble') }}
            </span>
            <button
              v-for="(tok, idx) in scrambleSelectedTokens"
              :key="`placed-${idx}-${tok}`"
              class="token-chip placed"
              :disabled="isSubmitted"
              @click="removeScrambleToken(idx)"
            >
              {{ tok }}
            </button>
          </div>

          <!-- Available Tokens Pool -->
          <div class="tokens-pool">
            <button
              v-for="(tok, idx) in scrambleAvailableTokens"
              :key="`pool-${idx}-${tok}`"
              class="token-chip pool"
              :disabled="isSubmitted"
              @click="selectScrambleToken(idx)"
            >
              {{ tok }}
            </button>
          </div>
        </div>

        <!-- FEEDBACK & EXPLANATION CARD (After Submit) -->
        <div v-if="isSubmitted && currentFeedback" class="feedback-card" :class="{ correct: currentFeedback.isCorrect, error: !currentFeedback.isCorrect }">
          <div class="feedback-header">
            <Icon :icon="currentFeedback.isCorrect ? 'mdi:check-circle' : 'mdi:close-circle'" class="feedback-icon" />
            <span class="feedback-title">
              {{ currentFeedback.isCorrect ? t('plugins.grammar-rules.correctHeading') : t('plugins.grammar-rules.incorrectHeading') }}
            </span>
          </div>

          <!-- Correct answer if missed -->
          <div v-if="!currentFeedback.isCorrect" class="correct-answer-reveal">
            <strong>{{ t('plugins.grammar-rules.correctAnswerIs') }}:</strong>
            <span>{{ currentFeedback.correctAnswer }}</span>
          </div>

          <!-- Distractor specific feedback -->
          <div v-if="currentFeedback.distractorFeedback" class="distractor-explanation">
            <Icon icon="mdi:information-outline" />
            <p>{{ currentFeedback.distractorFeedback }}</p>
          </div>

          <!-- General rule explanation -->
          <div v-if="currentFeedback.explanation" class="general-explanation">
            <p>{{ currentFeedback.explanation }}</p>
          </div>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="test-actions">
          <KitBtn
            v-if="!isSubmitted"
            color="primary"
            :disabled="!hasAnswer"
            @click="submitAnswer"
          >
            {{ t('plugins.grammar-rules.checkAnswer') }}
          </KitBtn>
          <KitBtn
            v-else
            color="primary"
            @click="nextQuestion"
          >
            {{ (currentTestIndex + 1) % activeTests.length === 0 ? t('plugins.grammar-rules.finishRound') : t('plugins.grammar-rules.nextQuestion') }}
          </KitBtn>
          <KitBtn variant="text" color="secondary" @click="restartTest">
            {{ t('plugins.grammar-rules.resetTest') }}
          </KitBtn>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
}

.test-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 4px;
}

.mode-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.disabled) {
    border-color: var(--fg-accent-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background-color: var(--bg-accent-color);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    font-weight: 600;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.srs-quick-stats {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;

  .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;

    &.mastered { color: #4caf50; }
    &.learning { color: #2196f3; }
    &.new { color: var(--fg-secondary-color); }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  color: var(--fg-secondary-color);
  gap: 16px;

  .empty-icon {
    font-size: 3.5rem;
    color: var(--border-primary-color);

    &.success-icon {
      color: #4caf50;
    }
  }

  h3 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--fg-primary-color);
  }

  p {
    margin: 0;
    max-width: 420px;
  }
}

.test-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 660px;
  width: 100%;
  margin: 0 auto;
}

.test-progress-bar {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.test-card {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.test-rule-ref {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .rule-ref-title {
    display: flex;
    align-items: center;
    gap: 8px;

    .rule-title-text {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--fg-accent-color);
      letter-spacing: 0.03em;
    }

    .rule-level-badge {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      font-weight: 700;
    }
  }

  .pattern-hint {
    align-self: flex-start;
    font-size: 0.8rem;
    font-family: monospace;
    background-color: var(--bg-secondary-color);
    padding: 3px 8px;
    border-radius: 4px;
    color: var(--fg-secondary-color);
  }
}

.question-header {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .test-prompt {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .test-question {
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
    line-height: 1.4;
  }
}

.cloze-sentence {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  padding: 12px 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  line-height: 1.5;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover:not(.disabled) {
    background-color: var(--bg-hover-color);
    border-color: var(--border-secondary-color);
  }

  &.selected {
    border-color: var(--fg-accent-color);
    background-color: rgba(100, 100, 255, 0.05);
  }

  &.correct {
    border-color: #43a047;
    background-color: rgba(67, 160, 71, 0.08);
  }

  &.incorrect {
    border-color: #e57373;
    background-color: rgba(229, 115, 115, 0.08);
  }

  &.disabled {
    cursor: not-allowed;
  }
}

.cloze-input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .cloze-sentence-card {
    background-color: var(--bg-secondary-color);
    border-radius: 12px;
    padding: 20px;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    line-height: 1.5;
  }

  .hints-box {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

.scramble-section {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .scramble-translation {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.05rem;
    color: var(--fg-secondary-color);
    font-style: italic;
  }

  .tokens-assembled-box {
    min-height: 70px;
    border: 2px dashed var(--border-primary-color);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    background-color: var(--bg-secondary-color);

    &.filled {
      border-style: solid;
      border-color: var(--border-secondary-color);
    }

    .tokens-placeholder {
      color: var(--fg-secondary-color);
      font-size: 0.9rem;
      margin: auto;
    }
  }

  .tokens-pool {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }

  .token-chip {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 500;
    border: 1px solid var(--border-primary-color);
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      border-color: var(--fg-accent-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    &.placed {
      background-color: var(--bg-accent-color);
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      font-weight: 600;
    }
  }
}

.feedback-card {
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &.correct {
    background-color: rgba(76, 175, 80, 0.08);
    border: 1px solid rgba(76, 175, 80, 0.3);
    .feedback-icon, .feedback-title { color: #43a047; }
  }

  &.error {
    background-color: rgba(244, 67, 54, 0.08);
    border: 1px solid rgba(244, 67, 54, 0.3);
    .feedback-icon, .feedback-title { color: #e57373; }
  }

  .feedback-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .correct-answer-reveal {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    display: flex;
    gap: 6px;
  }

  .distractor-explanation, .general-explanation {
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
    display: flex;
    gap: 8px;

    p { margin: 0; }
  }
}

.status-icon {
  font-size: 1.25rem;

  &.success {
    color: #43a047;
  }

  &.error {
    color: #e57373;
  }
}

.test-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
}
</style>
