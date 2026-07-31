<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { Rating } from 'ts-fsrs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTts } from '~/01.shared/composables/use-tts'
import { KitBtn } from '~/02.kit/index.ts'
import { Flashcard } from '~/03.domain/entities/flashcard.entity.ts'
import { PronunciationCheck } from '~/04.features/pronunciation-check'
import { useFsrsScheduling } from '../../../composables/use-fsrs-scheduling.ts'
import { useSrsQuiz } from '../../../composables/use-srs-quiz'

import { useDictionaryStore } from '../../../store/dictionary.store'

import SrsCardToolbar from '../../partials/srs-card-toolbar.vue'
import SrsModeAudio from './srs-modes/srs-mode-audio.vue'
import SrsModeChoiceReverse from './srs-modes/srs-mode-choice-reverse.vue'
import SrsModeChoice from './srs-modes/srs-mode-choice.vue'
import SrsModeCollocations from './srs-modes/srs-mode-collocations.vue'
import SrsModeRadicals from './srs-modes/srs-mode-radicals.vue'
import SrsModeScramble from './srs-modes/srs-mode-scramble.vue'
import SrsModeStandard from './srs-modes/srs-mode-standard.vue'
import SrsModeTyping from './srs-modes/srs-mode-typing.vue'
import SrsModeWriting from './srs-modes/srs-mode-writing.vue'

interface Props {
  card: UserDictItem | null
  isSubmittingGrade: boolean
  modes?: Record<string, boolean>
}

const props = defineProps<Props>()
const emit = defineEmits(['grade'])

const repos = useRepos()
const dictStore = useDictionaryStore()
const { speak, stop, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()
const { generateDistractors, generateWordDistractors, checkTypo } = useSrsQuiz()

const isFlipped = ref(false)
const typedAnswer = ref('')
const typoFeedback = ref('')
const isAnswerChecked = ref(false)
const isAnswerCorrect = ref(false)
const choiceOptions = ref<{ text: string, isCorrect: boolean }[]>([])
const selectedChoice = ref<string | null>(null)
const currentMode = ref<'standard' | 'audio' | 'writing' | 'typing' | 'choice' | 'choice-reverse' | 'scramble' | 'collocations' | 'radicals'>('standard')

// Scramble state
const scrambleChunks = ref<{ id: number, text: string }[]>([])
const scrambleAnswer = ref<{ id: number, text: string }[]>([])

// Deep Dive state
const deepDiveData = ref<any>(null)
const selectedRadicals = ref<string[]>([])
const isAiLoadingMode = ref(false)

const cardRef = computed(() => props.card)
const { intervals } = useFsrsScheduling(cardRef, isFlipped)

// Strategy pattern: map mode → component
const modeComponentMap = {
  'audio': SrsModeAudio,
  'writing': SrsModeWriting,
  'typing': SrsModeTyping,
  'choice': SrsModeChoice,
  'choice-reverse': SrsModeChoiceReverse,
  'scramble': SrsModeScramble,
  'collocations': SrsModeCollocations,
  'radicals': SrsModeRadicals,
  'standard': SrsModeStandard,
}

const currentModeComponent = computed(() => modeComponentMap[currentMode.value] ?? SrsModeStandard)

const originalSentence = computed(() => props.card?.encounters?.[0]?.sentence || '')

const modeProps = computed(() => {
  const card = props.card!
  switch (currentMode.value) {
    case 'audio':
      return { card, isLoading: isLoading.value, isPlaying: isPlaying.value }
    case 'writing':
      return { card }
    case 'typing':
      return {
        card,
        typedAnswer: typedAnswer.value,
        isAnswerChecked: isAnswerChecked.value,
        typoFeedback: typoFeedback.value,
        isAnswerCorrect: isAnswerCorrect.value,
      }
    case 'choice':
    case 'choice-reverse':
      return {
        card,
        choiceOptions: choiceOptions.value,
        isAnswerChecked: isAnswerChecked.value,
        selectedChoice: selectedChoice.value,
      }
    case 'scramble':
      return {
        card,
        scrambleChunks: scrambleChunks.value,
        scrambleAnswer: scrambleAnswer.value,
        isAnswerChecked: isAnswerChecked.value,
        typoFeedback: typoFeedback.value,
        isAnswerCorrect: isAnswerCorrect.value,
      }
    case 'collocations':
      return {
        deepDiveData: deepDiveData.value,
        choiceOptions: choiceOptions.value,
        isAnswerChecked: isAnswerChecked.value,
        selectedChoice: selectedChoice.value,
      }
    case 'radicals':
      return {
        card,
        deepDiveData: deepDiveData.value,
        selectedRadicals: selectedRadicals.value,
        isAnswerChecked: isAnswerChecked.value,
      }
    case 'standard':
    default:
      return { card }
  }
})

const modeEmits = computed(() => {
  switch (currentMode.value) {
    case 'audio':
      return {
        speak: () => props.card && speak(props.card.word, props.card.language),
        flip,
      }
    case 'writing':
      return { flip }
    case 'typing':
      return {
        'update:typedAnswer': (val: string) => { typedAnswer.value = val },
        'submit': submitTyping,
      }
    case 'choice':
    case 'choice-reverse':
      return { select: selectChoice }
    case 'scramble':
      return { chunkClick: handleScrambleChunkClick }
    case 'collocations':
      return { select: selectChoice }
    case 'radicals':
      return {
        toggleRadical,
        check: checkRadicals,
      }
    default:
      return {}
  }
})

function initScramble() {
  const word = props.card!.word
  let chunks: string[] = []
  if (/[\u4E00-\u9FA5]/.test(word) || word.length <= 6) {
    chunks = word.split('')
  }
  else {
    for (let i = 0; i < word.length; i += 2) {
      chunks.push(word.substring(i, i + 2))
    }
  }
  scrambleChunks.value = chunks.map((text, i) => ({ id: i, text })).sort(() => Math.random() - 0.5)
  scrambleAnswer.value = []
}

function handleScrambleChunkClick(chunk: { id: number, text: string }, from: 'source' | 'answer') {
  if (isAnswerChecked.value)
    return
  if (from === 'source') {
    scrambleChunks.value = scrambleChunks.value.filter(c => c.id !== chunk.id)
    scrambleAnswer.value.push(chunk)
  }
  else {
    scrambleAnswer.value = scrambleAnswer.value.filter(c => c.id !== chunk.id)
    scrambleChunks.value.push(chunk)
  }

  if (scrambleChunks.value.length === 0) {
    checkScramble()
  }
}

function checkScramble() {
  const answerStr = scrambleAnswer.value.map(c => c.text).join('')
  isAnswerChecked.value = true
  isAnswerCorrect.value = answerStr === props.card!.word

  if (!isAnswerCorrect.value) {
    typoFeedback.value = t('dictionary.incorrectAnswer', { expected: props.card!.word })
  }

  setTimeout(flip, 1200)
}

async function initDeepDive(mode: 'collocations' | 'radicals') {
  isAiLoadingMode.value = true
  deepDiveData.value = null
  try {
    const res = await repos.dictionary.generateDeepDive(props.card!.word, props.card!.language, mode)
    deepDiveData.value = res
    if (mode === 'radicals') {
      selectedRadicals.value = []
    }
    else if (mode === 'collocations') {
      choiceOptions.value = (res as any).options.map((text: string) => ({ text, isCorrect: text === (res as any).answer })).sort(() => Math.random() - 0.5)
    }
  }
  catch {
    toast.error('Failed to load deep dive data')
    currentMode.value = 'standard'
  }
  finally {
    isAiLoadingMode.value = false
  }
}

function toggleRadical(rad: string) {
  if (isAnswerChecked.value)
    return
  const idx = selectedRadicals.value.indexOf(rad)
  if (idx > -1) {
    selectedRadicals.value.splice(idx, 1)
  }
  else {
    selectedRadicals.value.push(rad)
  }
}

function checkRadicals() {
  if (!deepDiveData.value || isAnswerChecked.value)
    return
  const expected = deepDiveData.value.answer as string[]
  const selected = selectedRadicals.value

  const isCorrect = expected.length === selected.length && expected.every((e: string) => selected.includes(e))
  isAnswerChecked.value = true
  isAnswerCorrect.value = isCorrect
  setTimeout(flip, 1500)
}

function initCard() {
  isFlipped.value = false
  typedAnswer.value = ''
  typoFeedback.value = ''
  isAnswerChecked.value = false
  isAnswerCorrect.value = false
  selectedChoice.value = null
  choiceOptions.value = []

  stop()

  if (!props.card)
    return

  const modesConfig = props.modes || {
    'standard': true,
    'audio': true,
    'writing': false,
    'typing': true,
    'choice': true,
    'choice-reverse': false,
    'scramble': false,
    'collocations': false,
    'radicals': false,
  }
  const availableModes: ('standard' | 'audio' | 'writing' | 'typing' | 'choice' | 'choice-reverse' | 'scramble' | 'collocations' | 'radicals')[] = []

  if (modesConfig.standard)
    availableModes.push('standard')
  if (modesConfig.audio && props.card.word)
    availableModes.push('audio')
  if (modesConfig.writing && props.card.language === 'zh' && props.card.word && /[\u4E00-\u9FA5]/.test(props.card.word))
    availableModes.push('writing')
  if (modesConfig.typing)
    availableModes.push('typing')
  if (modesConfig.choice)
    availableModes.push('choice')
  if (modesConfig['choice-reverse'])
    availableModes.push('choice-reverse')
  if (modesConfig.scramble)
    availableModes.push('scramble')
  if (modesConfig.collocations)
    availableModes.push('collocations')
  if (modesConfig.radicals && props.card.language === 'zh' && /[\u4E00-\u9FA5]/.test(props.card.word))
    availableModes.push('radicals')

  if (availableModes.length === 0)
    availableModes.push('standard')

  if (modesConfig.choice && availableModes.includes('choice') && new Flashcard(props.card).isNew() && Math.random() > 0.3) {
    currentMode.value = 'choice'
  }
  else if (modesConfig['choice-reverse'] && availableModes.includes('choice-reverse') && new Flashcard(props.card).isNew() && Math.random() > 0.3) {
    currentMode.value = 'choice-reverse'
  }
  else {
    currentMode.value = availableModes[Math.floor(Math.random() * availableModes.length)]
  }

  if (currentMode.value === 'choice') {
    const correctTrans = props.card.translation?.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim() || t('analysis.translation')
    const distractors = generateDistractors(props.card, dictStore.words, 3)
    const options = distractors.map(d => ({ text: d, isCorrect: false }))
    options.push({ text: correctTrans, isCorrect: true })
    choiceOptions.value = options.sort(() => 0.5 - Math.random())
  }
  else if (currentMode.value === 'choice-reverse') {
    const correctWord = props.card.word
    const distractors = generateWordDistractors(props.card, dictStore.words, 3)
    const options = distractors.map(d => ({ text: d, isCorrect: false }))
    options.push({ text: correctWord, isCorrect: true })
    choiceOptions.value = options.sort(() => 0.5 - Math.random())
  }
  else if (currentMode.value === 'scramble') {
    initScramble()
  }
  else if (currentMode.value === 'collocations' || currentMode.value === 'radicals') {
    initDeepDive(currentMode.value)
  }

  if (currentMode.value === 'audio') {
    setTimeout(() => {
      if (props.card?.word) {
        speak(props.card.word, props.card.language)
      }
    }, 300)
  }
}

function flip() {
  isFlipped.value = true
  if (currentMode.value !== 'audio' && props.card?.word) {
    speak(props.card.word, props.card.language)
  }
}

function submitTyping() {
  if (isAnswerChecked.value || !typedAnswer.value.trim() || !props.card)
    return

  const { isCorrect, isTypo } = checkTypo(typedAnswer.value, props.card.word)
  if (isCorrect) {
    isAnswerCorrect.value = true
    isAnswerChecked.value = true
    typoFeedback.value = ''
    flip()
  }
  else if (isTypo) {
    typoFeedback.value = t('dictionary.almostCorrectTypo', { expected: props.card.word })
  }
  else {
    isAnswerCorrect.value = false
    isAnswerChecked.value = true
    typoFeedback.value = t('dictionary.incorrectAnswer', { expected: props.card.word })
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
  if (currentMode.value === 'collocations' && deepDiveData.value) {
    selectedChoice.value = null
    setTimeout(flip, 800)
  }
  else if (currentMode.value === 'radicals' && deepDiveData.value) {
    selectedRadicals.value = []
    flip()
  }
  else {
    flip()
  }
}

function gradeCard(grade: number) {
  emit('grade', grade)
}

watch(() => props.card, initCard, { immediate: true })
</script>

<template>
  <div v-if="card" class="flashcard">
    <div class="card-front">
      <div v-if="isAiLoadingMode" class="audio-mode">
        <Icon icon="mdi:loading" class="spin-animation loading-icon" />
        <p>{{ t('analysis.generatingContext') }}</p>
      </div>

      <component
        :is="currentModeComponent"
        v-else-if="currentMode !== 'collocations' || deepDiveData"
        v-bind="modeProps"
        v-on="modeEmits"
      />
    </div>

    <div v-if="isFlipped" class="card-back fade-in">
      <div v-if="['audio', 'writing', 'typing', 'scramble', 'collocations'].includes(currentMode) || card.transcription" class="back-word-row">
        <div v-if="['audio', 'writing', 'typing', 'scramble', 'collocations'].includes(currentMode)" class="word-huge back-word fade-in">
          {{ card.word }}
        </div>
        <div v-if="card.transcription" class="transcription-badge fade-in">
          {{ card.transcription }}
        </div>
      </div>

      <div v-if="currentMode !== 'choice' && currentMode !== 'choice-reverse' && currentMode !== 'typing'" class="translation-box fade-in" v-html="card.translation" />

      <div v-if="originalSentence" class="original-sentence fade-in">
        <Icon icon="mdi:format-quote-close" class="quote-icon" />
        <span>{{ originalSentence }}</span>
      </div>

      <!-- ЕДИНЫЙ ТУЛБАР КАРТОЧКИ (TTS, AI, Написание, Заметки) -->
      <SrsCardToolbar :card="card" />

      <PronunciationCheck
        v-if="card"
        :word="card.word"
        :language="card.language"
        variant="inline"
      />
    </div>
  </div>

  <div class="actions">
    <template v-if="!isFlipped">
      <div class="front-actions">
        <KitBtn
          v-if="['standard', 'audio', 'writing'].includes(currentMode)"
          color="primary"
          size="lg"
          @click="flip"
        >
          {{ currentMode === 'writing' ? t('dictionary.dontRememberShow') : t('dictionary.showAnswer') }}
        </KitBtn>
        <KitBtn
          v-else
          variant="tonal"
          size="md"
          @click="skipObjectiveTest"
        >
          {{ t('dictionary.dontRememberSkip') }}
        </KitBtn>
      </div>
    </template>

    <div v-else-if="intervals" class="grade-buttons fade-in">
      <template v-if="dictStore.trainingMode === 'deep_dive'">
        <button
          class="grade-btn primary"
          :class="{ 'is-suggested': isAnswerChecked && isAnswerCorrect }"
          :disabled="isSubmittingGrade"
          @click="gradeCard(Rating.Good)"
        >
          <span class="g-label">{{ t('dictionary.next') }}</span>
        </button>
      </template>
      <template v-else-if="dictStore.trainingMode === 'cram'">
        <button
          class="grade-btn error"
          :class="{ 'is-suggested': isAnswerChecked && !isAnswerCorrect }"
          :disabled="isSubmittingGrade"
          @click="gradeCard(Rating.Again)"
        >
          <span class="g-label">{{ t('dictionary.again') }}</span>
        </button>
        <button
          class="grade-btn primary"
          :class="{ 'is-suggested': isAnswerChecked && isAnswerCorrect }"
          :disabled="isSubmittingGrade"
          @click="gradeCard(Rating.Good)"
        >
          <span class="g-label">{{ t('dictionary.good') }}</span>
        </button>
      </template>
      <template v-else>
        <button
          class="grade-btn error"
          :class="{ 'is-suggested': isAnswerChecked && !isAnswerCorrect }"
          :disabled="isSubmittingGrade"
          @click="gradeCard(Rating.Again)"
        >
          <span class="g-label">{{ t('dictionary.again') }}</span>
          <span class="g-time">{{ intervals.again }}</span>
        </button>
        <button class="grade-btn warning" :disabled="isSubmittingGrade" @click="gradeCard(Rating.Hard)">
          <span class="g-label">{{ t('dictionary.hard') }}</span>
          <span class="g-time">{{ intervals.hard }}</span>
        </button>
        <button
          class="grade-btn primary"
          :class="{ 'is-suggested': isAnswerChecked && isAnswerCorrect }"
          :disabled="isSubmittingGrade"
          @click="gradeCard(Rating.Good)"
        >
          <span class="g-label">{{ t('dictionary.good') }}</span>
          <span class="g-time">{{ intervals.good }}</span>
        </button>
        <button class="grade-btn success" :disabled="isSubmittingGrade" @click="gradeCard(Rating.Easy)">
          <span class="g-label">{{ t('dictionary.easy') }}</span>
          <span class="g-time">{{ intervals.easy }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.flashcard {
  display: flex;
  flex-direction: column;
  text-align: center;
  flex: 1;
}

.card-back {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  max-height: 40vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;

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

  .loading-icon {
    font-size: 3rem;
    color: var(--fg-accent-color);
  }
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

.back-word-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .transcription-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 12px;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 500;
    letter-spacing: 0.5px;
    font-family: 'Maple Mono CN', 'Courier New', monospace;
  }
}

.translation-box {
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
  border-left: 4px solid var(--fg-accent-color);
  padding: 12px 16px;
  border-radius: 4px 8px 8px 4px;
  font-size: 1.15rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
  text-align: left;
}

.original-sentence {
  display: flex;
  gap: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 12px 16px;
  border-radius: 8px;
  text-align: left;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;

  .quote-icon {
    font-size: 1.5rem;
    color: var(--fg-muted-color);
    flex-shrink: 0;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 8px;
  position: sticky;
  bottom: 0;
  z-index: 10;
  background-color: var(--bg-primary-color);

  .front-actions {
    display: flex;
    justify-content: center;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}

.grade-buttons {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding-bottom: env(safe-area-inset-bottom, 0px);

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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
</style>
