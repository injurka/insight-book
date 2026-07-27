<script setup lang="ts">
import type { GeneratedWordExamples, UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { Rating } from 'ts-fsrs'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { Flashcard } from '~/components/03.domain/entities/flashcard.entity'
import { PronunciationCheck } from '~/components/04.features/pronunciation-check'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { vLongPress } from '~/shared/directives/long-press'
import { useRepos } from '~/shared/plugins/di'
import { useAuthStore } from '~/shared/store/auth.store'
import { useSrsQuiz } from '../../../composables/use-srs-quiz'
import { useDictionaryStore } from '../../../store/dictionary.store'
import { useFsrsScheduling } from './composables/use-fsrs-scheduling'
import SrsModeAudio from './srs-modes/srs-mode-audio.vue'
import SrsModeChoiceReverse from './srs-modes/srs-mode-choice-reverse.vue'
import SrsModeChoice from './srs-modes/srs-mode-choice.vue'
import SrsModeCollocations from './srs-modes/srs-mode-collocations.vue'
import SrsModeRadicals from './srs-modes/srs-mode-radicals.vue'
import SrsModeScramble from './srs-modes/srs-mode-scramble.vue'
import SrsModeStandard from './srs-modes/srs-mode-standard.vue'
import SrsModeTyping from './srs-modes/srs-mode-typing.vue'
import SrsModeWriting from './srs-modes/srs-mode-writing.vue'

const props = defineProps<{
  card: UserDictItem | null
  isSubmittingGrade: boolean
  modes?: Record<string, boolean>
}>()
const emit = defineEmits(['grade'])

const repos = useRepos()
const AiExamplesModal = lazyComponent(() => import('~/components/04.features/analysis/ui/modal/ai-examples-modal.vue'))
const LlmChatModal = lazyComponent(() => import('~/components/04.features/llm-chat/ui/llm-chat-modal.vue'))
const HanziBoard = lazyComponent(() => import('../../hanzi-board.vue'))

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
const expandedSections = reactive<Record<string, boolean>>({
  grammar: false,
  vocab: false,
  notes: false,
})
const showAnimation = ref(false)
const hanziBoardRef = ref<InstanceType<typeof HanziBoard> | null>(null)
const isAiModalOpen = ref(false)
const isChatModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<GeneratedWordExamples | null>(null)
const currentMode = ref<'standard' | 'audio' | 'writing' | 'typing' | 'choice' | 'choice-reverse' | 'scramble' | 'collocations' | 'radicals'>('standard')

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
const isTtsPopoverOpen = ref(false)

function openTtsPopover() {
  if (isAdmin.value) {
    isTtsPopoverOpen.value = true
  }
}

function playTTS(forceCacheBypass = false) {
  if (props.card?.word) {
    speak(
      props.card.word,
      props.card.language,
      undefined,
      forceCacheBypass,
    )
  }
}

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
    const res = await repos.dictionary.generateExamples(props.card.word, props.card.language || 'en')
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

function toggleAnimation() {
  showAnimation.value = !showAnimation.value
  if (showAnimation.value) {
    nextTick(() => {
      hanziBoardRef.value?.replay()
    })
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

      <div class="card-toolbar fade-in">
        <div class="toolbar-group">
          <KitDropdown
            v-model="isTtsPopoverOpen"
            placement="bottom-start"
            width="220px"
            :disabled="true"
          >
            <template #activator>
              <KitTooltip :text="t('dictionary.listenVoice')" placement="bottom">
                <KitBtn
                  v-long-press="openTtsPopover"
                  :icon="isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium'"
                  :loading="isLoading"
                  variant="tonal"
                  color="secondary"
                  size="sm"
                  :class="{ 'is-playing-pulse': isPlaying, 'is-active-btn': isTtsPopoverOpen }"
                  @click="playTTS(false)"
                  @contextmenu.prevent="openTtsPopover"
                />
              </KitTooltip>
            </template>
            <div class="dropdown-menu-list">
              <button class="dropdown-item" @click="playTTS(true); isTtsPopoverOpen = false">
                <Icon icon="mdi:refresh" />
                {{ t('dictWord.forceNewVoiceover') }}
              </button>
            </div>
          </KitDropdown>

          <PronunciationCheck
            v-if="card"
            :word="card.word"
            :language="card.language"
            variant="button"
            btn-size="sm"
            btn-color="secondary"
            btn-variant="tonal"
            tooltip-placement="bottom"
          />

          <KitDropdown placement="bottom-start" width="240px">
            <template #activator="{ props: dropdownProps }">
              <KitTooltip :text="t('dictionary.aiHint')" placement="bottom">
                <KitBtn
                  icon="mdi:robot-outline"
                  variant="tonal"
                  color="secondary"
                  size="sm"
                  :class="{ 'is-active-btn': dropdownProps.isOpen }"
                />
              </KitTooltip>
            </template>
            <div class="dropdown-menu-list">
              <button class="dropdown-item" @click="fetchAiExamples">
                <Icon icon="mdi:text-box-search-outline" />
                {{ t('analysis.aiContextAndExamples') }}
              </button>
              <button class="dropdown-item" @click="isChatModalOpen = true">
                <Icon icon="mdi:chat-processing-outline" />
                {{ t('dictionary.aiFreeQuestion') }}
              </button>
            </div>
          </KitDropdown>
          <KitTooltip v-if="card.language === 'zh' && /[\u4E00-\u9FA5]/.test(card.word)" :text="t('dictionary.writingPractice')" placement="bottom">
            <KitBtn
              icon="mdi:draw"
              variant="tonal"
              color="secondary"
              size="sm"
              :class="{ 'is-active-btn': showAnimation }"
              @click="toggleAnimation"
            />
          </KitTooltip>
        </div>

        <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-divider" />
        <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-group">
          <KitTooltip v-if="card.grammarNote" :text="t('dictionary.grammar')" placement="bottom">
            <KitBtn
              size="sm"
              :variant="expandedSections.grammar ? 'solid' : 'tonal'"
              :color="expandedSections.grammar ? 'primary' : 'secondary'"
              icon="mdi:puzzle-outline"
              @click="toggleSection('grammar')"
            />
          </KitTooltip>
          <KitTooltip v-if="card.vocabularyNote" :text="t('dictionary.vocabulary')" placement="bottom">
            <KitBtn
              size="sm"
              :variant="expandedSections.vocab ? 'solid' : 'tonal'"
              :color="expandedSections.vocab ? 'primary' : 'secondary'"
              icon="mdi:book-open-page-variant-outline"
              @click="toggleSection('vocab')"
            />
          </KitTooltip>
          <KitTooltip v-if="card.notes" :text="t('dictionary.notesMnemonic')" placement="bottom">
            <KitBtn
              size="sm"
              :variant="expandedSections.notes ? 'solid' : 'tonal'"
              :color="expandedSections.notes ? 'primary' : 'secondary'"
              icon="mdi:note-text-outline"
              @click="toggleSection('notes')"
            />
          </KitTooltip>
        </div>
      </div>

      <PronunciationCheck
        v-if="card"
        :word="card.word"
        :language="card.language"
        variant="inline"
      />
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
      <HanziBoard
        ref="hanziBoardRef"
        :text="card.word"
        mode="animation"
        :size="80"
      />
      <KitBtn
        icon="mdi:replay"
        variant="text"
        size="xs"
        color="secondary"
        @click="hanziBoardRef?.replay()"
      >
        {{ t('dictionary.repeat') }}
      </KitBtn>
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

  <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
  <LlmChatModal
    v-if="card"
    v-model:visible="isChatModalOpen"
    :word="card.word"
    :language="card.language || 'en'"
  />
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

.animation-container {
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

  &:not(:first-of-type) {
    margin-top: 8px;
  }

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

.pronunciation-result {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 16px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .pron-header {
    display: flex;
    align-items: center;
    gap: 12px;

    .pron-score {
      font-size: 1.3rem;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 6px;
      color: white;

      &.is-success {
        background-color: var(--fg-success-color);
      }
      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-error {
        background-color: var(--fg-error-color);
      }
    }

    .pron-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .user-audio-btn {
      margin-left: auto;
    }
  }

  .pron-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-primary-color);
    padding: 12px;
    border-radius: 8px;
    border: 1px dashed var(--border-primary-color);

    .pron-row {
      display: flex;
      gap: 8px;
      font-size: 0.95rem;

      .row-label {
        color: var(--fg-secondary-color);
        min-width: 80px;
        flex-shrink: 0;
      }

      .row-value {
        color: var(--fg-primary-color);
        font-weight: 500;

        .transcription-hint {
          color: var(--fg-muted-color);
          font-weight: normal;
          font-size: 0.9em;
          margin-left: 4px;
        }

        &.is-error b {
          color: var(--fg-error-color);
        }

        b {
          font-weight: 600;
        }
      }

      &.analysis-row {
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px dotted var(--border-secondary-color);

        .row-value {
          font-weight: normal;
          color: var(--fg-secondary-color);

          :deep(*) {
            margin: 0;
            display: inline;
          }
        }
      }
    }
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

.is-playing-pulse {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-error-color) !important;
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

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}
</style>
