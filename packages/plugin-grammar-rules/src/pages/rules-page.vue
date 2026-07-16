<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { KitBtn, KitInput, KitSelect, KitTabs } from '~/components/01.kit'
import { Icon } from '@iconify/vue'

interface Rule {
  id: string
  title: string
  category: 'grammar' | 'lexical' | 'collocation'
  description: string
  examples: Array<{ sentence: string; translation: string }>
  testQuestion: string
  testOptions: string[]
  correctAnswer: string
}

const activeTab = ref<'rules' | 'test'>('rules')
const searchQuery = ref('')
const selectedCategory = ref('all')
const loading = ref(false)
const rules = ref<Rule[]>([])

const categoryOptions = [
  { label: 'Все категории', value: 'all' },
  { label: 'Грамматика', value: 'grammar' },
  { label: 'Лексика', value: 'lexical' },
  { label: 'Словосочетания', value: 'collocation' }
]

const tabItems = [
  { id: 'rules', label: 'Изучение правил' },
  { id: 'test', label: 'Тестирование' }
]

const PRESETS: Rule[] = [
  {
    id: '1',
    title: 'Present Perfect vs Past Simple',
    category: 'grammar',
    description: 'Present Perfect используется, когда действие связано с настоящим результатом. Past Simple — когда время действия четко определено в прошлом.',
    examples: [
      { sentence: 'I have lost my keys (я не могу войти сейчас).', translation: 'Я потерял свои ключи.' },
      { sentence: 'I lost my keys yesterday (факт в прошлом).', translation: 'Вчера я потерял свои ключи.' }
    ],
    testQuestion: 'Выберите верный вариант: "She ___ to London in 2018."',
    testOptions: ['has gone', 'went', 'go', 'was gone'],
    correctAnswer: 'went'
  },
  {
    id: '2',
    title: 'Разница между "Say" и "Tell"',
    category: 'lexical',
    description: 'Мы говорим "say something" (сказать что-то), но "tell someone something" (рассказать кому-то что-то). После "say" не идет прямое личное местоимение без предлога "to".',
    examples: [
      { sentence: 'He said that he was tired.', translation: 'Он сказал, что устал.' },
      { sentence: 'He told me that he was tired.', translation: 'Он сказал мне, что устал.' }
    ],
    testQuestion: 'Заполните пропуск: "Please ___ me the truth."',
    testOptions: ['say', 'tell', 'say to', 'speak'],
    correctAnswer: 'tell'
  },
  {
    id: '3',
    title: 'Устойчивые выражения с "Make" и "Do"',
    category: 'collocation',
    description: 'Обычно "Do" относится к работе, обязанностям или процессам (do homework, do exercises), а "Make" — к созданию чего-то материального или результату (make coffee, make a mistake).',
    examples: [
      { sentence: 'I need to do my homework.', translation: 'Мне нужно сделать домашнее задание.' },
      { sentence: 'Try not to make a mistake.', translation: 'Постарайся не сделать ошибку.' }
    ],
    testQuestion: 'Какое сочетание является верным?',
    testOptions: ['make progress', 'do progress', 'make homework', 'do a mistake'],
    correctAnswer: 'make progress'
  }
]

const loadPresets = async () => {
  loading.value = true
  try {
    // Имитация загрузки с сервера
    await new Promise(resolve => setTimeout(resolve, 800))
    rules.value = [...PRESETS]
  } catch (e) {
    console.error('Failed to load rules', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPresets()
})

const filteredRules = computed(() => {
  return rules.value.filter(rule => {
    const matchesSearch = rule.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          rule.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = selectedCategory.value === 'all' || rule.category === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})

const categoryLabel = (cat: Rule['category']) => {
  switch (cat) {
    case 'grammar': return 'Грамматика'
    case 'lexical': return 'Лексика'
    case 'collocation': return 'Коллокация'
  }
}

// Тестирование
const currentTestIndex = ref(0)
const selectedAnswer = ref<string | null>(null)
const testSubmitted = ref(false)
const score = ref(0)

const currentTest = computed(() => {
  if (rules.value.length === 0) return null
  return rules.value[currentTestIndex.value % rules.value.length]
})

const selectAnswer = (ans: string) => {
  if (testSubmitted.value) return
  selectedAnswer.value = ans
}

const submitAnswer = () => {
  if (!selectedAnswer.value) return
  testSubmitted.value = true
  if (selectedAnswer.value === currentTest.value?.correctAnswer) {
    score.value++
  }
}

const nextQuestion = () => {
  selectedAnswer.value = null
  testSubmitted.value = false
  currentTestIndex.value++
}

const restartTest = () => {
  currentTestIndex.value = 0
  selectedAnswer.value = null
  testSubmitted.value = false
  score.value = 0
}
</script>

<template>
  <div class="rules-page">
    <header class="rules-header">
      <div class="header-info">
        <h1 class="page-title">Правила языка</h1>
        <p class="page-subtitle">Изучайте лексику, грамматику и проходите тесты</p>
      </div>
      <KitBtn icon="mdi:sync" variant="tonal" color="secondary" :loading="loading" @click="loadPresets">
        Загрузить с сервера
      </KitBtn>
    </header>

    <div class="rules-tabs-container">
      <KitTabs v-model="activeTab" :items="tabItems">
        <!-- Вкладка изучения правил -->
        <template #rules>
          <div class="rules-tab-content">
            <div class="filters-bar">
              <KitInput v-model="searchQuery" placeholder="Поиск по правилам..." class="search-input" />
              <KitSelect v-model="selectedCategory" :options="categoryOptions" class="category-select" />
            </div>

            <div v-if="loading" class="loading-state">
              <Icon icon="mdi:loading" class="spin-icon" />
              <p>Загрузка набора правил...</p>
            </div>

            <div v-else-if="filteredRules.length === 0" class="empty-state">
              <Icon icon="mdi:book-open-blank-variant" class="empty-icon" />
              <p>Правила не найдены. Попробуйте изменить фильтр или загрузить с сервера.</p>
            </div>

            <div v-else class="rules-grid">
              <div v-for="rule in filteredRules" :key="rule.id" class="rule-card">
                <div class="card-header">
                  <span class="category-badge" :class="rule.category">
                    {{ categoryLabel(rule.category) }}
                  </span>
                  <h3 class="rule-title">{{ rule.title }}</h3>
                </div>
                
                <p class="rule-desc">{{ rule.description }}</p>

                <div class="rule-examples">
                  <h4 class="examples-title">Примеры:</h4>
                  <ul class="examples-list">
                    <li v-for="(ex, index) in rule.examples" :key="index" class="example-item">
                      <span class="example-sentence">{{ ex.sentence }}</span>
                      <span class="example-translation">{{ ex.translation }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Вкладка тестирования -->
        <template #test>
          <div class="test-tab-content">
            <div v-if="rules.length === 0" class="empty-state">
              <Icon icon="mdi:alert-circle-outline" class="empty-icon" />
              <p>Сначала загрузите правила с сервера, чтобы пройти тест.</p>
              <KitBtn color="primary" @click="loadPresets">Загрузить</KitBtn>
            </div>

            <div v-else-if="currentTest" class="test-container">
              <div class="test-progress-bar">
                <span class="progress-text">Вопрос {{ (currentTestIndex % rules.length) + 1 }} из {{ rules.length }}</span>
                <span class="score-text">Очки: {{ score }}</span>
              </div>

              <div class="test-card">
                <h3 class="test-question">{{ currentTest.testQuestion }}</h3>

                <div class="options-grid">
                  <button
                    v-for="opt in currentTest.testOptions"
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

                <div class="test-actions">
                  <KitBtn
                    v-if="!testSubmitted"
                    color="primary"
                    :disabled="!selectedAnswer"
                    @click="submitAnswer"
                  >
                    Проверить ответ
                  </KitBtn>
                  <KitBtn
                    v-else
                    color="primary"
                    @click="nextQuestion"
                  >
                    {{ (currentTestIndex + 1) % rules.length === 0 ? 'Завершить круг / Далее' : 'Следующий вопрос' }}
                  </KitBtn>
                  <KitBtn variant="text" color="secondary" @click="restartTest">
                    Сбросить тест
                  </KitBtn>
                </div>
              </div>
            </div>
          </div>
        </template>
      </KitTabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-page {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.header-info {
  .page-title {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 0 0 4px 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.rules-tabs-container {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.rules-tab-content, .test-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
}

.filters-bar {
  display: flex;
  gap: 16px;
  width: 100%;

  .search-input {
    flex: 1;
  }

  .category-select {
    width: 200px;
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    .category-select {
      width: 100%;
    }
  }
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  color: var(--fg-secondary-color);
  gap: 16px;

  .spin-icon {
    font-size: 2.5rem;
    animation: spin 1s linear infinite;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--border-primary-color);
  }

  p {
    margin: 0;
    max-width: 400px;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.rule-card {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--border-secondary-color);
  }
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-badge {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.grammar {
    background-color: rgba(100, 100, 255, 0.12);
    color: var(--fg-accent-color, #5a5aff);
  }

  &.lexical {
    background-color: rgba(67, 160, 71, 0.12);
    color: #43a047;
  }

  &.collocation {
    background-color: rgba(229, 115, 115, 0.12);
    color: #e57373;
  }
}

.rule-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
}

.rule-desc {
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  margin: 0;
  flex-grow: 1;
}

.rule-examples {
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.examples-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--fg-secondary-color);
  margin: 0;
  letter-spacing: 0.5px;
}

.examples-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.example-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.example-sentence {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary-color);
}

.example-translation {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}

// Test Styles
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
