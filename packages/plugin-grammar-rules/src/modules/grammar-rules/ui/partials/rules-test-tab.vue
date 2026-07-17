<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/components/01.kit'
import { Icon } from '@iconify/vue'
import type { Rule, RuleTest } from '@injurka/insight-book-plugin-grammar-rules/shared/types'
import { useRulesTest } from '../../composables/use-rules-test'

const props = defineProps<{
  filteredRules: Rule[]
  tests: RuleTest[]
}>()

const { t } = useI18n()

const filteredRulesRef = toRef(props, 'filteredRules')
const testsRef = toRef(props, 'tests')

const {
  activeTests,
  currentTestIndex,
  selectedAnswer,
  testSubmitted,
  score,
  currentTest,
  currentRuleReference,
  selectAnswer,
  submitAnswer,
  nextQuestion,
  restartTest
} = useRulesTest(filteredRulesRef, testsRef)
</script>

<template>
  <div class="test-tab-content">
    <div v-if="activeTests.length === 0" class="empty-state">
      <Icon icon="mdi:alert-circle-outline" class="empty-icon" />
      <p>{{ filteredRules.length === 0 ? t('plugins.grammar-rules.rulesNotFound') : t('plugins.grammar-rules.loadRulesFirst') }}</p>
    </div>

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
        <div v-if="currentRuleReference" class="test-rule-ref">
          <span>{{ currentRuleReference.title }}</span>
        </div>

        <h3 class="test-question">{{ currentTest.question }}</h3>

        <div class="options-grid">
          <button
            v-for="opt in currentTest.options"
            :key="opt"
            class="option-button"
            :class="{
              selected: selectedAnswer === opt,
              correct: testSubmitted && opt === currentTest.correctAnswer,
              incorrect: testSubmitted && selectedAnswer === opt && opt !== currentTest.correctAnswer,
              disabled: testSubmitted
            }"
            @click="selectAnswer(opt)"
          >
            <span class="option-text">{{ opt }}</span>
            <Icon v-if="testSubmitted && opt === currentTest.correctAnswer" icon="mdi:check-circle" class="status-icon success" />
            <Icon v-if="testSubmitted && selectedAnswer === opt && opt !== currentTest.correctAnswer" icon="mdi:close-circle" class="status-icon error" />
          </button>
        </div>

        <div v-if="testSubmitted && currentTest.explanation" class="test-explanation">
          <p>{{ currentTest.explanation }}</p>
        </div>

        <div class="test-actions">
          <KitBtn
            v-if="!testSubmitted"
            color="primary"
            :disabled="!selectedAnswer"
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
    font-size: 3rem;
    color: var(--border-primary-color);
  }

  p {
    margin: 0;
    max-width: 400px;
  }
}

.test-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 600px;
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
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-accent-color);
  margin-bottom: -8px;
}

.test-explanation {
  background-color: var(--bg-secondary-color);
  border-left: 4px solid var(--fg-accent-color);
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
  margin-top: 8px;

  p {
    margin: 0;
  }
}

.test-question {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
  line-height: 1.4;
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
  margin-top: 12px;
}
</style>
