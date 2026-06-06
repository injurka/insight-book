<script setup lang="ts">
import type { GeneratedWordExamples } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitInput, KitSelect } from '~/components/01.kit'
import { AiExamplesModal } from '~/components/03.domain/analysis'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { useSrsQuiz } from '../../composables/use-srs-quiz'
import { useSrsSession } from '../../composables/use-srs-session'
import { useDictionaryStore } from '../../store/dictionary.store'
import HanziBoard from '../hanzi-board.vue'

const visible = defineModel<boolean>('visible', { required: true })
const dictStore = useDictionaryStore()
const { speak, stop, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()

const {
  sessionState,
  currentIndex,
  stats,
  timeSpentMs,
  accuracy,
  startSession: _startSession,
  finishSession,
  recordAnswer,
  reset: resetSession,
} = useSrsSession()

const { generateDistractors, checkTypo, formatTime } = useSrsQuiz()

const isFlipped = ref(false)
const isSubmitting = ref(false)

const allowStandard = ref(true)
const allowAudio = ref(true)
const allowWriting = ref(false)
const allowTyping = ref(true)
const allowChoice = ref(true)

const setupOptions = reactive({
  deckId: 'all' as number | 'all' | 'none',
  difficulty: 'all' as string | 'all' | 'none',
})

type TrainingMode = 'standard' | 'audio' | 'writing' | 'typing' | 'choice'
const currentMode = ref<TrainingMode>('standard')

const typedAnswer = ref('')
const typoFeedback = ref('')
const isAnswerChecked = ref(false)
const isAnswerCorrect = ref(false)
const choiceOptions = ref<{ text: string, isCorrect: boolean }[]>([])
const selectedChoice = ref<string | null>(null)

const expandedSections = reactive<Record<string, boolean>>({
  grammar: false,
  vocab: false,
  notes: false,
})

function toggleSection(sec: 'grammar' | 'vocab' | 'notes') {
  expandedSections[sec] = !expandedSections[sec]
}

const currentCard = computed(() => dictStore.reviewQueue[currentIndex.value])
const isFinished = computed(() => currentIndex.value >= dictStore.reviewQueue.length)
const remainingQueue = computed(() => dictStore.reviewQueue.slice(currentIndex.value))
const newCount = computed(() => remainingQueue.value.filter(c => c.status === 0).length)
const reviewCount = computed(() => remainingQueue.value.filter(c => c.status > 0).length)

const hasChineseWords = computed(() => {
  return dictStore.reviewQueue.some(c => c.language === 'zh' && /[\u4E00-\u9FA5]/.test(c.word || ''))
})

const originalSentence = computed(() => currentCard.value?.encounters?.[0]?.sentence || '')

const showAnimation = ref(false)
const hanziBoardRef = ref<InstanceType<typeof HanziBoard> | null>(null)

const isAiModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<GeneratedWordExamples | null>(null)

const currentLang = computed(() => {
  if (setupOptions.deckId !== 'all' && setupOptions.deckId !== 'none') {
    const deck = dictStore.decks.find(d => d.id === setupOptions.deckId)
    if (deck)
      return deck.language
  }
  return dictStore.selectedLanguage !== 'all' ? dictStore.selectedLanguage : 'all'
})

const deckOptions = computed(() => {
  const opts: any[] = [
    { label: t('dictionary.allDecks'), value: 'all' },
    { label: t('dictionary.noDeck'), value: 'none' },
  ]
  dictStore.decks.forEach((d) => {
    if (dictStore.selectedLanguage === 'all' || d.language === dictStore.selectedLanguage) {
      opts.push({ label: d.name, value: d.id })
    }
  })
  return opts
})

const difficultyOptions = computed(() => {
  const opts: any[] = [{ label: t('dictionary.allDifficulties'), value: 'all' }, { label: t('dictionary.noDifficulty'), value: 'none' }]
  const sys = DIFFICULTY_SYSTEMS[currentLang.value] || DIFFICULTY_SYSTEMS.all
  sys.forEach(d => opts.push({ label: d.label, value: d.value }))
  return opts
})

// Очистка при смене списка колод
watch(deckOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.deckId)) {
    setupOptions.deckId = 'all'
  }
})

// Очистка при смене списка сложностей
watch(difficultyOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.difficulty)) {
    setupOptions.difficulty = 'all'
  }
})

async function fetchAiExamples() {
  if (!currentCard.value?.word)
    return
  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    const res = await api.dictionary.generateExamples(currentCard.value.word, currentCard.value.language || 'en')
    aiData.value = res
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('dictionary.errorExamples'))
    isAiModalOpen.value = false
  }
  finally {
    isAiLoading.value = false
  }
}

async function startSession() {
  try {
    await dictStore.fetchTrainingQueue({
      mode: dictStore.trainingMode,
      deckId: setupOptions.deckId,
      difficulty: setupOptions.difficulty,
    })

    if (dictStore.reviewQueue.length === 0) {
      toast.info(t('dictionary.emptySearch'))
      return
    }

    if (!allowStandard.value && !allowAudio.value && !allowWriting.value && !allowTyping.value && !allowChoice.value) {
      allowStandard.value = true
    }

    _startSession()
    initCard()
  }
  catch {
    toast.error(t('dictionary.loadCardsError'))
  }
}

function initCard() {
  isFlipped.value = false
  showAnimation.value = false
  typedAnswer.value = ''
  typoFeedback.value = ''
  isAnswerChecked.value = false
  isAnswerCorrect.value = false
  selectedChoice.value = null
  choiceOptions.value = []

  expandedSections.grammar = false
  expandedSections.vocab = false
  expandedSections.notes = false

  if (!currentCard.value) {
    if (isFinished.value)
      finishSession()
    return
  }

  const availableModes: TrainingMode[] = []
  if (allowStandard.value)
    availableModes.push('standard')
  if (allowAudio.value && currentCard.value.word)
    availableModes.push('audio')

  if (allowWriting.value && currentCard.value.language === 'zh' && currentCard.value.word && /[\u4E00-\u9FA5]/.test(currentCard.value.word))
    availableModes.push('writing')

  if (allowTyping.value)
    availableModes.push('typing')
  if (allowChoice.value)
    availableModes.push('choice')

  if (availableModes.length === 0)
    availableModes.push('standard')

  if (allowChoice.value && currentCard.value.status === 0 && Math.random() > 0.3) {
    currentMode.value = 'choice'
  }
  else {
    currentMode.value = availableModes[Math.floor(Math.random() * availableModes.length)]
  }

  if (currentMode.value === 'choice') {
    const correctTrans = currentCard.value.translation?.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim() || t('analysis.translation')
    const distractors = generateDistractors(currentCard.value, dictStore.words, 3)
    const options = distractors.map(d => ({ text: d, isCorrect: false }))
    options.push({ text: correctTrans, isCorrect: true })
    choiceOptions.value = options.sort(() => 0.5 - Math.random())
  }

  if (currentMode.value === 'audio') {
    setTimeout(() => {
      if (currentCard.value?.word) {
        speak(currentCard.value.word, currentCard.value.language)
      }
    }, 300)
  }
}

function flip() {
  isFlipped.value = true
  if (currentMode.value !== 'audio' && currentCard.value?.word) {
    speak(currentCard.value.word, currentCard.value.language)
  }
}

function submitTyping() {
  if (isAnswerChecked.value || !typedAnswer.value.trim() || !currentCard.value)
    return

  const { isCorrect, isTypo } = checkTypo(typedAnswer.value, currentCard.value.word)
  if (isCorrect) {
    isAnswerCorrect.value = true
    isAnswerChecked.value = true
    typoFeedback.value = ''
    setTimeout(flip, 400)
  }
  else if (isTypo) {
    typoFeedback.value = t('dictionary.almostCorrectTypo', { expected: currentCard.value.word })
  }
  else {
    isAnswerCorrect.value = false
    isAnswerChecked.value = true
    typoFeedback.value = t('dictionary.incorrectAnswer', { expected: currentCard.value.word })
    setTimeout(flip, 1200)
  }
}

function selectChoice(option: { text: string, isCorrect: boolean }) {
  if (isAnswerChecked.value)
    return
  selectedChoice.value = option.text
  isAnswerChecked.value = true
  isAnswerCorrect.value = option.isCorrect
  setTimeout(flip, 800)
}

function skipObjectiveTest() {
  isAnswerChecked.value = true
  isAnswerCorrect.value = false
  flip()
}

function toggleAnimation() {
  showAnimation.value = !showAnimation.value
  if (showAnimation.value) {
    nextTick(() => {
      hanziBoardRef.value?.replay()
    })
  }
}

function calculateNextInterval(grade: number): number {
  if (!currentCard.value)
    return 0
  const { repetitions, interval, easeFactor } = currentCard.value

  if (grade === 0) {
    return 1 / 1440
  }
  else if (grade === 1) {
    if (repetitions === 0 || interval < 1)
      return 30 / 1440
    return interval * 1.2
  }
  else if (grade === 2) {
    if (repetitions === 0 || interval < 1)
      return 1
    return interval * easeFactor
  }
  else if (grade === 3) {
    if (repetitions === 0 || interval < 1)
      return 4
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

  const isNew = currentCard.value.status === 0
  recordAnswer(isNew, grade)

  if (dictStore.trainingMode === 'random') {
    currentIndex.value++
    stop()
    return
  }

  isSubmitting.value = true
  try {
    const cardRef = currentCard.value
    await api.dictionary.submitReview(cardRef.id, grade)

    if (grade === 0) {
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
    resetSession()
    setupOptions.deckId = dictStore.selectedDeckId
    setupOptions.difficulty = dictStore.selectedDifficulty
  }
  else {
    stop()
  }
})

watch(currentIndex, () => {
  if (!isFinished.value && sessionState.value === 'active') {
    initCard()
  }
  else if (isFinished.value && sessionState.value === 'active') {
    finishSession()
  }
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :max-width="650"
    persistent
  >
    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          <template v-if="sessionState === 'setup'">
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.setupSrs') : t('dictionary.setupWarmup') }}
          </template>
          <template v-else-if="sessionState === 'finished'">
            {{ t('dictionary.sessionSummary') }}
          </template>
          <template v-else>
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.reviewSrs') : t('dictionary.randomTraining') }}
            <span v-if="!isFinished" class="mode-badge">
              ({{
                currentMode === 'audio' ? t('dictionary.listening')
                : currentMode === 'writing' ? t('dictionary.writing')
                  : currentMode === 'typing' ? t('dictionary.typing')
                    : currentMode === 'choice' ? t('dictionary.test') : t('dictionary.reading')
              }})
            </span>
          </template>
        </h2>

        <div v-if="sessionState === 'active' && !isFinished && dictStore.trainingMode === 'srs'" class="srs-stats">
          <span class="stat-new" :title="t('dictionary.newCards')">{{ newCount }}</span>
          <span class="stat-review" :title="t('dictionary.onReview')">{{ reviewCount }}</span>
        </div>
        <div v-else-if="sessionState === 'active' && !isFinished" class="srs-stats">
          <span class="stat-review" :title="t('dictionary.cardsLeft')">{{ remainingQueue.length }}</span>
        </div>
      </div>
    </template>

    <div v-if="sessionState === 'setup'" class="setup-state">
      <p class="setup-desc">
        {{ t('dictionary.setupFilters') }}
      </p>

      <div class="settings-group filters-group">
        <div class="form-row">
          <div class="form-col">
            <label>{{ t('dictionary.deck') }}</label>
            <KitSelect v-model="setupOptions.deckId" :options="deckOptions" />
          </div>
          <div class="form-col">
            <label>{{ t('dictionary.difficulty') }}</label>
            <KitSelect v-model="setupOptions.difficulty" :options="difficultyOptions" />
          </div>
        </div>
      </div>

      <div class="settings-group">
        <label class="group-label">{{ t('dictionary.trainingModes') }}</label>
        <div class="modes-grid">
          <div class="mode-card" :class="{ 'is-active': allowStandard }" @click="allowStandard = !allowStandard">
            <Icon icon="mdi:card-text-outline" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.reading') }}</span>
            <span class="mode-desc">{{ t('dictionary.classicCards') }}</span>
          </div>

          <div class="mode-card" :class="{ 'is-active': allowTyping }" @click="allowTyping = !allowTyping">
            <Icon icon="mdi:keyboard-outline" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.typing') }}</span>
            <span class="mode-desc">{{ t('dictionary.writeByMemory') }}</span>
          </div>

          <div class="mode-card" :class="{ 'is-active': allowChoice }" @click="allowChoice = !allowChoice">
            <Icon icon="mdi:format-list-checks" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.test') }}</span>
            <span class="mode-desc">{{ t('dictionary.multipleChoice') }}</span>
          </div>

          <div class="mode-card" :class="{ 'is-active': allowAudio }" @click="allowAudio = !allowAudio">
            <Icon icon="mdi:headphones" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.listening') }}</span>
            <span class="mode-desc">{{ t('dictionary.aiSpeech') }}</span>
          </div>

          <div v-if="hasChineseWords" class="mode-card" :class="{ 'is-active': allowWriting }" @click="allowWriting = !allowWriting">
            <Icon icon="mdi:draw" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.writing') }}</span>
            <span class="mode-desc">{{ t('dictionary.hanziByMemory') }}</span>
          </div>
        </div>
      </div>

      <div class="setup-actions">
        <KitBtn variant="tonal" size="sm" @click="visible = false">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn color="primary" size="sm" @click="startSession">
          {{ t('dictionary.start') }}
        </KitBtn>
      </div>
    </div>

    <div v-else-if="sessionState === 'finished'" class="finished-state">
      <h2>{{ t('dictionary.greatJob') }}</h2>
      <p v-if="dictStore.trainingMode === 'srs'">
        {{ t('dictionary.reviewedAll') }}
      </p>
      <p v-else>
        {{ t('dictionary.warmupFinished') }}
      </p>

      <div class="summary-stats">
        <div class="stat-box">
          <Icon icon="mdi:star-four-points-outline" class="stat-icon new" />
          <span class="stat-val">{{ stats.newStudied }}</span>
          <span class="stat-name">{{ t('dictionary.newStudied') }}</span>
        </div>
        <div class="stat-box">
          <Icon icon="mdi:refresh" class="stat-icon review" />
          <span class="stat-val">{{ stats.reviewed }}</span>
          <span class="stat-name">{{ t('dictionary.reviewed') }}</span>
        </div>
        <div class="stat-box">
          <Icon icon="mdi:bullseye-arrow" class="stat-icon accuracy" />
          <span class="stat-val">{{ accuracy }}%</span>
          <span class="stat-name">{{ t('dictionary.accuracy') }}</span>
        </div>
        <div class="stat-box">
          <Icon icon="mdi:clock-outline" class="stat-icon time" />
          <span class="stat-val">{{ formatTime(timeSpentMs) }}</span>
          <span class="stat-name">{{ t('dictionary.time') }}</span>
        </div>
      </div>

      <KitBtn color="primary" size="lg" @click="visible = false">
        {{ t('dictionary.finishSession') }}
      </KitBtn>
    </div>

    <div v-else-if="currentCard" class="flashcard">
      <div class="card-front">
        <div v-if="currentMode === 'audio'" class="audio-mode">
          <KitBtn
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            size="lg"
            color="accent"
            :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
            @click="speak(currentCard.word, currentCard.language)"
          />
          <p>{{ t('dictionary.listenAndRecall') }}</p>
        </div>

        <div v-else-if="currentMode === 'writing'" class="writing-mode">
          <p class="writing-hint">
            {{ t('dictionary.writeHanzi') }}
          </p>
          <div class="translation-hint" v-html="currentCard.translation" />
          <HanziBoard :text="currentCard.word" mode="quiz" :size="120" @complete="flip" />
        </div>

        <div v-else-if="currentMode === 'typing'" class="typing-mode">
          <div class="translation-hint" v-html="currentCard.translation" />
          <div class="typing-area">
            <KitInput v-model="typedAnswer" :placeholder="t('dictionary.writeWord')" :disabled="isAnswerChecked" @keyup.enter="submitTyping" />
            <KitBtn color="primary" :disabled="!typedAnswer || isAnswerChecked" @click="submitTyping">
              {{ t('dictionary.check') }}
            </KitBtn>
          </div>
          <p v-if="typoFeedback" class="typo-feedback" :class="{ 'is-typo': !isAnswerCorrect }">
            {{ typoFeedback }}
          </p>
        </div>

        <div v-else-if="currentMode === 'choice'" class="choice-mode">
          <div class="word-huge">
            {{ currentCard.word }}
          </div>
          <div class="options-grid">
            <button
              v-for="opt in choiceOptions"
              :key="opt.text"
              class="choice-btn"
              :class="{
                'is-correct': isAnswerChecked && opt.isCorrect,
                'is-wrong': isAnswerChecked && selectedChoice === opt.text && !opt.isCorrect,
                'is-disabled': isAnswerChecked,
              }"
              :disabled="isAnswerChecked"
              @click="selectChoice(opt)"
            >
              {{ opt.text }}
            </button>
          </div>
        </div>

        <div v-else class="standard-mode">
          <div class="word-huge">
            {{ currentCard.word }}
          </div>
        </div>
      </div>

      <div v-if="isFlipped" class="card-back fade-in">
        <hr>

        <div v-if="currentMode === 'audio' || currentMode === 'writing'" class="word-huge back-word fade-in">
          {{ currentCard.word }}
        </div>

        <div class="transcription">
          {{ currentCard.transcription }}
        </div>

        <div v-if="currentMode !== 'choice' && currentMode !== 'typing'" class="translation" v-html="currentCard.translation" />

        <div v-if="originalSentence" class="original-sentence fade-in">
          <b>{{ t('analysis.context') }}</b> {{ originalSentence }}
        </div>

        <div v-if="currentCard.grammarNote || currentCard.vocabularyNote || currentCard.notes" class="notes-toggle-row fade-in">
          <KitBtn
            v-if="currentCard.grammarNote"
            size="xs"
            :variant="expandedSections.grammar ? 'tonal' : 'outlined'"
            color="secondary"
            icon="mdi:puzzle-outline"
            @click="toggleSection('grammar')"
          >
            {{ t('dictionary.grammar') }}
          </KitBtn>
          <KitBtn
            v-if="currentCard.vocabularyNote"
            size="xs"
            :variant="expandedSections.vocab ? 'tonal' : 'outlined'"
            color="secondary"
            icon="mdi:book-open-page-variant-outline"
            @click="toggleSection('vocab')"
          >
            {{ t('dictionary.vocabulary') }}
          </KitBtn>
          <KitBtn
            v-if="currentCard.notes"
            size="xs"
            :variant="expandedSections.notes ? 'tonal' : 'outlined'"
            color="secondary"
            icon="mdi:note-text-outline"
            @click="toggleSection('notes')"
          >
            {{ t('dictionary.notesMnemonic') }}
          </KitBtn>
        </div>

        <div v-if="expandedSections.grammar && currentCard.grammarNote" class="word-notes fade-in">
          <div class="notes-text">
            {{ currentCard.grammarNote }}
          </div>
        </div>

        <div v-if="expandedSections.vocab && currentCard.vocabularyNote" class="word-notes fade-in">
          <div class="notes-text">
            {{ currentCard.vocabularyNote }}
          </div>
        </div>

        <div v-if="expandedSections.notes && currentCard.notes" class="word-notes fade-in">
          <div class="notes-text">
            {{ currentCard.notes }}
          </div>
        </div>

        <div v-if="showAnimation" class="animation-container fade-in">
          <h4>{{ t('dictionary.strokeOrder') }}</h4>
          <HanziBoard ref="hanziBoardRef" :text="currentCard.word" mode="animation" :size="80" />
          <KitBtn icon="mdi:replay" variant="text" size="xs" color="secondary" @click="hanziBoardRef?.replay()">
            {{ t('dictionary.repeat') }}
          </KitBtn>
        </div>

        <div class="back-actions-row fade-in">
          <KitBtn
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            variant="subtle"
            size="sm"
            :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
            @click="speak(currentCard.word, currentCard.language)"
          >
            {{ t('dictionary.listenVoice') }}
          </KitBtn>

          <KitBtn
            icon="mdi:text-box-search-outline"
            variant="subtle"
            size="sm"
            @click="fetchAiExamples"
          >
            {{ t('dictionary.aiHint') }}
          </KitBtn>

          <KitBtn
            v-if="currentCard.language === 'zh' && /[\u4E00-\u9FA5]/.test(currentCard.word)"
            icon="mdi:draw"
            variant="subtle"
            size="sm"
            :class="{ 'is-active-btn': showAnimation }"
            @click="toggleAnimation"
          >
            {{ t('dictionary.writingPractice') }}
          </KitBtn>
        </div>
      </div>

      <div class="actions">
        <template v-if="!isFlipped">
          <div class="front-actions">
            <KitBtn v-if="!['typing', 'choice'].includes(currentMode)" color="primary" size="lg" @click="flip">
              {{ currentMode === 'writing' ? t('dictionary.dontRememberShow') : t('dictionary.showAnswer') }}
            </KitBtn>
            <KitBtn v-else variant="tonal" size="md" @click="skipObjectiveTest">
              {{ t('dictionary.dontRememberSkip') }}
            </KitBtn>
          </div>
        </template>

        <div v-else-if="intervals" class="grade-buttons fade-in">
          <button class="grade-btn error" :class="{ 'is-suggested': isAnswerChecked && !isAnswerCorrect }" :disabled="isSubmitting" @click="gradeCard(0)">
            <span class="g-label">{{ t('dictionary.again') }}</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.again }}</span>
          </button>
          <button class="grade-btn warning" :disabled="isSubmitting" @click="gradeCard(1)">
            <span class="g-label">{{ t('dictionary.hard') }}</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.hard }}</span>
          </button>
          <button class="grade-btn primary" :class="{ 'is-suggested': isAnswerChecked && isAnswerCorrect }" :disabled="isSubmitting" @click="gradeCard(2)">
            <span class="g-label">{{ t('dictionary.good') }}</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.good }}</span>
          </button>
          <button class="grade-btn success" :disabled="isSubmitting" @click="gradeCard(3)">
            <span class="g-label">{{ t('dictionary.easy') }}</span>
            <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.easy }}</span>
          </button>
        </div>
      </div>
    </div>
  </KitDialog>

  <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
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
    gap: 12px;
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);

    .group-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      margin-bottom: 4px;
    }

    .modes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;

      .mode-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
        padding: 16px 12px;
        background: var(--bg-primary-color);
        border: 1px solid var(--border-primary-color);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;

        &:hover {
          border-color: var(--border-secondary-color);
          background: var(--bg-hover-color);
        }

        &.is-active {
          border-color: var(--fg-accent-color);
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);

          .mode-icon {
            color: var(--fg-accent-color);
          }
        }

        .mode-icon {
          font-size: 2rem;
          color: var(--fg-secondary-color);
          transition: color 0.2s;
        }

        .mode-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--fg-primary-color);
        }

        .mode-desc {
          font-size: 0.75rem;
          color: var(--fg-muted-color);
          line-height: 1.3;
        }
      }
    }
  }

  .filters-group {
    .form-row {
      display: flex;
      gap: 12px;
      @include media-down(sm) {
        flex-direction: column;
      }
    }
    .form-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--fg-secondary-color);
      }
    }
  }

  .setup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

/* ЭКРАН ИТОГОВ (SUMMARY) */
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
    color: var(--fg-secondary-color);
  }

  .summary-stats {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin: 24px 0 32px 0;
    flex-wrap: wrap;

    .stat-box {
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
      gap: 8px;

      .stat-icon {
        font-size: 2rem;
        &.new {
          color: var(--fg-info-color);
        }
        &.review {
          color: var(--fg-accent-color);
        }
        &.accuracy {
          color: var(--fg-success-color);
        }
        &.time {
          color: var(--fg-warning-color);
        }
      }

      .stat-val {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      .stat-name {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}

.flashcard {
  display: flex;
  flex-direction: column;
  text-align: center;
  min-height: 450px;
  height: 100%;
}

.card-back {
  margin-bottom: 8px;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 4px;

  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.card-front {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}

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

.writing-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .writing-hint {
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .translation-hint {
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.typing-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .translation-hint {
    font-size: 1.3rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  .typing-area {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 400px;

    :deep(.kit-input-wrapper) {
      flex: 1;
    }
  }

  .typo-feedback {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-warning-color);
    &.is-typo {
      color: var(--fg-error-color);
    }
  }
}

.choice-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    max-width: 500px;

    @include media-down(sm) {
      grid-template-columns: 1fr;
    }

    .choice-btn {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border-primary-color);
      background: var(--bg-secondary-color);
      color: var(--fg-primary-color);
      font-size: 1.05rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background: var(--bg-hover-color);
        border-color: var(--fg-accent-color);
      }

      &.is-correct {
        background: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.2);
        border-color: var(--fg-success-color);
        color: var(--fg-success-color);
        font-weight: bold;
      }

      &.is-wrong {
        background: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.2);
        border-color: var(--fg-error-color);
        color: var(--fg-error-color);
        text-decoration: line-through;
      }

      &:disabled {
        cursor: default;
        opacity: 0.7;
      }
    }
  }
}

.animation-container {
  margin-top: 16px;
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.5);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);

  h4 {
    margin: 0 0 8px 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
  }
}

.is-active-btn {
  color: var(--fg-accent-color) !important;
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1) !important;
}

.standard-mode {
  width: 100%;
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

.back-actions-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  color: var(--fg-secondary-color);
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
  margin-top: 16px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  font-style: italic;
  padding: 12px;
  background: var(--bg-secondary-color);
  border-radius: 8px;
  text-align: left;
}

.notes-toggle-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.word-notes {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
  border-left: 3px solid var(--fg-accent-color);
  border-radius: 4px;
  text-align: left;

  .notes-text {
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--fg-secondary-color);
    white-space: pre-wrap;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 16px;

  .front-actions {
    display: flex;
    justify-content: center;
  }
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

    /* Подсветка рекомендуемого ответа после объективного квиза */
    &.is-suggested {
      border-color: currentColor;
      transform: translateY(-2px);
      background: var(--bg-tertiary-color);
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

.spin-animation {
  :deep(.kit-btn-icon) {
    animation: spin 1s linear infinite;
  }
}

.pulse-animation {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-op {
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
