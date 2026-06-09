<script setup lang="ts">
import type { GeneratedWordExamples, UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput, KitTooltip } from '~/components/01.kit'
import { AiExamplesModal } from '~/components/03.domain/analysis'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { api } from '~/shared/services/api.service'
import { useSrsQuiz } from '../../../composables/use-srs-quiz'
import { useDictionaryStore } from '../../../store/dictionary.store'
import HanziBoard from '../../hanzi-board.vue'

const props = defineProps<{
  card: UserDictItem | null
  isSubmittingGrade: boolean
}>()

const emit = defineEmits(['grade'])

const dictStore = useDictionaryStore()
const { speak, stop, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()
const { generateDistractors, checkTypo } = useSrsQuiz()

const isFlipped = ref(false)
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
const showAnimation = ref(false)
const hanziBoardRef = ref<InstanceType<typeof HanziBoard> | null>(null)
const isAiModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<GeneratedWordExamples | null>(null)
const currentMode = ref<'standard' | 'audio' | 'writing' | 'typing' | 'choice'>('standard')

const originalSentence = computed(() => props.card?.encounters?.[0]?.sentence || '')

function toggleSection(sec: 'grammar' | 'vocab' | 'notes') {
  expandedSections[sec] = !expandedSections[sec]
}

async function fetchAiExamples() {
  if (!props.card?.word)
    return
  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    const res = await api.dictionary.generateExamples(props.card.word, props.card.language || 'en')
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
  stop()

  if (!props.card)
    return

  const modesConfig = { standard: true, audio: true, writing: true, typing: true, choice: true }
  const availableModes: ('standard' | 'audio' | 'writing' | 'typing' | 'choice')[] = []
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

  if (availableModes.length === 0)
    availableModes.push('standard')

  if (modesConfig.choice && props.card.status === 0 && Math.random() > 0.3) {
    currentMode.value = 'choice'
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
    setTimeout(flip, 400)
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
  if (!props.card)
    return 0
  const { repetitions, interval, easeFactor } = props.card

  if (grade === 0)
    return 1 / 1440
  if (grade === 1)
    return (repetitions === 0 || interval < 1) ? 30 / 1440 : interval * 1.2
  if (grade === 2)
    return (repetitions === 0 || interval < 1) ? 1 : interval * easeFactor
  if (grade === 3)
    return (repetitions === 0 || interval < 1) ? 4 : interval * easeFactor * 1.3
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
  if (!isFlipped.value || !props.card)
    return null
  return {
    again: formatInterval(calculateNextInterval(0)),
    hard: formatInterval(calculateNextInterval(1)),
    good: formatInterval(calculateNextInterval(2)),
    easy: formatInterval(calculateNextInterval(3)),
  }
})

function gradeCard(grade: number) {
  emit('grade', grade)
}

watch(() => props.card, initCard, { immediate: true })
</script>

<template>
  <div v-if="card" class="flashcard">
    <div class="card-front">
      <div v-if="currentMode === 'audio'" class="audio-mode">
        <KitBtn
          :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
          size="lg"
          color="accent"
          :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
          @click="speak(card.word, card.language)"
        />
        <p>{{ t('dictionary.listenAndRecall') }}</p>
      </div>

      <div v-else-if="currentMode === 'writing'" class="writing-mode">
        <p class="writing-hint">
          {{ t('dictionary.writeHanzi') }}
        </p>
        <div class="translation-hint" v-html="card.translation" />
        <HanziBoard :text="card.word" mode="quiz" :size="120" @complete="flip" />
      </div>

      <div v-else-if="currentMode === 'typing'" class="typing-mode">
        <div class="translation-hint" v-html="card.translation" />
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
          {{ card.word }}
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
          {{ card.word }}
        </div>
      </div>
    </div>

    <div v-if="isFlipped" class="card-back fade-in">
      <div v-if="currentMode === 'audio' || currentMode === 'writing' || card.transcription" class="back-word-row">
        <div v-if="currentMode === 'audio' || currentMode === 'writing'" class="word-huge back-word fade-in">
          {{ card.word }}
        </div>
        <div v-if="card.transcription" class="transcription-badge fade-in">
          {{ card.transcription }}
        </div>
      </div>

      <div v-if="currentMode !== 'choice' && currentMode !== 'typing'" class="translation-box fade-in" v-html="card.translation" />

      <div v-if="originalSentence" class="original-sentence fade-in">
        <Icon icon="mdi:format-quote-close" class="quote-icon" />
        <span>{{ originalSentence }}</span>
      </div>

      <div class="card-toolbar fade-in">
        <div class="toolbar-group">
          <KitTooltip :text="t('dictionary.listenVoice')" placement="top">
            <KitBtn
              :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
              variant="tonal"
              color="secondary"
              size="sm"
              :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
              @click="speak(card.word, card.language)"
            />
          </KitTooltip>
          <KitTooltip :text="t('dictionary.aiHint')" placement="top">
            <KitBtn icon="mdi:robot-outline" variant="tonal" color="secondary" size="sm" @click="fetchAiExamples" />
          </KitTooltip>
          <KitTooltip v-if="card.language === 'zh' && /[\u4E00-\u9FA5]/.test(card.word)" :text="t('dictionary.writingPractice')" placement="top">
            <KitBtn icon="mdi:draw" variant="tonal" color="secondary" size="sm" :class="{ 'is-active-btn': showAnimation }" @click="toggleAnimation" />
          </KitTooltip>
        </div>
        <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-divider" />
        <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-group">
          <KitTooltip v-if="card.grammarNote" :text="t('dictionary.grammar')" placement="top">
            <KitBtn size="sm" :variant="expandedSections.grammar ? 'solid' : 'tonal'" :color="expandedSections.grammar ? 'primary' : 'secondary'" icon="mdi:puzzle-outline" @click="toggleSection('grammar')" />
          </KitTooltip>
          <KitTooltip v-if="card.vocabularyNote" :text="t('dictionary.vocabulary')" placement="top">
            <KitBtn size="sm" :variant="expandedSections.vocab ? 'solid' : 'tonal'" :color="expandedSections.vocab ? 'primary' : 'secondary'" icon="mdi:book-open-page-variant-outline" @click="toggleSection('vocab')" />
          </KitTooltip>
          <KitTooltip v-if="card.notes" :text="t('dictionary.notesMnemonic')" placement="top">
            <KitBtn size="sm" :variant="expandedSections.notes ? 'solid' : 'tonal'" :color="expandedSections.notes ? 'primary' : 'secondary'" icon="mdi:note-text-outline" @click="toggleSection('notes')" />
          </KitTooltip>
        </div>
      </div>

      <div v-if="expandedSections.grammar && card.grammarNote" class="word-notes fade-in">
        <div class="notes-label">
          <Icon icon="mdi:puzzle-outline" /> {{ t('dictionary.grammar') }}
        </div>
        <div class="notes-text" v-html="card.grammarNote" />
      </div>
      <div v-if="expandedSections.vocab && card.vocabularyNote" class="word-notes fade-in">
        <div class="notes-label">
          <Icon icon="mdi:book-open-page-variant-outline" /> {{ t('dictionary.vocabulary') }}
        </div>
        <div class="notes-text" v-html="card.vocabularyNote" />
      </div>
      <div v-if="expandedSections.notes && card.notes" class="word-notes fade-in">
        <div class="notes-label">
          <Icon icon="mdi:note-text-outline" /> {{ t('dictionary.notesMnemonic') }}
        </div>
        <div class="notes-text" v-html="card.notes" />
      </div>

      <div v-if="showAnimation" class="animation-container fade-in">
        <h4>{{ t('dictionary.strokeOrder') }}</h4>
        <HanziBoard ref="hanziBoardRef" :text="card.word" mode="animation" :size="80" />
        <KitBtn icon="mdi:replay" variant="text" size="xs" color="secondary" @click="hanziBoardRef?.replay()">
          {{ t('dictionary.repeat') }}
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
        <button class="grade-btn error" :class="{ 'is-suggested': isAnswerChecked && !isAnswerCorrect }" :disabled="isSubmittingGrade" @click="gradeCard(0)">
          <span class="g-label">{{ t('dictionary.again') }}</span>
          <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.again }}</span>
        </button>
        <button class="grade-btn warning" :disabled="isSubmittingGrade" @click="gradeCard(1)">
          <span class="g-label">{{ t('dictionary.hard') }}</span>
          <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.hard }}</span>
        </button>
        <button class="grade-btn primary" :class="{ 'is-suggested': isAnswerChecked && isAnswerCorrect }" :disabled="isSubmittingGrade" @click="gradeCard(2)">
          <span class="g-label">{{ t('dictionary.good') }}</span>
          <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.good }}</span>
        </button>
        <button class="grade-btn success" :disabled="isSubmittingGrade" @click="gradeCard(3)">
          <span class="g-label">{{ t('dictionary.easy') }}</span>
          <span v-if="dictStore.trainingMode === 'srs'" class="g-time">{{ intervals.easy }}</span>
        </button>
      </div>
    </div>

    <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
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
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
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

.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  background-color: var(--bg-secondary-color);
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  .toolbar-group {
    display: flex;
    gap: 8px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: var(--border-secondary-color);
  }
}

.word-notes {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  padding: 16px;
  text-align: left;

  .notes-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-accent-color);
    text-transform: uppercase;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }

  .notes-text {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
    white-space: pre-wrap;

    :deep(b) {
      color: var(--fg-accent-color);
    }
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
